import fs from 'node:fs';
import { createHash, verify } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;

function fail(message, code = 2) {
  process.stderr.write(`[zoryq-mainnet] ${message}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('usage: node launch-certificate.mjs --manifest <file> --policy <file> --approvals <file>');
    args[key.slice(2)] = value;
  }
  return args;
}
function loadJson(file, label) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail(`${label} is not valid JSON: ${file}`); }
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonical(value)));
}
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function isHex64(value) {
  return /^[0-9a-f]{64}$/.test(String(value || '').toLowerCase());
}
function isCommit(value) {
  return /^[0-9a-f]{40}$/.test(String(value || '').toLowerCase());
}
function isImageDigest(value) {
  return /^sha256:[0-9a-f]{64}$/.test(String(value || '').toLowerCase());
}

const args = parseArgs(process.argv);
if (!args.manifest || !args.policy || !args.approvals) {
  fail('usage: node launch-certificate.mjs --manifest <file> --policy <file> --approvals <file>');
}

const manifest = loadJson(args.manifest, 'manifest');
const policy = loadJson(args.policy, 'policy');
const approvals = loadJson(args.approvals, 'approvals');
const blockers = [];

const chainId = Number(manifest.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('testnet_chain_id_forbidden');
if (!isHex64(manifest.genesisSha256)) blockers.push('genesis_hash_invalid');
if (!isCommit(manifest.releaseCommit)) blockers.push('release_commit_invalid');
if (!isImageDigest(manifest.imageDigest)) blockers.push('image_digest_invalid');
if (!isHex64(manifest.auditReportSha256)) blockers.push('audit_report_hash_invalid');
if (!isHex64(manifest.incidentRunbookSha256)) blockers.push('incident_runbook_hash_invalid');
if (!isHex64(manifest.recoveryDrillSha256)) blockers.push('recovery_drill_hash_invalid');
if (manifest.network !== 'ZORYQ Mainnet') blockers.push('network_name_invalid');
if (manifest.devMode === true) blockers.push('dev_mode_forbidden');
if (manifest.faucetEnabled === true) blockers.push('faucet_forbidden');
if (manifest.debugPublic === true) blockers.push('public_debug_forbidden');

const signers = Array.isArray(policy.signers) ? policy.signers : [];
const threshold = Number(policy.threshold);
const requiredRoles = Array.isArray(policy.requiredRoles) ? policy.requiredRoles : [];
if (!Number.isSafeInteger(threshold) || threshold < 2 || threshold > signers.length) blockers.push('approval_threshold_invalid');
if (requiredRoles.length < 2) blockers.push('required_roles_invalid');

const signerById = new Map();
for (const signer of signers) {
  const id = String(signer?.id || '');
  const role = String(signer?.role || '');
  const publicKeyPem = String(signer?.publicKeyPem || '');
  if (!id || signerById.has(id) || !role || !publicKeyPem.includes('BEGIN PUBLIC KEY')) {
    blockers.push('signer_policy_invalid');
    continue;
  }
  signerById.set(id, { id, role, publicKeyPem });
}

const payload = canonicalBytes(manifest);
const manifestSha256 = sha256(payload);
const validIds = new Set();
const validRoles = new Set();
const rejectedApprovals = [];
for (const approval of Array.isArray(approvals.approvals) ? approvals.approvals : []) {
  const signerId = String(approval?.signerId || '');
  const signer = signerById.get(signerId);
  if (!signer || validIds.has(signerId)) {
    rejectedApprovals.push({ signerId, reason: signer ? 'duplicate_signer' : 'unknown_signer' });
    continue;
  }
  let signature;
  try { signature = Buffer.from(String(approval?.signature || ''), 'base64'); } catch {
    rejectedApprovals.push({ signerId, reason: 'invalid_signature_encoding' });
    continue;
  }
  let valid = false;
  try { valid = verify(null, payload, signer.publicKeyPem, signature); } catch {}
  if (!valid) {
    rejectedApprovals.push({ signerId, reason: 'signature_verification_failed' });
    continue;
  }
  validIds.add(signerId);
  validRoles.add(signer.role);
}

if (validIds.size < threshold) blockers.push('approval_threshold_not_met');
for (const role of requiredRoles) {
  if (!validRoles.has(String(role))) blockers.push(`required_role_missing:${role}`);
}

const report = {
  ok: blockers.length === 0,
  network: manifest.network || null,
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  manifestSha256,
  validApprovals: [...validIds],
  validRoles: [...validRoles].sort(),
  threshold,
  requiredRoles,
  rejectedApprovals,
  blockers,
  policy: 'threshold-ed25519-offline-approvals-v1'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(79);
