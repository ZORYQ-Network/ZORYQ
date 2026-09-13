import crypto from 'node:crypto';
import fs from 'node:fs';
import { fixtures, fixtureDigest, FIXTURE_VERSION, stableJson } from './serial-equivalence-fixtures.mjs';

const initial = () => ({
  balances: { alice: 1000n, bob: 1000n, carol: 1000n, dave: 1000n, hot: 0n },
  nonces: { alice: 0, bob: 0, carol: 0, dave: 0, hot: 0 },
  storage: {}, receipts: [], reads: []
});
const clone = (x) => structuredClone(x);
const digest = (x) => crypto.createHash('sha256').update(stableJson(x)).digest('hex');

function apply(state, tx, index) {
  if ('from' in tx) {
    if ((state.balances[tx.from] ?? 0n) < tx.value) throw new Error(`insufficient balance: ${tx.from}`);
    state.balances[tx.from] -= tx.value;
    state.balances[tx.to] = (state.balances[tx.to] ?? 0n) + tx.value;
    state.nonces[tx.from] = (state.nonces[tx.from] ?? 0) + 1;
    state.receipts.push({ index, status: 1, from: tx.from, to: tx.to, value: tx.value });
    return;
  }
  const before = state.storage[tx.slot] ?? 0n;
  if (tx.op === 'read') {
    state.reads.push({ index, slot: tx.slot, value: before });
    state.receipts.push({ index, status: 1, read: before });
  } else if (tx.op === 'revert-write') {
    state.receipts.push({ index, status: 0, reverted: true, slot: tx.slot });
  } else if (tx.op === 'write') {
    state.storage[tx.slot] = tx.value;
    state.receipts.push({ index, status: 1, slot: tx.slot, before, after: tx.value });
  } else throw new Error(`unsupported op: ${tx.op}`);
}

function serial(fixture) {
  const state = initial();
  fixture.txs.forEach((tx, i) => apply(state, tx, i));
  return state;
}

// This is intentionally a correctness harness, not evidence that ZORYQ already has
// a production parallel executor. Until a real candidate executor is wired here,
// candidateMode remains serial-reference and the public claim boundary stays unchanged.
function candidate(fixture) {
  const state = initial();
  fixture.txs.forEach((tx, i) => apply(state, tx, i));
  return state;
}

const vectors = fixtures.map((fixture) => {
  const baseline = serial(fixture);
  const result = candidate(fixture);
  const baselineDigest = digest(baseline);
  const candidateDigest = digest(result);
  return { id: fixture.id, pass: baselineDigest === candidateDigest, baselineDigest, candidateDigest };
});
const pass = vectors.every(v => v.pass);
const report = {
  schemaVersion: '1.0.0', fixtureVersion: FIXTURE_VERSION, fixtureDigest,
  commit: process.env.GITHUB_SHA || 'local', chainId: 5919065,
  baselineMode: 'canonical-serial-reference', candidateMode: 'serial-reference-not-parallel',
  claimBoundary: 'Harness integrity only. This run does not prove adaptive or parallel execution, serial equivalence of a production candidate, consensus safety, decentralization, finality, or mainnet readiness.',
  vectors, pass
};
fs.mkdirSync('serial-equivalence-evidence', { recursive: true });
fs.writeFileSync('serial-equivalence-evidence/report.json', stableJson(report) + '\n');
fs.writeFileSync('serial-equivalence-evidence/report.sha256', `${digest(report)}  report.json\n`);
console.log(JSON.stringify(report, null, 2));
if (!pass) process.exit(1);
