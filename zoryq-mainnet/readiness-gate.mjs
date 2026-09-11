import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;
const EXIT_NOT_READY = 82;
const MAX_DOSSIER_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const REQUIRED_CONTROLS = Object.freeze([
  'execution-runtime',
  'genesis-ceremony',
  'validator-distribution',
  'consensus-multivalidator',
  'key-custody',
  'independent-security-audit',
  'contract-security',
  'recovery-drill',
  'incident-response',
  'observability-alerting',
  'rpc-abuse-protection',
  'supply-chain-provenance',
  'release-governance',
  'testnet-burn-in',
  'launch-approvals'
]);

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ ready: false, error: message }, null, 2)}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node readiness-gate.mjs --input <readiness.json>');
    args[argv[i].slice(2)] = argv[i + 1];
  }
  return args;
}
function sha256File(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function isHex64(value) { return /^[0-9a-f]{64}$/i.test(String(value || '')); }
function isCommit(value) { return /^[0-9a-f]{40}$/i.test(String(value || '')); }
function isImageDigest(value) { return /^sha256:[0-9a-f]{64}$/i.test(String(value || '')); }
function parseTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function containsSecretKey(value, currentPath = '') {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['mnemonic', 'privatekey', 'secretkey', 'seedphrase', 'keystorepassword'].includes(normalized)) return nextPath;
    const nested = containsSecretKey(child, nextPath);
    if (nested) return nested;
  }
  return null;
}
function validateConsensusEvidence(file, expectedChainId, blockers) {
  let evidence;
  try { evidence = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
    blockers.push('consensus_evidence_invalid_json');
    return;
  }
  if (evidence.rule !== 'zoryq-mainnet-multi-operator-evidence-v1') blockers.push('consensus_evidence_rule_invalid');
  if (evidence.pass !== true || evidence.status !== 'MULTI_OPERATOR_CONVERGENCE_EVIDENCE_ACCEPTED') blockers.push('consensus_evidence_not_accepted');
  if (evidence.network !== 'ZORYQ Mainnet') blockers.push('consensus_evidence_network_invalid');
  if (Number(evidence.chainId) !== expectedChainId) blockers.push('consensus_evidence_chain_id_mismatch');
  if (!Number.isSafeInteger(evidence.nodeCount) || evidence.nodeCount < 4) blockers.push('consensus_evidence_node_count_below_policy');
  if (!Number.isSafeInteger(evidence.operatorCount) || evidence.operatorCount < 4) blockers.push('consensus_evidence_operator_count_below_policy');
  if (!Number.isSafeInteger(evidence.regionCount) || evidence.regionCount < 3) blockers.push('consensus_evidence_region_count_below_policy');
  if (Array.isArray(evidence.blockers) && evidence.blockers.length) blockers.push('consensus_evidence_contains_blockers');
}
function validateGovernanceEvidence(file, expectedCommit, blockers) {
  let evidence;
  try { evidence = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {
    blockers.push('release_governance_evidence_invalid_json');
    return;
  }
  if (evidence.rule !== 'zoryq-mainnet-release-governance-evidence-v1') blockers.push('release_governance_rule_invalid');
  if (evidence.pass !== true || evidence.status !== 'RELEASE_GOVERNANCE_EVIDENCE_ACCEPTED') blockers.push('release_governance_not_accepted');
  if (evidence.repository !== 'ZORYQ-Network/ZORYQ') blockers.push('release_governance_repository_invalid');
  if (String(evidence.releaseCommit || '').toLowerCase() !== String(expectedCommit || '').toLowerCase()) blockers.push('release_governance_commit_mismatch');
  if (!Array.isArray(evidence.requiredChecks) || evidence.requiredChecks.length < 7) blockers.push('release_governance_required_checks_incomplete');
  if (Array.isArray(evidence.blockers) && evidence.blockers.length) blockers.push('release_governance_contains_blockers');
}

const args = parseArgs(process.argv);
if (!args.input) fail('usage: node readiness-gate.mjs --input <readiness.json>');
const dossierPath = path.resolve(args.input);
let dossier;
try { dossier = JSON.parse(fs.readFileSync(dossierPath, 'utf8')); } catch { fail('readiness_input_invalid_json'); }
const dossierDir = path.dirname(dossierPath);
const blockers = [];
const secretPath = containsSecretKey(dossier);
if (secretPath) blockers.push(`secret_material_field_present:${secretPath}`);

if (dossier.network !== 'ZORYQ Mainnet') blockers.push('network_name_invalid');
if (dossier.productionEvidence !== true) blockers.push('production_evidence_required');
if (dossier.fixtureOnly === true || dossier.synthetic === true) blockers.push('fixture_or_synthetic_evidence_forbidden');
const chainId = Number(dossier.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('chain_id_reuses_testnet');
if (!isHex64(dossier.genesisSha256)) blockers.push('genesis_sha256_not_pinned');
if (!isHex64(dossier.validatorRegistrySha256)) blockers.push('validator_registry_sha256_not_pinned');
if (!isCommit(dossier.releaseCommit)) blockers.push('release_commit_invalid');
if (!isImageDigest(dossier.imageDigest)) blockers.push('image_digest_invalid');

const generatedAt = parseTimestamp(dossier.generatedAt);
const expiresAt = parseTimestamp(dossier.expiresAt);
const now = Date.now();
if (generatedAt === null) blockers.push('generated_at_invalid');
if (expiresAt === null) blockers.push('expires_at_invalid');
if (generatedAt !== null && expiresAt !== null) {
  if (expiresAt <= generatedAt) blockers.push('dossier_time_window_invalid');
  if (expiresAt - generatedAt > MAX_DOSSIER_LIFETIME_MS) blockers.push('dossier_lifetime_too_long');
  if (now < generatedAt - 60_000) blockers.push('dossier_not_yet_valid');
  if (now >= expiresAt) blockers.push('dossier_expired');
}

const controls = dossier.controls && typeof dossier.controls === 'object' && !Array.isArray(dossier.controls) ? dossier.controls : {};
const verifiedEvidence = {};
for (const name of REQUIRED_CONTROLS) {
  const control = controls[name];
  if (!control) {
    blockers.push(`control_missing:${name}`);
    continue;
  }
  if (control.status !== 'pass') blockers.push(`control_not_passed:${name}`);
  if (!isHex64(control.evidenceSha256)) blockers.push(`control_evidence_hash_invalid:${name}`);
  const observedAt = parseTimestamp(control.observedAt);
  if (observedAt === null) blockers.push(`control_timestamp_invalid:${name}`);
  const evidencePath = String(control.evidencePath || '');
  if (!evidencePath || path.isAbsolute(evidencePath) || evidencePath.split(/[\\/]+/).includes('..')) {
    blockers.push(`control_evidence_path_invalid:${name}`);
  } else {
    const resolved = path.resolve(dossierDir, evidencePath);
    if (!resolved.startsWith(`${dossierDir}${path.sep}`) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      blockers.push(`control_evidence_missing:${name}`);
    } else if (isHex64(control.evidenceSha256)) {
      const actual = sha256File(resolved);
      if (actual.toLowerCase() !== String(control.evidenceSha256).toLowerCase()) {
        blockers.push(`control_evidence_hash_mismatch:${name}`);
      } else {
        verifiedEvidence[name] = { path: evidencePath, sha256: actual };
        if (name === 'consensus-multivalidator') validateConsensusEvidence(resolved, chainId, blockers);
        if (name === 'release-governance') validateGovernanceEvidence(resolved, dossier.releaseCommit, blockers);
      }
    }
  }
  if (name === 'independent-security-audit' && control.independent !== true) blockers.push('independent_audit_attestation_required');
  if (name === 'validator-distribution') {
    if (!Number.isSafeInteger(control.validatorCount) || control.validatorCount < 4) blockers.push('validator_count_below_policy');
    if (!Number.isSafeInteger(control.regionCount) || control.regionCount < 3) blockers.push('validator_region_count_below_policy');
    if (!Number.isSafeInteger(control.operatorCount) || control.operatorCount < 4) blockers.push('validator_operator_count_below_policy');
  }
  if (name === 'consensus-multivalidator') {
    if (!Number.isSafeInteger(control.faultTestsPassed) || control.faultTestsPassed < 3) blockers.push('consensus_fault_evidence_insufficient');
  }
  if (name === 'testnet-burn-in') {
    if (!Number.isFinite(control.continuousHours) || control.continuousHours < 168) blockers.push('testnet_burn_in_below_168_hours');
  }
}

const report = {
  ready: blockers.length === 0,
  status: blockers.length === 0 ? 'READY_FOR_CONTROLLED_MAINNET_LAUNCH' : 'NOT_READY_FOR_MAINNET',
  network: dossier.network || null,
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  releaseCommit: dossier.releaseCommit || null,
  imageDigest: dossier.imageDigest || null,
  requiredControls: REQUIRED_CONTROLS,
  verifiedControls: Object.keys(verifiedEvidence).sort(),
  verifiedEvidence,
  blockers,
  rule: 'zoryq-mainnet-readiness-v4-semantic-governance'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(EXIT_NOT_READY);
