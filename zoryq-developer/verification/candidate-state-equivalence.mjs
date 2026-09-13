import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { executeCandidateSchedule } from './candidate-scheduler.mjs';

const require = createRequire(import.meta.url);
const { HDNodeWallet, JsonRpcProvider, parseEther } = require('../../zoryq-evm-node/node_modules/ethers');

const CHAIN_ID = 5919065;
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const CANDIDATE_RPC = process.env.ZORYQ_CANDIDATE_RPC || 'http://127.0.0.1:8081/rpc';
const SERIAL_RPC = process.env.ZORYQ_SERIAL_RPC || 'http://127.0.0.1:8082/rpc';
const CANDIDATE_BASE = process.env.ZORYQ_CANDIDATE_BASE || CANDIDATE_RPC.replace(/\/rpc$/, '');
const SERIAL_BASE = process.env.ZORYQ_SERIAL_BASE || SERIAL_RPC.replace(/\/rpc$/, '');
const OUT = process.env.ZORYQ_CANDIDATE_EQ_OUT || 'candidate-state-equivalence.json';
const providerA = new JsonRpcProvider(CANDIDATE_RPC, CHAIN_ID, { staticNetwork: true });
const providerB = new JsonRpcProvider(SERIAL_RPC, CHAIN_ID, { staticNetwork: true });
const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function derive(index, provider) {
  return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function waitReady(base) {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) {
        const j = await r.json();
        if (Number(j?.chain?.chainId ?? j?.chainId) === CHAIN_ID) return j;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error(`node not ready: ${base}`);
}

async function snapshot(provider, addresses) {
  const out = {};
  for (const address of addresses) {
    out[address.toLowerCase()] = {
      balance: (await provider.getBalance(address)).toString(),
      nonce: await provider.getTransactionCount(address),
    };
  }
  return out;
}

async function main() {
  await Promise.all([waitReady(CANDIDATE_BASE), waitReady(SERIAL_BASE)]);
  const walletsA = Array.from({ length: 6 }, (_, i) => derive(i + 1, providerA));
  const walletsB = Array.from({ length: 6 }, (_, i) => derive(i + 1, providerB));
  for (let i = 0; i < walletsA.length; i++) assert.equal(walletsA[i].address.toLowerCase(), walletsB[i].address.toLowerCase());

  const addresses = walletsA.map(w => w.address);
  const initialA = await snapshot(providerA, addresses);
  const initialB = await snapshot(providerB, addresses);
  assert.deepEqual(initialA, initialB, 'isolated nodes did not start from identical account state');

  const gasPrice = (await providerA.getFeeData()).gasPrice || 1_000_000_000n;
  const nonce = new Map();
  for (const w of walletsA) nonce.set(w.address, await providerA.getTransactionCount(w.address));
  const takeNonce = (w) => { const n = nonce.get(w.address); nonce.set(w.address, n + 1); return n; };
  const items = [];

  async function add(workload, fromIndex, toIndex, value) {
    const wallet = walletsA[fromIndex];
    const n = takeNonce(wallet);
    const raw = await wallet.signTransaction({ chainId: CHAIN_ID, nonce: n, to: walletsA[toIndex].address, value, gasLimit: 21000n, gasPrice, type: 0 });
    items.push({ workload, from: wallet.address, to: walletsA[toIndex].address, value: value.toString(), nonce: n, raw });
  }

  // Disjoint transfers: scheduler should place these together when resources do not overlap.
  await add('independent-transfers', 0, 1, parseEther('0.011'));
  await add('independent-transfers', 2, 3, parseEther('0.013'));
  // Same sender: nonce and balance dependencies must serialize.
  await add('same-sender-nonce-contention', 0, 4, 1001n);
  await add('same-sender-nonce-contention', 0, 5, 1002n);
  // Hot receiver: balance dependency must be detected by the candidate scheduler.
  await add('hot-receiver', 1, 5, 2001n);
  await add('hot-receiver', 3, 5, 2002n);

  const candidate = await executeCandidateSchedule(items, {
    broadcast: async (raw) => (await providerA.broadcastTransaction(raw)).hash,
    waitReceipt: async (hash) => {
      const r = await providerA.waitForTransaction(hash, 1, 120000);
      assert(r, `missing candidate receipt ${hash}`);
      return r;
    },
  });

  // Replay the exact observed candidate canonical order on the isolated serial reference node.
  const serialReceipts = [];
  for (const item of candidate.receipts) {
    const tx = await providerB.broadcastTransaction(item.raw);
    const receipt = await providerB.waitForTransaction(tx.hash, 1, 120000);
    assert(receipt, `missing serial receipt ${tx.hash}`);
    serialReceipts.push({ hash: tx.hash, status: Number(receipt.status), gasUsed: receipt.gasUsed.toString() });
  }

  const finalA = await snapshot(providerA, addresses);
  const finalB = await snapshot(providerB, addresses);
  const stateEqual = JSON.stringify(finalA) === JSON.stringify(finalB);
  const candidateStatuses = candidate.receipts.map(r => ({ hash: r.hash, status: r.status, gasUsed: r.gasUsed }));
  const receiptEqual = JSON.stringify(candidateStatuses) === JSON.stringify(serialReceipts);
  const telemetry = candidate.telemetry;

  assert(telemetry.conflictCount > 0, 'expected intentionally conflicting workload to produce scheduler conflicts');
  assert(telemetry.waveCount > 1, 'expected more than one scheduler wave');
  assert(telemetry.maxWaveWidth > 1, 'expected at least one independent multi-transaction wave');
  assert.equal(telemetry.reexecutionCount, 0, 'speculative re-execution is not implemented and must not be fabricated');
  assert.equal(stateEqual, true, 'candidate-scheduled final account state differs from serial replay');
  assert.equal(receiptEqual, true, 'candidate-scheduled receipts differ from serial replay');

  const evidence = {
    schemaVersion: 1,
    commit: process.env.GITHUB_SHA || 'local',
    chainId: CHAIN_ID,
    schedulerTelemetry: telemetry,
    orderedTransactionHashes: candidate.receipts.map(r => r.hash),
    equality: { accountState: stateEqual, receiptStatusAndGas: receiptEqual },
    candidateFinalState: finalA,
    serialFinalState: finalB,
    claimStatus: 'CANDIDATE_SCHEDULER_STATE_EQUIVALENCE_TRANSFER_MATRIX',
    claimBoundary: 'This demonstrates state/receipt equivalence for the published native-transfer matrix when transactions are grouped by the ZORYQ dependency-aware candidate scheduler and executed through Reth. It does not prove parallel EVM state execution, speculative re-execution, consensus safety, decentralization, finality, performance superiority, or mainnet readiness.'
  };
  evidence.evidenceSha256 = sha256(JSON.stringify(evidence));
  await writeFile(OUT, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUT, conflicts: telemetry.conflictCount, waves: telemetry.waveCount, maxWaveWidth: telemetry.maxWaveWidth, stateEqual, receiptEqual, evidenceSha256: evidence.evidenceSha256 }, null, 2));
}

main().catch(async (error) => {
  await writeFile(OUT, `${JSON.stringify({ schemaVersion: 1, claimStatus: 'FAIL', error: error?.stack || String(error) }, null, 2)}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});
