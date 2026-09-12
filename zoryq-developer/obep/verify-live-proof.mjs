import fs from 'node:fs';
import {
  JsonRpcProvider,
  hexlify,
  toUtf8Bytes,
  verifyMessage,
} from 'ethers';
import { hashObject, verifyProofPack } from './obep.mjs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node verify-live-proof.mjs <live-proof.json>');
  process.exit(2);
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };

try {
  const evidence = JSON.parse(fs.readFileSync(path, 'utf8'));
  assert(evidence.protocol === 'ZORYQ_OBEP_LIVE_TESTNET_PROOF', 'wrong live proof protocol');
  assert(Number(evidence.chainId) === 5919065, 'wrong live proof chain');

  const proofResult = verifyProofPack(evidence.proofPack);
  const { intent, authorization, execution, outcome, receipt } = evidence.proofPack;

  const authAtt = evidence.roleAttestations.authorization;
  const execAtt = evidence.roleAttestations.execution;
  const outcomeAtt = evidence.roleAttestations.outcome;

  assert(verifyMessage(authAtt.message, authAtt.signature).toLowerCase() === intent.treasury, 'authorization signature mismatch');
  assert(authAtt.message === `ZORYQ_OBEP_AUTH|${intent.intentId}|${authorization.authorizationId}`, 'authorization message binding mismatch');
  assert(verifyMessage(execAtt.message, execAtt.signature).toLowerCase() === intent.executor, 'execution signature mismatch');
  assert(execAtt.message === `ZORYQ_OBEP_EXECUTION|${execution.executionId}|${execution.outputHash}`, 'execution message binding mismatch');
  assert(verifyMessage(outcomeAtt.message, outcomeAtt.signature).toLowerCase() === intent.verifier, 'outcome signature mismatch');
  assert(outcomeAtt.message === `ZORYQ_OBEP_OUTCOME|${outcome.outcomeId}|${outcome.outputHash}`, 'outcome message binding mismatch');

  const expectedBinding = {
    protocol: 'ZORYQ_OBEP_ONCHAIN_V1',
    chainId: 5919065,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    outputHash: outcome.outputHash,
  };
  const expectedCommitment = hashObject(expectedBinding);
  assert(hashObject(evidence.onchainBinding.binding) === hashObject(expectedBinding), 'onchain binding object mismatch');
  assert(evidence.onchainBinding.commitment === expectedCommitment, 'onchain commitment mismatch');
  const expectedCalldata = hexlify(toUtf8Bytes(`ZORYQ_OBEP_V1|${expectedCommitment}`));
  assert(String(evidence.onchainBinding.calldata).toLowerCase() === expectedCalldata.toLowerCase(), 'calldata commitment mismatch');

  const provider = new JsonRpcProvider(evidence.rpc, 5919065, { staticNetwork: true });
  const tx = await provider.getTransaction(evidence.onchainBinding.txHash);
  const chainReceipt = await provider.getTransactionReceipt(evidence.onchainBinding.txHash);
  assert(tx && chainReceipt, 'transaction unavailable from public RPC');
  assert(chainReceipt.status === 1, 'onchain receipt failed');
  assert(tx.from.toLowerCase() === intent.treasury, 'onchain payer differs from intent treasury');
  assert(String(tx.to).toLowerCase() === intent.executor, 'onchain recipient differs from intent executor');
  assert(tx.value.toString() === receipt.amount, 'onchain value differs from OBEP receipt');
  assert(String(tx.data).toLowerCase() === expectedCalldata.toLowerCase(), 'onchain calldata differs from OBEP commitment');
  assert(tx.hash.toLowerCase() === receipt.txHash.toLowerCase(), 'OBEP receipt tx hash mismatch');
  assert(Number(chainReceipt.blockNumber) === Number(evidence.onchainBinding.blockNumber), 'block number evidence mismatch');

  console.log(JSON.stringify({
    protocol: evidence.protocol,
    verified: true,
    chainId: 5919065,
    intentId: intent.intentId,
    outcomeId: outcome.outcomeId,
    txHash: tx.hash,
    blockNumber: chainReceipt.blockNumber,
    commitment: expectedCommitment,
    proofPackHash: proofResult.proofPackHash,
  }));
} catch (error) {
  console.error(JSON.stringify({ protocol: 'ZORYQ_OBEP_LIVE_TESTNET_PROOF', verified: false, error: error.message }));
  process.exit(1);
}
