import fs from 'node:fs';
import { createHash } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;
const EXIT_REJECTED = 83;
const REQUIRED_PHASES = Object.freeze([
  'genesis-loaded',
  'all-nodes-healthy',
  'common-finalized-checkpoint',
  'producer-loss-injected',
  'consensus-recovered',
  'network-partition-injected',
  'partition-healed',
  'node-restart-injected',
  'node-rejoined',
  'state-root-converged',
  'rpc-protection-verified',
  'debug-publicly-inaccessible'
]);

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ pass: false, status: 'LAUNCH_REHEARSAL_EVIDENCE_REJECTED', error: message }, null, 2)}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node launch-rehearsal-evidence.mjs --input <report.json>');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
function isHex64(v) { return /^[0-9a-f]{64}$/i.test(String(v || '')); }
function isHash(v) { return /^0x[0-9a-f]{64}$/i.test(String(v || '')); }
function timestamp(v) {
  if (typeof v !== 'string') return null;
  const n = Date.parse(v);
  return Number.isFinite(n) ? n : null;
}
function secretPath(value, path = '') {
  if (!value || typeof value !== 'object') return null;
  for (const [k, child] of Object.entries(value)) {
    const next = path ? `${path}.${k}` : k;
    const n = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['mnemonic','privatekey','secretkey','seedphrase','keystorepassword','jwtsecret'].includes(n)) return next;
    const nested = secretPath(child, next);
    if (nested) return nested;
  }
  return null;
}

const args = parseArgs(process.argv);
if (!args.input) fail('usage: node launch-rehearsal-evidence.mjs --input <report.json>');
let report;
try { report = JSON.parse(fs.readFileSync(args.input, 'utf8')); } catch { fail('rehearsal_report_invalid_json'); }

const blockers = [];
const secret = secretPath(report);
if (secret) blockers.push(`secret_material_field_present:${secret}`);
if (report.network !== 'ZORYQ Mainnet') blockers.push('network_name_invalid');
if (report.productionLike !== true) blockers.push('production_like_rehearsal_required');
if (report.synthetic === true || report.fixtureOnly === true) blockers.push('synthetic_or_fixture_rehearsal_forbidden');
const chainId = Number(report.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('chain_id_reuses_testnet');
if (!isHex64(report.genesisSha256)) blockers.push('genesis_sha256_invalid');
if (!isHex64(report.validatorRegistrySha256)) blockers.push('validator_registry_sha256_invalid');
if (!Array.isArray(report.nodes) || report.nodes.length < 4) blockers.push('node_count_below_policy');

const operators = new Set();
const regions = new Set();
const hosts = new Set();
const peerIds = new Set();
for (const node of Array.isArray(report.nodes) ? report.nodes : []) {
  if (!node || typeof node !== 'object') { blockers.push('node_record_invalid'); continue; }
  if (!node.operator || !node.region || !node.host || !node.peerId) blockers.push('node_identity_incomplete');
  if (node.operator) operators.add(String(node.operator));
  if (node.region) regions.add(String(node.region));
  if (node.host) hosts.add(String(node.host));
  if (node.peerId) peerIds.add(String(node.peerId));
  if (node.debugPublic === true) blockers.push(`debug_public:${node.name || node.peerId || 'unknown'}`);
  if (node.healthyBefore !== true || node.healthyAfter !== true) blockers.push(`node_health_failed:${node.name || node.peerId || 'unknown'}`);
  if (!isHash(node.finalizedHashBefore) || !isHash(node.finalizedHashAfter) || !isHash(node.stateRootAfter)) blockers.push(`node_checkpoint_invalid:${node.name || node.peerId || 'unknown'}`);
}
if (operators.size < 4) blockers.push('operator_count_below_policy');
if (regions.size < 3) blockers.push('region_count_below_policy');
if (hosts.size !== (report.nodes?.length || 0)) blockers.push('host_identity_not_unique');
if (peerIds.size !== (report.nodes?.length || 0)) blockers.push('peer_identity_not_unique');

const phases = Array.isArray(report.phases) ? report.phases : [];
const byName = new Map(phases.map(p => [p?.name, p]));
let previous = null;
for (const name of REQUIRED_PHASES) {
  const phase = byName.get(name);
  if (!phase) { blockers.push(`phase_missing:${name}`); continue; }
  if (phase.pass !== true) blockers.push(`phase_failed:${name}`);
  const at = timestamp(phase.observedAt);
  if (at === null) blockers.push(`phase_timestamp_invalid:${name}`);
  if (previous !== null && at !== null && at < previous) blockers.push(`phase_order_invalid:${name}`);
  if (at !== null) previous = at;
}

const beforeHashes = new Set((report.nodes || []).map(n => n.finalizedHashBefore).filter(Boolean));
const afterHashes = new Set((report.nodes || []).map(n => n.finalizedHashAfter).filter(Boolean));
const stateRoots = new Set((report.nodes || []).map(n => n.stateRootAfter).filter(Boolean));
if (beforeHashes.size !== 1) blockers.push('pre_fault_finalized_checkpoint_not_converged');
if (afterHashes.size !== 1) blockers.push('post_recovery_finalized_checkpoint_not_converged');
if (stateRoots.size !== 1) blockers.push('post_recovery_state_root_not_converged');
if (report.rpcProtectionVerified !== true) blockers.push('rpc_protection_not_verified');
if (report.publicDebugBlocked !== true) blockers.push('public_debug_not_blocked');
if (report.dataPersistenceVerified !== true) blockers.push('data_persistence_not_verified');
if (report.restartRecoveryVerified !== true) blockers.push('restart_recovery_not_verified');
if (report.partitionRecoveryVerified !== true) blockers.push('partition_recovery_not_verified');
if (report.producerFailoverVerified !== true) blockers.push('producer_failover_not_verified');

const canonical = JSON.stringify({
  network: report.network,
  chainId,
  genesisSha256: report.genesisSha256,
  validatorRegistrySha256: report.validatorRegistrySha256,
  nodes: (report.nodes || []).map(n => ({ operator: n.operator, region: n.region, host: n.host, peerId: n.peerId, finalizedHashAfter: n.finalizedHashAfter, stateRootAfter: n.stateRootAfter })),
  phases: phases.map(p => ({ name: p?.name, pass: p?.pass, observedAt: p?.observedAt }))
});
const evidenceSha256 = createHash('sha256').update(canonical).digest('hex');
const result = {
  pass: blockers.length === 0,
  status: blockers.length === 0 ? 'LAUNCH_REHEARSAL_EVIDENCE_ACCEPTED' : 'LAUNCH_REHEARSAL_EVIDENCE_REJECTED',
  network: report.network || null,
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  nodeCount: report.nodes?.length || 0,
  operatorCount: operators.size,
  regionCount: regions.size,
  phaseCount: phases.length,
  requiredPhases: REQUIRED_PHASES,
  evidenceSha256,
  blockers,
  rule: 'zoryq-mainnet-launch-rehearsal-evidence-v1'
};
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (blockers.length) process.exit(EXIT_REJECTED);
