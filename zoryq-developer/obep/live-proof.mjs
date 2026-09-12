import fs from 'node:fs';
import {
  Wallet,
  JsonRpcProvider,
  hexlify,
  keccak256,
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
} from './obep.mjs';

const BASE = (process.env.ZORYQ_PUBLIC_BASE_URL || 'https://zoryq-evm-node-live-production.up.railway.app').replace(/\/$/, '');
const RPC = `${BASE}/rpc`;
const CHAIN_ID = 5919065;
const PAYMENT_WEI = process.env.ZORYQ_OBEP_PAYMENT_WEI || parseEther('1').toString();
const OUT = process.argv[2] || 'zoryq-evidence/obep/live-proof.json';

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  assert(Number(health.body?.chainId ?? health.body?.chain?.chainId) === CHAIN_ID, 'health chain id mismatch');

  const faucetStatusResponse = await fetch(`${BASE}/faucet/status`);
  const faucetStatus = await faucetStatusResponse.json();
  assert(faucetStatusResponse.ok && faucetStatus?.ok === true, 'faucet status unavailable');
  if (faucetStatus.xAttestationRequired === true) {
    throw new Error('live OBEP proof intentionally blocked: faucet requires external X attestation');
  }

  // Keys exist only in this process and are never serialized into evidence.
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
  assert(/^0x[0-9a-fA-F]{64}$/.test(String(claim.txHash || '')), 'faucet did not return tx hash');

  const fundedBalance = await waitForBalance(provider, treasury.address, BigInt(PAYMENT_WEI));
  assert(fundedBalance > BigInt(PAYMENT_WEI), 'funded balance insufficient for payment plus gas');

  const now = Math.floor(Date.now() / 1000);
  const task = {
    type: 'OBEP_LIVE_TESTNET_RESULT',
    input: { a: 21, b: 2 },
    expected: 42,
  };
  const output = {
    result: 42,
    method: '21*2',
    evidenceClass: 'deterministic-ci-execution',
  };

  const intent = createIntentEnvelope({
    companyId: `company:obep-live:${treasury.address.toLowerCase()}`,
    goal: 'Produce an accepted result and settle a bounded native ZQ payment on ZORYQ Testnet',
    task,
    executor: executor.address,
    verifier: verifier.address,
    treasury: treasury.address,
    budget: PAYMENT_WEI,
    chainId: CHAIN_ID,
    nonce: `live-${Date.now()}-${treasury.address.toLowerCase()}`,
    validFrom: now - 30,
    validUntil: now + 900,
    policy: {
      maxPayment: PAYMENT_WEI,
      asset: 'ZQ_TESTNET_NATIVE',
      capability: 'OBEP_LIVE_TESTNET_RESULT',
      revocable: true,
    },
  });

  const authorization = authorizeIntent(intent, {
    authorizer: treasury.address,
    issuedAt: now,
  });
  const authorizationMessage = `ZORYQ_OBEP_AUTH|${intent.intentId}|${authorization.authorizationId}`;
  const authorizationSignature = await treasury.signMessage(authorizationMessage);

  const execution = recordExecution(intent, authorization, {
    executor: executor.address,
    output,
    startedAt: now + 1,
    completedAt: now + 2,
  });
  const executionMessage = `ZORYQ_OBEP_EXECUTION|${execution.executionId}|${execution.outputHash}`;
  const executionSignature = await executor.signMessage(executionMessage);

  const outcome = verifyOutcome(intent, execution, {
    verifier: verifier.address,
    accepted: output.result === task.expected,
    reason: 'deterministic expected result matched',
    verifiedAt: now + 3,
  });
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

  const tx = await treasury.sendTransaction({
    to: executor.address,
    value: BigInt(PAYMENT_WEI),
    data: calldata,
  });
  const mined = await tx.wait(1);
  assert(mined && mined.status === 1, 'payment transaction reverted');

  const rpcTx = await provider.getTransaction(tx.hash);
  const rpcReceipt = await provider.getTransactionReceipt(tx.hash);
  assert(rpcTx && rpcReceipt, 'transaction not independently retrievable from public RPC');
  assert(rpcReceipt.status === 1, 'public RPC reports failed transaction');
  assert(rpcTx.from.toLowerCase() === treasury.address.toLowerCase(), 'onchain payer mismatch');
  assert(String(rpcTx.to).toLowerCase() === executor.address.toLowerCase(), 'onchain recipient mismatch');
  assert(rpcTx.value === BigInt(PAYMENT_WEI), 'onchain payment amount mismatch');
  assert(String(rpcTx.data).toLowerCase() === calldata.toLowerCase(), 'onchain commitment calldata mismatch');

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
    protocol: 'ZORYQ_OBEP_LIVE_TESTNET_PROOF',
    version: '0.1.0',
    generatedAt: new Date().toISOString(),
    rpc: RPC,
    chainId: CHAIN_ID,
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
      walletType: 'ephemeral-ci-only',
      network: 'public-centralized-testnet',
      productionClaim: false,
    },
  };

  fs.mkdirSync(new URL('.', `file://${process.cwd()}/${OUT}`).pathname, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({
    ok: true,
    protocol: evidence.protocol,
    chainId: CHAIN_ID,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    txHash: tx.hash,
    blockNumber: rpcReceipt.blockNumber,
    commitment,
    proofPackHash: proofPack.proofPackHash,
  }));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, protocol: 'ZORYQ_OBEP_LIVE_TESTNET_PROOF', error: error.message }));
  process.exit(1);
});
