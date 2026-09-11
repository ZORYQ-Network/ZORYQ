import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const VERIFIER = path.join(ROOT, 'launch-rehearsal-evidence.mjs');
function assert(ok, message) { if (!ok) throw new Error(message); }
function run(input) {
  const r = spawnSync(process.execPath, [VERIFIER, '--input', input], { encoding: 'utf8' });
  let body = {}; try { body = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, body };
}
function fixture() {
  const t0 = Date.now();
  const names = ['genesis-loaded','all-nodes-healthy','common-finalized-checkpoint','producer-loss-injected','consensus-recovered','network-partition-injected','partition-healed','node-restart-injected','node-rejoined','state-root-converged','rpc-protection-verified','debug-publicly-inaccessible'];
  const nodes = Array.from({ length: 4 }, (_, i) => ({
    name: `node-${i + 1}`,
    operator: `operator-${i + 1}`,
    region: ['us-east','eu-west','ap-south','us-east'][i],
    host: `host-${i + 1}.example.invalid`,
    peerId: `peer-${i + 1}`,
    debugPublic: false,
    healthyBefore: true,
    healthyAfter: true,
    finalizedHashBefore: `0x${'a'.repeat(64)}`,
    finalizedHashAfter: `0x${'b'.repeat(64)}`,
    stateRootAfter: `0x${'c'.repeat(64)}`
  }));
  return {
    network: 'ZORYQ Mainnet', productionLike: true, chainId: 5919066,
    genesisSha256: '1'.repeat(64), validatorRegistrySha256: '2'.repeat(64),
    nodes,
    phases: names.map((name, i) => ({ name, pass: true, observedAt: new Date(t0 + i * 1000).toISOString() })),
    rpcProtectionVerified: true, publicDebugBlocked: true, dataPersistenceVerified: true,
    restartRecoveryVerified: true, partitionRecoveryVerified: true, producerFailoverVerified: true
  };
}
function write(dir, data) { const p = path.join(dir, 'report.json'); fs.writeFileSync(p, JSON.stringify(data, null, 2)); return p; }

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-rehearsal-selftest-'));
try {
  let f = fixture(); let r = run(write(dir, f));
  assert(r.status === 0 && r.body.pass === true, `valid rehearsal rejected: ${JSON.stringify(r.body)}`);

  f = fixture(); f.chainId = 5919065; r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.includes('chain_id_reuses_testnet'), 'testnet chain id was not rejected');

  f = fixture(); f.nodes[3].operator = 'operator-1'; r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.includes('operator_count_below_policy'), 'operator concentration was not rejected');

  f = fixture(); f.nodes[2].stateRootAfter = `0x${'d'.repeat(64)}`; r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.includes('post_recovery_state_root_not_converged'), 'state divergence was not rejected');

  f = fixture(); f.publicDebugBlocked = false; f.nodes[0].debugPublic = true; r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.some(x => x.startsWith('debug_public:')) && r.body.blockers?.includes('public_debug_not_blocked'), 'public debug exposure was not rejected');

  f = fixture(); f.phases = f.phases.filter(p => p.name !== 'partition-healed'); r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.includes('phase_missing:partition-healed'), 'missing recovery phase was not rejected');

  f = fixture(); f.dataPersistenceVerified = false; r = run(write(dir, f));
  assert(r.status === 83 && r.body.blockers?.includes('data_persistence_not_verified'), 'missing persistence proof was not rejected');

  process.stdout.write(JSON.stringify({ ok: true, cases: ['valid-rehearsal','testnet-chain-rejection','operator-concentration-rejection','state-divergence-rejection','public-debug-rejection','missing-recovery-phase-rejection','persistence-rejection'] }, null, 2) + '\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
