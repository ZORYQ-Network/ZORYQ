import fs from 'node:fs';

const inputIndex = process.argv.indexOf('--input');
const input = inputIndex >= 0 ? process.argv[inputIndex + 1] : null;
const allowFixture = process.argv.includes('--allow-fixture');
const blockers = [];

function emit(report, code = 0) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exit(code);
}
function isHex64(value) { return /^[0-9a-f]{64}$/i.test(String(value || '')); }
function secretField(value, currentPath = '') {
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const next = currentPath ? `${currentPath}.${key}` : key;
    if (['privatekey','secretkey','mnemonic','seedphrase','recoveryphrase','password','pin'].includes(normalized)) return next;
    const nested = secretField(child, next);
    if (nested) return nested;
  }
  return null;
}

if (!input) emit({ pass: false, error: 'usage: node key-custody-evidence.mjs --input <evidence.json> [--allow-fixture]' }, 64);
let evidence;
try { evidence = JSON.parse(fs.readFileSync(input, 'utf8')); }
catch { emit({ pass: false, error: 'key_custody_evidence_invalid_json' }, 64); }

if (evidence?.formatVersion !== 1) blockers.push('format_version_1_required');
if (evidence?.network !== 'ZORYQ Mainnet') blockers.push('network_invalid');
if (evidence?.fixtureOnly === true && !allowFixture) blockers.push('fixture_evidence_forbidden');
if (evidence?.productionEvidence !== true && evidence?.fixtureOnly !== true) blockers.push('production_evidence_required');
const leaked = secretField(evidence);
if (leaked) blockers.push(`secret_material_field_present:${leaked}`);

const signer = evidence?.signer || {};
const allowedSignerTypes = new Set(['hsm','kms','remote-signer','hardware-wallet']);
if (!allowedSignerTypes.has(String(signer.type || '').toLowerCase())) blockers.push('external_signer_type_invalid');
if (!String(signer.provider || '').trim()) blockers.push('external_signer_provider_missing');
if (!String(signer.keyId || '').trim()) blockers.push('external_signer_key_id_missing');
if (signer.privateKeyExportable !== false) blockers.push('private_key_must_be_non_exportable');
if (signer.localPrivateKeyMaterial !== false) blockers.push('local_private_key_material_forbidden');
if (signer.mfaRequired !== true) blockers.push('signer_mfa_required');

const duties = evidence?.separationOfDuties || {};
if (duties.enabled !== true) blockers.push('separation_of_duties_required');
if (!Number.isInteger(duties.minimumApprovers) || duties.minimumApprovers < 2) blockers.push('minimum_two_approvers_required');
if (!Array.isArray(duties.roles) || new Set(duties.roles.map(String)).size < 2) blockers.push('minimum_two_distinct_roles_required');

const recovery = evidence?.recoveryDrill || {};
if (recovery.status !== 'pass') blockers.push('recovery_drill_must_pass');
if (!isHex64(recovery.evidenceSha256)) blockers.push('recovery_drill_evidence_sha256_invalid');
const testedAt = Date.parse(recovery.testedAt || '');
if (!Number.isFinite(testedAt)) blockers.push('recovery_drill_tested_at_invalid');
else if (evidence?.productionEvidence === true && Math.abs(Date.now() - testedAt) > 90 * 24 * 60 * 60 * 1000) blockers.push('recovery_drill_older_than_90_days');

const rotation = evidence?.keyRotation || {};
if (rotation.documented !== true) blockers.push('key_rotation_procedure_required');
if (!Number.isInteger(rotation.maximumAgeDays) || rotation.maximumAgeDays < 1 || rotation.maximumAgeDays > 365) blockers.push('key_rotation_maximum_age_invalid');

const report = {
  pass: blockers.length === 0,
  status: blockers.length === 0 ? 'KEY_CUSTODY_EVIDENCE_ACCEPTED' : 'KEY_CUSTODY_EVIDENCE_REJECTED',
  productionEvidence: evidence?.productionEvidence === true,
  fixtureOnly: evidence?.fixtureOnly === true,
  signerType: signer.type || null,
  signerProvider: signer.provider || null,
  separationOfDuties: duties.enabled === true,
  recoveryDrillStatus: recovery.status || null,
  blockers,
  rule: 'zoryq-mainnet-key-custody-evidence-v1'
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(82);
