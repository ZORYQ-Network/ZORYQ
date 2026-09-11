import fs from 'node:fs';
import { createHash } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;
const EXIT_NOT_READY = 82;
const REQUIRED_FAULT_TESTS = Object.freeze([
  'producer-loss',
  'network-partition-recovery',
  'node-restart-recovery'
]);

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ pass: false, error: message }, null, 2)}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node multi-operator-evidence.mjs --input <evidence.json>');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
function isHex64(value) { return /^[0-9a-f]{64}$/i.test(String(value || '')); }
function isHash(value) { return /^0x[0-9a-f]{64}$/i.test(String(value || '')); }
function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function canonicalSha256(value) {
  const canonical = JSON.stringify(value, Object.keys(value).sort());
  return createHash('sha256').update(canonical).digest('hex');
}
function hasSecretField(value, currentPath = '') {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const next = currentPath ? `${currentPath}.${key}` : key;
    if (['privatekey', 'secretkey', 'mnemonic', 'seedphrase', 'keystorepassword', 'jwtsecret'].includes(normalized)) return next;
    const nested = hasSecretField(child, next);
    if (nested) return nested;
  }
  return null;
}

const args = parseArgs(process.argv);
if (!args.input) fail('usage: node multi-operator-evidence.mjs --input <evidence.json>');
let evidence;
try { evidence = JSON.parse(fs.readFileSync(args.input, 'utf8')); } catch { fail('evidence_invalid_json'); }

const blockers = [];
const secretPath = hasSecretField(evidence);
if (secretPath) blockers.push(`secret_material_field_present:${secretPath}`);
if (evidence.network !== 'ZORYQ Mainnet') blockers.push('network_name_invalid');
if (evidence.productionEvidence !== true) blockers.push('production_evidence_required');
if (evidence.synthetic === true || evidence.fixtureOnly === true) blockers.push('synthetic_or_fixture_evidence_forbidden');
const chainId = Number(evidence.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('chain_id_reuses_testnet');
if (!isHex64(evidence.genesisSha256)) blockers.push('genesis_sha256_invalid');
if (!evidence.consensusEngine || ['dev', 'single-producer', 'mock', 'anvil'].includes(String(evidence.consensusEngine).toLowerCase())) blockers.push('production_consensus_engine_required');

const observedAt = parseTimestamp(evidence.observedAt);
if (observedAt === null) blockers.push('observed_at_invalid');
if (observedAt !== null && Math.abs(Date.now() - observedAt) > 15 * 60 * 1000) blockers.push('evidence_stale_over_15_minutes');

const nodes = Array.isArray(evidence.nodes) ? evidence.nodes : [];
if (nodes.length < 4) blockers.push('minimum_four_nodes_required');
const operators = new Set();
const regions = new Set();
const p2pIds = new Set();
const hosts = new Set();
const checkpoints = new Map();
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i] || {};
  const prefix = `node_${i}`;
  if (!node.operatorId) blockers.push(`${prefix}:operator_id_missing`); else operators.add(String(node.operatorId));
  if (!node.region) blockers.push(`${prefix}:region_missing`); else regions.add(String(node.region));
  if (!node.p2pNodeId) blockers.push(`${prefix}:p2p_node_id_missing`); else if (p2pIds.has(String(node.p2pNodeId))) blockers.push(`${prefix}:duplicate_p2p_node_id`); else p2pIds.add(String(node.p2pNodeId));
  if (!node.hostFingerprint) blockers.push(`${prefix}:host_fingerprint_missing`); else if (hosts.has(String(node.hostFingerprint))) blockers.push(`${prefix}:duplicate_host_fingerprint`); else hosts.add(String(node.hostFingerprint));
  if (Number(node.chainId) !== chainId) blockers.push(`${prefix}:chain_id_mismatch`);
  if (String(node.genesisSha256 || '').toLowerCase() !== String(evidence.genesisSha256 || '').toLowerCase()) blockers.push(`${prefix}:genesis_mismatch`);
  if (!Number.isSafeInteger(node.peerCount) || node.peerCount < 3) blockers.push(`${prefix}:peer_count_below_three`);
  if (node.publicDebugEnabled !== false) blockers.push(`${prefix}:public_debug_must_be_false`);
  if (!Number.isSafeInteger(node.headHeight) || node.headHeight < 1) blockers.push(`${prefix}:head_height_invalid`);
  if (!Number.isSafeInteger(node.finalizedHeight) || node.finalizedHeight < 1 || node.finalizedHeight > node.headHeight) blockers.push(`${prefix}:finalized_height_invalid`);
  if (!isHash(node.finalizedHash)) blockers.push(`${prefix}:finalized_hash_invalid`);
  const nodeObservedAt = parseTimestamp(node.observedAt);
  if (nodeObservedAt === null) blockers.push(`${prefix}:observed_at_invalid`);
  else if (observedAt !== null && Math.abs(nodeObservedAt - observedAt) > 120_000) blockers.push(`${prefix}:observation_outside_two_minute_window`);
  if (Number.isSafeInteger(node.finalizedHeight) && isHash(node.finalizedHash)) {
    const key = String(node.finalizedHeight);
    const set = checkpoints.get(key) || new Set();
    set.add(String(node.finalizedHash).toLowerCase());
    checkpoints.set(key, set);
  }
}
if (operators.size < 4) blockers.push('minimum_four_independent_operators_required');
if (regions.size < 3) blockers.push('minimum_three_regions_required');
if (p2pIds.size !== nodes.length) blockers.push('p2p_identity_uniqueness_failed');
if (hosts.size !== nodes.length) blockers.push('host_independence_failed');

const finalizedHeights = nodes.map((node) => node?.finalizedHeight).filter(Number.isSafeInteger);
if (finalizedHeights.length) {
  const spread = Math.max(...finalizedHeights) - Math.min(...finalizedHeights);
  if (spread > 2) blockers.push('finalized_height_spread_exceeds_two_blocks');
}
for (const [height, hashes] of checkpoints) {
  if (hashes.size > 1) blockers.push(`finalized_checkpoint_divergence:${height}`);
}
const commonCheckpoint = evidence.commonFinalizedCheckpoint || {};
if (!Number.isSafeInteger(commonCheckpoint.height) || commonCheckpoint.height < 1 || !isHash(commonCheckpoint.hash)) {
  blockers.push('common_finalized_checkpoint_invalid');
} else {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] || {};
    if (node.finalizedHeight < commonCheckpoint.height) blockers.push(`node_${i}:below_common_finalized_height`);
    if (node.checkpointHashes?.[String(commonCheckpoint.height)]?.toLowerCase() !== commonCheckpoint.hash.toLowerCase()) blockers.push(`node_${i}:common_checkpoint_hash_mismatch`);
  }
}

const faultTests = Array.isArray(evidence.faultTests) ? evidence.faultTests : [];
for (const required of REQUIRED_FAULT_TESTS) {
  const test = faultTests.find((item) => item?.name === required);
  if (!test) { blockers.push(`fault_test_missing:${required}`); continue; }
  if (test.status !== 'pass') blockers.push(`fault_test_not_passed:${required}`);
  if (!isHex64(test.evidenceSha256)) blockers.push(`fault_test_evidence_hash_invalid:${required}`);
  if (!Number.isFinite(test.recoverySeconds) || test.recoverySeconds < 0 || test.recoverySeconds > 300) blockers.push(`fault_test_recovery_over_300s:${required}`);
}

const report = {
  pass: blockers.length === 0,
  status: blockers.length === 0 ? 'MULTI_OPERATOR_CONVERGENCE_EVIDENCE_ACCEPTED' : 'MULTI_OPERATOR_CONVERGENCE_EVIDENCE_REJECTED',
  network: evidence.network || null,
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  consensusEngine: evidence.consensusEngine || null,
  nodeCount: nodes.length,
  operatorCount: operators.size,
  regionCount: regions.size,
  commonFinalizedCheckpoint: commonCheckpoint,
  faultTestsRequired: REQUIRED_FAULT_TESTS,
  blockers,
  evidenceSha256: canonicalSha256(evidence),
  rule: 'zoryq-mainnet-multi-operator-evidence-v1'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(EXIT_NOT_READY);
