import assert from 'node:assert/strict';
import { buildCandidateSchedule } from './candidate-scheduler.mjs';

const txs = [
  { workload: 'independent-transfers', from: '0x0000000000000000000000000000000000000001', to: '0x0000000000000000000000000000000000000002', value: '1', raw: '0x01' },
  { workload: 'independent-transfers', from: '0x0000000000000000000000000000000000000003', to: '0x0000000000000000000000000000000000000004', value: '1', raw: '0x02' },
  { workload: 'same-sender-nonce-contention', from: '0x0000000000000000000000000000000000000001', to: '0x0000000000000000000000000000000000000005', value: '1', raw: '0x03' },
  { workload: 'single-storage-hotspot', from: '0x0000000000000000000000000000000000000006', to: '0x0000000000000000000000000000000000000009', data: '0xaa', raw: '0x04' },
  { workload: 'single-storage-hotspot', from: '0x0000000000000000000000000000000000000007', to: '0x0000000000000000000000000000000000000009', data: '0xbb', raw: '0x05' },
];

const { waves, telemetry } = buildCandidateSchedule(txs);
assert.equal(telemetry.scheduler, 'zoryq-candidate-wave-scheduler');
assert.equal(telemetry.schedulerMode, 'dependency-aware-wave-scheduling');
assert.equal(telemetry.transactionCount, txs.length);
assert(telemetry.waveCount >= 2, 'conflicting workload must create multiple waves');
assert(telemetry.maxWaveWidth >= 2, 'independent workload should share a wave');
assert(telemetry.conflictCount > 0, 'conflicting workload must emit conflict evidence');
assert.equal(telemetry.reexecutionCount, 0, 'scheduler must not fabricate re-execution evidence');
assert(telemetry.claimBoundary.includes('does not prove parallel EVM state execution'));
assert.equal(waves.flat().length, txs.length);
console.log(JSON.stringify(telemetry, null, 2));
