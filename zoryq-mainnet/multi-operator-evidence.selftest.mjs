import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const gate = path.resolve('zoryq-mainnet/multi-operator-evidence.mjs');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-multi-operator-'));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const checkpointHash = `0x${'ab'.repeat(32)}`;
const genesis = hash('zoryq-mainnet-genesis');
const now = new Date().toISOString();

function fixture() {
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    operatorId: `operator-${i + 1}`,
    region: ['sa-east', 'us-east', 'eu-west', 'sa-east'][i],
    p2pNodeId: `enode-${i + 1}-${hash(`p2p-${i}`).slice(0, 24)}`,
    hostFingerprint: hash(`host-${i}`),
    chainId: 881122,
    genesisSha256: genesis,
    peerCount: 3,
    publicDebugEnabled: false,
    headHeight: 1002 + (i % 2),
    finalizedHeight: 1000 + (i % 2),
    finalizedHash: checkpointHash,
    observedAt: now,
    checkpointHashes: { '1000': checkpointHash }
  }));
  return {
    network: 'ZORYQ Mainnet',
    productionEvidence: true,
    synthetic: false,
    fixtureOnly: false,
    chainId: 881122,
    genesisSha256: genesis,
    consensusEngine: 'zoryq-bft-rehearsal',
    observedAt: now,
    commonFinalizedCheckpoint: { height: 1000, hash: checkpointHash },
    nodes,
    faultTests: [
      { name: 'producer-loss', status: 'pass', evidenceSha256: hash('producer-loss'), recoverySeconds: 41 },
      { name: 'network-partition-recovery', status: 'pass', evidenceSha256: hash('partition'), recoverySeconds: 96 },
      { name: 'node-restart-recovery', status: 'pass', evidenceSha256: hash('restart'), recoverySeconds: 53 }
    ]
  };
}

function run(name, evidence, shouldPass, expectedBlocker = null) {
  const file = path.join(temp, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(evidence, null, 2)}\n`);
  const result = spawnSync(process.execPath, [gate, '--input', file], { encoding: 'utf8' });
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`${name}: invalid gate output: ${result.stdout}\n${result.stderr}`); }
  if (shouldPass && (result.status !== 0 || report.pass !== true)) throw new Error(`${name}: expected pass, got ${result.status}: ${result.stdout}`);
  if (!shouldPass && (result.status === 0 || report.pass !== false)) throw new Error(`${name}: expected rejection, got ${result.status}: ${result.stdout}`);
  if (expectedBlocker && !report.blockers.some((item) => item.includes(expectedBlocker))) throw new Error(`${name}: missing blocker ${expectedBlocker}: ${result.stdout}`);
  process.stdout.write(`${name}: ${shouldPass ? 'accepted' : 'rejected'} as expected\n`);
  return report;
}

try {
  const baseline = fixture();
  const baselineReport = run('valid', baseline, true);

  const nestedMutation = fixture();
  nestedMutation.nodes[0].hostFingerprint = hash('host-0-mutated');
  const nestedMutationReport = run('nested-digest-mutation', nestedMutation, true);
  if (nestedMutationReport.evidenceSha256 === baselineReport.evidenceSha256) {
    throw new Error('nested evidence mutation did not change evidenceSha256');
  }
  process.stdout.write('nested evidence fields are bound into evidenceSha256\n');

  const reordered = {
    faultTests: baseline.faultTests,
    nodes: baseline.nodes,
    commonFinalizedCheckpoint: baseline.commonFinalizedCheckpoint,
    observedAt: baseline.observedAt,
    consensusEngine: baseline.consensusEngine,
    genesisSha256: baseline.genesisSha256,
    chainId: baseline.chainId,
    fixtureOnly: baseline.fixtureOnly,
    synthetic: baseline.synthetic,
    productionEvidence: baseline.productionEvidence,
    network: baseline.network
  };
  const reorderedReport = run('canonical-key-order', reordered, true);
  if (reorderedReport.evidenceSha256 !== baselineReport.evidenceSha256) {
    throw new Error('canonical digest changed after top-level key reordering');
  }
  process.stdout.write('evidenceSha256 is stable across object key ordering\n');

  const reusedTestnet = fixture();
  reusedTestnet.chainId = 5919065;
  reusedTestnet.nodes.forEach((node) => { node.chainId = 5919065; });
  run('testnet-chain-id', reusedTestnet, false, 'chain_id_reuses_testnet');

  const duplicateOperator = fixture();
  duplicateOperator.nodes[3].operatorId = duplicateOperator.nodes[0].operatorId;
  run('operator-concentration', duplicateOperator, false, 'minimum_four_independent_operators_required');

  const duplicateHost = fixture();
  duplicateHost.nodes[3].hostFingerprint = duplicateHost.nodes[0].hostFingerprint;
  run('host-reuse', duplicateHost, false, 'duplicate_host_fingerprint');

  const debugExposed = fixture();
  debugExposed.nodes[2].publicDebugEnabled = true;
  run('public-debug', debugExposed, false, 'public_debug_must_be_false');

  const divergentCheckpoint = fixture();
  divergentCheckpoint.nodes[1].checkpointHashes['1000'] = `0x${'cd'.repeat(32)}`;
  run('checkpoint-divergence', divergentCheckpoint, false, 'common_checkpoint_hash_mismatch');

  const weakFaultEvidence = fixture();
  weakFaultEvidence.faultTests[1].status = 'fail';
  run('fault-test-failure', weakFaultEvidence, false, 'fault_test_not_passed:network-partition-recovery');

  process.stdout.write('multi-operator evidence adversarial self-test: PASS\n');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
