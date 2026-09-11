import fs from 'node:fs';
import { createHash, createPublicKey, verify } from 'node:crypto';

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
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node multi-operator-evidence.mjs --input <evidence.json> --registry <validator-registry.json>');
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
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const ordered = {};
  for (const key of Object.keys(value).sort()) ordered[key] = canonicalize(value[key]);
  return ordered;
}
function canonicalJson(value) { return JSON.stringify(canonicalize(value)); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonicalSha256(value) { return sha256(canonicalJson(value)); }
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
function loadRegistry(file) {
  let raw;
  let registry;
  try {
    raw = fs.readFileSync(file);
    registry = JSON.parse(raw.toString('utf8'));
  } catch {
    fail('validator_registry_invalid_or_unreadable');
  }
  if (registry?.formatVersion !== 2) fail('validator_registry_format_v2_required');
  if (registry?.network !== 'ZORYQ Mainnet') fail('validator_registry_network_invalid');
  if (registry?.containsPrivateKeyMaterial !== false) fail('validator_registry_private_key_safety_invalid');
  const validators = Array.isArray(registry.validators) ? registry.validators : [];
  if (validators.length < 4) fail('validator_registry_requires_at_least_four_validators');
  const byOperator = new Map();
  const canonicalAttestationKeys = new Set();
  for (const validator of validators) {
    const operatorId = String(validator?.operatorId || '').trim();
    const fingerprint = String(validator?.attestationKeyFingerprintSha256 || '').toLowerCase();
    const publicKeySpkiBase64 = validator?.attestationPublicKeySpkiBase64;
    if (!operatorId || !isHex64(fingerprint)) fail('validator_registry_operator_or_attestation_fingerprint_invalid');
    if (publicKeySpkiBase64 === undefined || publicKeySpkiBase64 === null || publicKeySpkiBase64 === '') fail(`validator_registry_attestation_key_missing:${operatorId}`);
    if (typeof publicKeySpkiBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(publicKeySpkiBase64)) fail(`validator_registry_attestation_key_invalid:${operatorId}`);
    let canonicalDer;
    try {
      const publicDer = Buffer.from(publicKeySpkiBase64, 'base64');
      if (!publicDer.length || publicDer.toString('base64') !== publicKeySpkiBase64) fail(`validator_registry_attestation_key_invalid:${operatorId}`);
      const publicKey = createPublicKey({ key: publicDer, format: 'der', type: 'spki' });
      if (publicKey.asymmetricKeyType !== 'ed25519') fail(`validator_registry_attestation_key_not_ed25519:${operatorId}`);
      canonicalDer = publicKey.export({ format: 'der', type: 'spki' });
    } catch (error) {
      if (String(error?.message || '').startsWith('validator_registry_')) throw error;
      fail(`validator_registry_attestation_key_invalid:${operatorId}`);
    }
    const computedFingerprint = sha256(canonicalDer);
    if (computedFingerprint !== fingerprint) fail(`validator_registry_attestation_fingerprint_mismatch:${operatorId}`);
    if (canonicalAttestationKeys.has(computedFingerprint)) fail(`validator_registry_duplicate_attestation_key:${operatorId}`);
    canonicalAttestationKeys.add(computedFingerprint);
    const key = operatorId.toLowerCase();
    if (byOperator.has(key)) fail(`validator_registry_duplicate_operator:${operatorId}`);
    byOperator.set(key, { ...validator, attestationKeyFingerprintSha256: computedFingerprint });
  }
  return { registry, byOperator, sha256: sha256(raw), attestationKeyCount: canonicalAttestationKeys.size };
}
function attestationStatement(evidence, node) {
  return canonicalJson({
    domain: 'zoryq-mainnet-multi-operator-node-attestation-v2-registry-bound',
    network: evidence.network,
    chainId: evidence.chainId,
    genesisSha256: evidence.genesisSha256,
    validatorRegistrySha256: evidence.validatorRegistrySha256,
    consensusEngine: evidence.consensusEngine,
    operatorId: node.operatorId,
    region: node.region,
    p2pNodeId: node.p2pNodeId,
    hostFingerprint: node.hostFingerprint,
    peerCount: node.peerCount,
    publicDebugEnabled: node.publicDebugEnabled,
    headHeight: node.headHeight,
    finalizedHeight: node.finalizedHeight,
    finalizedHash: node.finalizedHash,
    observedAt: node.observedAt,
    checkpointHashes: node.checkpointHashes || {}
  });
}
function verifyOperatorAttestation(evidence, node) {
  const attestation = node?.operatorAttestation;
  if (!attestation || attestation.algorithm !== 'ed25519') return { ok: false, reason: 'operator_attestation_missing_or_algorithm_invalid' };
  if (typeof attestation.publicKeySpkiBase64 !== 'string' || typeof attestation.signatureBase64 !== 'string') return { ok: false, reason: 'operator_attestation_material_invalid' };
  try {
    const publicDer = Buffer.from(attestation.publicKeySpkiBase64, 'base64');
    const signature = Buffer.from(attestation.signatureBase64, 'base64');
    if (publicDer.length < 32 || signature.length !== 64) return { ok: false, reason: 'operator_attestation_material_invalid' };
    const publicKey = createPublicKey({ key: publicDer, format: 'der', type: 'spki' });
    if (publicKey.asymmetricKeyType !== 'ed25519') return { ok: false, reason: 'operator_attestation_key_not_ed25519' };
    const canonicalDer = publicKey.export({ format: 'der', type: 'spki' });
    const ok = verify(null, Buffer.from(attestationStatement(evidence, node)), publicKey, signature);
    return {
      ok,
      reason: ok ? null : 'operator_attestation_signature_invalid',
      keyFingerprint: sha256(canonicalDer)
    };
  } catch {
    return { ok: false, reason: 'operator_attestation_material_invalid' };
  }
}

const args = parseArgs(process.argv);
if (!args.input || !args.registry) fail('usage: node multi-operator-evidence.mjs --input <evidence.json> --registry <validator-registry.json>');
const registryContext = loadRegistry(args.registry);
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
if (!isHex64(evidence.validatorRegistrySha256)) blockers.push('validator_registry_sha256_invalid');
else if (String(evidence.validatorRegistrySha256).toLowerCase() !== registryContext.sha256.toLowerCase()) blockers.push('validator_registry_sha256_mismatch');
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
const operatorKeys = new Set();
const authorizedRegistryOperators = new Set();
const checkpoints = new Map();
for (let i = 0; i < nodes.length; i++) {
  const node = nodes[i] || {};
  const prefix = `node_${i}`;
  const operatorId = String(node.operatorId || '').trim();
  if (!operatorId) blockers.push(`${prefix}:operator_id_missing`); else operators.add(operatorId);
  const registeredOperator = operatorId ? registryContext.byOperator.get(operatorId.toLowerCase()) : null;
  if (!registeredOperator) blockers.push(`${prefix}:operator_not_authorized_by_validator_registry`);
  else {
    authorizedRegistryOperators.add(operatorId.toLowerCase());
    if (String(node.region || '').toLowerCase() !== String(registeredOperator.region || '').toLowerCase()) blockers.push(`${prefix}:region_mismatch_with_validator_registry`);
  }
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

  const attestationResult = verifyOperatorAttestation(evidence, node);
  if (!attestationResult.ok) blockers.push(`${prefix}:${attestationResult.reason}`);
  else {
    if (operatorKeys.has(attestationResult.keyFingerprint)) blockers.push(`${prefix}:duplicate_operator_attestation_key`);
    else operatorKeys.add(attestationResult.keyFingerprint);
    if (registeredOperator && attestationResult.keyFingerprint !== registeredOperator.attestationKeyFingerprintSha256) blockers.push(`${prefix}:operator_attestation_key_not_authorized_by_validator_registry`);
  }

  if (Number.isSafeInteger(node.finalizedHeight) && isHash(node.finalizedHash)) {
    const key = String(node.finalizedHeight);
    const set = checkpoints.get(key) || new Set();
    set.add(String(node.finalizedHash).toLowerCase());
    checkpoints.set(key, set);
  }
}
if (operators.size < 4) blockers.push('minimum_four_independent_operators_required');
if (authorizedRegistryOperators.size < 4) blockers.push('minimum_four_registry_authorized_operators_required');
if (regions.size < 3) blockers.push('minimum_three_regions_required');
if (p2pIds.size !== nodes.length) blockers.push('p2p_identity_uniqueness_failed');
if (hosts.size !== nodes.length) blockers.push('host_independence_failed');
if (operatorKeys.size !== nodes.length) blockers.push('operator_attestation_key_independence_failed');

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
  registryAuthorizedOperatorCount: authorizedRegistryOperators.size,
  operatorAttestationKeyCount: operatorKeys.size,
  validatorRegistrySha256: registryContext.sha256,
  regionCount: regions.size,
  commonFinalizedCheckpoint: commonCheckpoint,
  faultTestsRequired: REQUIRED_FAULT_TESTS,
  blockers,
  evidenceSha256: canonicalSha256(evidence),
  rule: 'zoryq-mainnet-multi-operator-evidence-v4-registry-authorized-signed-operators'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(EXIT_NOT_READY);
