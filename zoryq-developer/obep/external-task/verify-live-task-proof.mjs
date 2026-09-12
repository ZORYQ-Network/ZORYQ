import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { JsonRpcProvider, hexlify, toUtf8Bytes, verifyMessage } from 'ethers';
import { hashObject, verifyProofPack } from '../obep.mjs';

const evidencePath = process.argv[2];
if (!evidencePath) {
  console.error('usage: node verify-live-task-proof.mjs <external-task-live-proof.json>');
  process.exit(2);
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const HERE = path.dirname(new URL(import.meta.url).pathname);
const INPUT = path.join(HERE, 'records.json');
const COMPUTE = path.join(HERE, 'compute-task.mjs');

try {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  assert(evidence.protocol === 'ZORYQ_OBEP_USEFUL_TASK_LIVE_PROOF', 'wrong useful-task proof protocol');
  assert(Number(evidence.chainId) === 5919065, 'wrong chain');

  const recompute = spawnSync(process.execPath, [COMPUTE, INPUT], { encoding: 'utf8' });
  assert(recompute.status === 0, recompute.stderr || 'task recomputation failed');
  const recomputed = JSON.parse(recompute.stdout);
  assert(evidence.taskVerification?.recomputationAccepted === true, 'stored task verification not accepted');
  assert(evidence.taskVerification?.inputDigest === recomputed.inputDigest, 'input digest mismatch');
  assert(evidence.taskVerification?.taskOutputHash === recomputed.outputHash, 'task output hash mismatch');

  const proofResult = verifyProofPack(evidence.proofPack);
  const { intent, authorization, execution, outcome, receipt } = evidence.proofPack;
  assert(JSON.stringify(execution.output) === JSON.stringify(recomputed), 'execution output differs from independently recomputed useful-task output');

  const authAtt = evidence.roleAttestations.authorization;
  const execAtt = evidence.roleAttestations.execution;
  const outcomeAtt = evidence.roleAttestations.outcome;
  assert(verifyMessage(authAtt.message, authAtt.signature).toLowerCase() === intent.treasury, 'authorization signature mismatch');
  assert(authAtt.message === `ZORYQ_OBEP_AUTH|${intent.intentId}|${authorization.authorizationId}`, 'authorization message mismatch');
  assert(verifyMessage(execAtt.message, execAtt.signature).toLowerCase() === intent.executor, 'execution signature mismatch');
  assert(execAtt.message === `ZORYQ_OBEP_EXECUTION|${execution.executionId}|${execution.outputHash}`, 'execution message mismatch');
  assert(verifyMessage(outcomeAtt.message, outcomeAtt.signature).toLowerCase() === intent.verifier, 'outcome signature mismatch');
  assert(outcomeAtt.message === `ZORYQ_OBEP_OUTCOME|${outcome.outcomeId}|${outcome.outputHash}`, 'outcome message mismatch');

  const binding = {
    protocol: 'ZORYQ_OBEP_ONCHAIN_V1',
    chainId: 5919065,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    outputHash: outcome.outputHash,
  };
  const commitment = hashObject(binding);
  assert(evidence.onchainBinding.commitment === commitment, 'commitment mismatch');
  const calldata = hexlify(toUtf8Bytes(`ZORYQ_OBEP_V1|${commitment}`));
  assert(String(evidence.onchainBinding.calldata).toLowerCase() === calldata.toLowerCase(), 'stored calldata mismatch');

  const provider = new JsonRpcProvider(evidence.rpc, 5919065, { staticNetwork: true });
  const tx = await provider.getTransaction(evidence.onchainBinding.txHash);
  const chainReceipt = await provider.getTransactionReceipt(evidence.onchainBinding.txHash);
  assert(tx && chainReceipt, 'transaction unavailable from public RPC');
  assert(chainReceipt.status === 1, 'transaction failed on public RPC');
  assert(tx.from.toLowerCase() === intent.treasury, 'payer mismatch');
  assert(String(tx.to).toLowerCase() === intent.executor, 'recipient mismatch');
  assert(tx.value.toString() === receipt.amount, 'amount mismatch');
  assert(String(tx.data).toLowerCase() === calldata.toLowerCase(), 'calldata commitment mismatch');
  assert(tx.hash.toLowerCase() === receipt.txHash.toLowerCase(), 'receipt tx hash mismatch');

  console.log(JSON.stringify({
    protocol: evidence.protocol,
    verified: true,
    chainId: 5919065,
    taskOutputHash: recomputed.outputHash,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    txHash: tx.hash,
    blockNumber: chainReceipt.blockNumber,
    commitment,
    proofPackHash: proofResult.proofPackHash,
  }));
} catch (error) {
  console.error(JSON.stringify({ protocol: 'ZORYQ_OBEP_USEFUL_TASK_LIVE_PROOF', verified: false, error: error.message }));
  process.exit(1);
}
