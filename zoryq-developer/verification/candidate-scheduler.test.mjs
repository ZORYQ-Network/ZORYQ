import assert from 'node:assert/strict';
import { buildCandidateSchedule } from './candidate-scheduler.mjs';

const A = '0x0000000000000000000000000000000000000001';
const txs = [
  { workload: 'independent-transfers', from: A, to: '0x0000000000000000000000000000000000000002', value: '1', nonce: 0, raw: '0x01' },
  { workload: 'independent-transfers', from: '0x0000000000000000000000000000000000000003', to: '0x0000000000000000000000000000000000000004', value: '1', nonce: 0, raw: '0x02' },
  { workload: 'same-sender-nonce-contention', from: A, to: '0x0000000000000000000000000000000000000005', value: '1', nonce: 1, raw: '0x03' },
  { workload: 'single-storage-hotspot', from: '0x0000000000000000000000000000000000000006', to: '0x0000000000000000000000000000000000000009', data: '0xaa', nonce: 0, raw: '0x04' },
  { workload: 'single-storage-hotspot', from: '0x0000000000000000000000000000000000000007', to: '0x0000000000000000000000000000000000000009', data: '0xbb', nonce: 0, raw: '0x05' },
  // Regression: this higher nonce must never be colored back into an earlier wave.
  { workload: 'same-sender-nonce-contention', from: A, to: '0x0000000000000000000000000000000000000008', value: '1', nonce: 2, raw: '0x06' },
];

const { waves, telemetry } = buildCandidateSchedule(txs);
assert.equal(telemetry.scheduler, 'zoryq-candidate-wave-scheduler');
assert.equal(telemetry.schedulerMode, 'directed-dependency-wave-scheduling');
assert.equal(telemetry.transactionCount, txs.length);
assert(telemetry.waveCount >= 3, 'same-sender nonce chain must advance through later waves');
assert(telemetry.maxWaveWidth >= 2, 'independent workload should share a wave');
assert(telemetry.conflictCount > 0, 'conflicting workload must emit conflict evidence');
assert.equal(telemetry.dependencyOrderValid, true);
assert.equal(telemetry.senderNonceOrderValid, true);
assert.equal(telemetry.reexecutionCount, 0, 'scheduler must not fabricate re-execution evidence');
assert(telemetry.claimBoundary.includes('does not prove parallel EVM state execution'));
assert.equal(waves.flat().length, txs.length);

const senderA = waves.flat().filter((item) => item.from.toLowerCase() === A.toLowerCase()).sort((x, y) => x.nonce - y.nonce);
assert.deepEqual(senderA.map((item) => item.nonce), [0, 1, 2]);
assert(senderA[0].schedulerWave < senderA[1].schedulerWave && senderA[1].schedulerWave < senderA[2].schedulerWave, 'sender nonces must execute in strictly increasing waves');

for (const conflict of telemetry.conflictPairs) {
  const earlier = waves.flat().find((item) => item.canonicalIndex === conflict.earlier);
  const later = waves.flat().find((item) => item.canonicalIndex === conflict.later);
  assert(earlier.schedulerWave < later.schedulerWave, 'every directed conflict must execute in a later wave');
}

console.log(JSON.stringify(telemetry, null, 2));
