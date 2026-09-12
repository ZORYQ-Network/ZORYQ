import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  Wallet,
  JsonRpcProvider,
  hexlify,
  parseEther,
  toUtf8Bytes,
} from 'ethers';
import {
  createIntentEnvelope,
  authorizeIntent,
  recordExecution,
  verifyOutcome,
  ObepLedger,
  exportProofPack,
  hashObject,
  verifyProofPack,
} from '../obep.mjs';

const BASE = (process.env.ZORYQ_PUBLIC_BASE_URL || 'https://zoryq-evm-node-live-production.up.railway.app').replace(/\/$/, '');
const RPC = `${BASE}/rpc`;
const CHAIN_ID = 5919065;
const PAYMENT_WEI = process.env.ZORYQ_OBEP_TASK_PAYMENT_WEI || parseEther('1').toString();
const OUT = process.argv[2] || 'zoryq-evidence/obep/external-task-live-proof.json';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const INPUT = path.join(HERE, 'records.json');
const COMPUTE = path.join(HERE, 'compute-task.mjs');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function computeTask() {
  const run = spawnSync(process.execPath, [COMPUTE, INPUT], { encoding: 'utf8' });
  assert(run.status === 0, run.stderr || 'task computation failed');
  return JSON.parse(run.stdout);
}

function independentlyRecompute(expected) {
  const run = spawnSync(process.execPath, [COMPUTE, INPUT], { encoding: 'utf8' });
  if (run.status !== 0) return { accepted: false, reason: run.stderr || 'recompute failed', recomputed: null };
  const recomputed = JSON.parse(run.stdout);
  const accepted = JSON.stringify(recomputed) === JSON.stringify(expected);
  return {
    accepted,
    reason: accepted ? 'independent deterministic recomputation matched byte-for-byte' : 'independent deterministic recomputation mismatch',
    recomputed,
  };
}

async function waitForBalance(provider, address, minimum, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const balance = await provider.getBalance(address);
    if (balance >= minimum) return balance;
    await sleep(1500);
  }
  throw new Error('faucet funding not visible before timeout');
}

async function main() {
  const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
  const network = await provider.getNetwork();
  assert(Number(network.chainId) === CHAIN_ID, `wrong chain ${network.chainId}`);

  const health = await fetch(`${BASE}/health`).then(async (r) => ({ status: r.status, body: await r.json() }));
  assert(health.status === 200 && health.body?.ok === true, 'public testnet health gate not green');

  const faucetStatusResponse = await fetch(`${BASE}/faucet/status`);
  const faucetStatus = await faucetStatusResponse.json();
  assert(faucetStatusResponse.ok && faucetStatus?.ok === true, 'faucet status unavailable');
  if (faucetStatus.xAttestationRequired === true) throw new Error('task proof blocked: faucet requires external X attestation');

  // Ephemeral role keys live only for this proof process and are never serialized.
  const treasury = Wallet.createRandom().connect(provider);
  const executor = Wallet.createRandom();
  const verifier = Wallet.createRandom();

  const claimResponse = await fetch(`${BASE}/faucet/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address: treasury.address }),
  });
  const claim = await claimResponse.json();
  assert(claimResponse.ok && claim?.ok === true, `faucet claim failed: ${JSON.stringify(claim)}`);

  const fundedBalance = await waitForBalance(provider, treasury.address, BigInt(PAYMENT_WEI));
  assert(fundedBalance > BigInt(PAYMENT_WEI), 'funded balance insufficient for payment plus gas');

  const taskResult = computeTask();
  const verification = independentlyRecompute(taskResult);
  assert(verification.accepted === true, 'deterministic task verification failed before settlement');

  const inputRecords = JSON.parse(fs.readFileSync(INPUT, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const task = {
    type: 'ZORYQ_OBEP_EXTERNAL_TASK_V1',
    inputDigest: taskResult.inputDigest,
    recordCount: inputRecords.length,
    specification: 'zoryq-developer/obep/external-task/README.md',
  };

  const intent = createIntentEnvelope({
    companyId: `company:obep-useful-task:${treasury.address.toLowerCase()}`,
    goal: 'Compute, independently verify, and settle a deterministic useful dataset-summary task on ZORYQ Testnet',
    task,
    executor: executor.address,
    verifier: verifier.address,
    treasury: treasury.address,
    budget: PAYMENT_WEI,
    chainId: CHAIN_ID,
    nonce: `useful-task-${Date.now()}-${treasury.address.toLowerCase()}`,
    validFrom: now - 30,
    validUntil: now + 900,
    policy: {
      maxPayment: PAYMENT_WEI,
      asset: 'ZQ_TESTNET_NATIVE',
      capability: 'ZORYQ_OBEP_EXTERNAL_TASK_V1',
      revocable: true,
    },
  });

  const authorization = authorizeIntent(intent, { authorizer: treasury.address, issuedAt: now });
  const authorizationMessage = `ZORYQ_OBEP_AUTH|${intent.intentId}|${authorization.authorizationId}`;
  const authorizationSignature = await treasury.signMessage(authorizationMessage);

  const execution = recordExecution(intent, authorization, {
    executor: executor.address,
    output: taskResult,
    startedAt: now + 1,
    completedAt: now + 2,
  });
  const executionMessage = `ZORYQ_OBEP_EXECUTION|${execution.executionId}|${execution.outputHash}`;
  const executionSignature = await executor.signMessage(executionMessage);

  const outcome = verifyOutcome(intent, execution, {
    verifier: verifier.address,
    accepted: verification.accepted,
    reason: verification.reason,
    verifiedAt: now + 3,
  });
  assert(outcome.accepted === true, 'payment must not proceed without accepted outcome');
  const outcomeMessage = `ZORYQ_OBEP_OUTCOME|${outcome.outcomeId}|${outcome.outputHash}`;
  const outcomeSignature = await verifier.signMessage(outcomeMessage);

  const binding = {
    protocol: 'ZORYQ_OBEP_ONCHAIN_V1',
    chainId: CHAIN_ID,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    outputHash: outcome.outputHash,
  };
  const commitment = hashObject(binding);
  const calldata = hexlify(toUtf8Bytes(`ZORYQ_OBEP_V1|${commitment}`));

  const tx = await treasury.sendTransaction({ to: executor.address, value: BigInt(PAYMENT_WEI), data: calldata });
  const mined = await tx.wait(1);
  assert(mined && mined.status === 1, 'payment transaction reverted');

  const rpcTx = await provider.getTransaction(tx.hash);
  const rpcReceipt = await provider.getTransactionReceipt(tx.hash);
  assert(rpcTx && rpcReceipt && rpcReceipt.status === 1, 'transaction unavailable or failed on public RPC');
  assert(rpcTx.from.toLowerCase() === treasury.address.toLowerCase(), 'onchain payer mismatch');
  assert(String(rpcTx.to).toLowerCase() === executor.address.toLowerCase(), 'onchain recipient mismatch');
  assert(rpcTx.value === BigInt(PAYMENT_WEI), 'onchain amount mismatch');
  assert(String(rpcTx.data).toLowerCase() === calldata.toLowerCase(), 'onchain commitment mismatch');

  const ledger = new ObepLedger();
  ledger.register(intent);
  const receipt = ledger.settle(intent, authorization, execution, outcome, {
    txHash: tx.hash,
    from: treasury.address,
    to: executor.address,
    amount: PAYMENT_WEI,
    chainId: CHAIN_ID,
    status: 'SUCCESS',
  });
  const accounting = ledger.reconcile(intent, receipt);
  const proofPack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });
  verifyProofPack(proofPack);

  const evidence = {
    protocol: 'ZORYQ_OBEP_USEFUL_TASK_LIVE_PROOF',
    version: '0.2.0',
    generatedAt: new Date().toISOString(),
    rpc: RPC,
    chainId: CHAIN_ID,
    taskVerification: {
      specification: task.specification,
      inputDigest: taskResult.inputDigest,
      taskOutputHash: taskResult.outputHash,
      recomputationAccepted: verification.accepted,
    },
    proofPack,
    roleAttestations: {
      authorization: { address: treasury.address, message: authorizationMessage, signature: authorizationSignature },
      execution: { address: executor.address, message: executionMessage, signature: executionSignature },
      outcome: { address: verifier.address, message: outcomeMessage, signature: outcomeSignature },
    },
    onchainBinding: {
      binding,
      commitment,
      calldata,
      txHash: tx.hash,
      blockNumber: rpcReceipt.blockNumber,
      blockHash: rpcReceipt.blockHash,
      from: rpcTx.from,
      to: rpcTx.to,
      value: rpcTx.value.toString(),
      status: rpcReceipt.status,
      faucetFundingTxHash: claim.txHash,
    },
    securityBoundary: {
      privateKeysPersisted: false,
      privateKeysEmitted: false,
      rolesIndependentWithinProof: true,
      externalHumanOrProjectIndependence: false,
      walletType: 'ephemeral-ci-only',
      network: 'public-centralized-testnet',
      productionClaim: false,
    },
  };

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({
    ok: true,
    protocol: evidence.protocol,
    chainId: CHAIN_ID,
    taskOutputHash: taskResult.outputHash,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    txHash: tx.hash,
    blockNumber: rpcReceipt.blockNumber,
    commitment,
    proofPackHash: proofPack.proofPackHash,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, protocol: 'ZORYQ_OBEP_USEFUL_TASK_LIVE_PROOF', error: error.message }));
  process.exit(1);
});
