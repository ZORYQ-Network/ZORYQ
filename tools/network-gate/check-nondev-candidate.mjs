import fs from 'node:fs';
import { createHash } from 'node:crypto';

const manifestPath = process.argv[2];
if (!manifestPath) {
  console.error('usage: node check-nondev-candidate.mjs <candidate-manifest.json>');
  process.exit(64);
}

const fail = [];
const sha256 = p => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const nonEmpty = p => { try { return fs.statSync(p).isFile() && fs.statSync(p).size > 0; } catch { return false; } };

let m;
try { m = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
catch { console.error(JSON.stringify({ ok:false, error:'invalid_manifest_json' })); process.exit(65); }

if (m.networkMode !== 'non-dev-testnet-candidate') fail.push('network_mode_invalid');
if (!m.execution || !m.consensus) fail.push('execution_or_consensus_section_missing');

const executionArgs = Array.isArray(m.execution?.args) ? m.execution.args : [];
for (const arg of executionArgs) {
  if (arg === '--dev' || String(arg).startsWith('--dev.')) fail.push(`forbidden_execution_arg:${arg}`);
}

if (!m.execution?.client || !m.execution?.version) fail.push('execution_client_identity_missing');
if (!m.consensus?.client || !m.consensus?.version) fail.push('consensus_client_identity_missing');
if (!m.consensus?.finalityModel) fail.push('finality_model_missing');
if (!m.engineApi?.jwtSecretGeneratedPerOperator) fail.push('per_operator_engine_jwt_not_attested');
if (m.engineApi?.jwtSecretCommitted === true) fail.push('engine_jwt_secret_must_not_be_committed');

function requireHashedFile(pathValue, expectedHash, label) {
  const p = String(pathValue || '').trim();
  const expected = String(expectedHash || '').trim().toLowerCase();
  if (!p || !nonEmpty(p)) { fail.push(`${label}_missing_or_empty`); return null; }
  if (!/^[0-9a-f]{64}$/.test(expected)) { fail.push(`${label}_sha256_invalid`); return null; }
  const actual = sha256(p);
  if (actual !== expected) { fail.push(`${label}_sha256_mismatch`); return null; }
  return { path:p, sha256:actual };
}

const boundEvidence = {};
boundEvidence.executionGenesis = requireHashedFile(m.execution?.genesisPath, m.execution?.genesisSha256, 'execution_genesis');
boundEvidence.consensusConfig = requireHashedFile(m.consensus?.configPath, m.consensus?.configSha256, 'consensus_config');

const operators = Array.isArray(m.operators) ? m.operators : [];
if (operators.length < 2) fail.push('fewer_than_two_operators');
for (const [i, op] of operators.entries()) {
  if (!op?.operatorId) fail.push(`operator_${i}_id_missing`);
  if (!op?.controlBoundary) fail.push(`operator_${i}_control_boundary_missing`);
  if (!op?.persistentState) fail.push(`operator_${i}_persistent_state_not_attested`);
  if (!op?.uniqueP2pIdentity) fail.push(`operator_${i}_unique_p2p_identity_not_attested`);
}
if (operators.length >= 2 && operators[0]?.controlBoundary === operators[1]?.controlBoundary) {
  fail.push('operators_share_same_control_boundary');
}

const evidenceKeys = [
  'matchingBlockHashEvidence',
  'restartRejoinEvidence',
  'oneNodeOutageRecoveryEvidence',
  'finalityEvidence',
  'operatorIndependenceEvidence'
];
for (const key of evidenceKeys) {
  const e = m.evidence?.[key];
  boundEvidence[key] = requireHashedFile(e?.path, e?.sha256, key);
}

const report = {
  ok: fail.length === 0,
  schema: 'zoryq-nondev-candidate-gate/2.0',
  manifest: manifestPath,
  blockers: fail,
  boundEvidence,
  claimBoundary: fail.length === 0
    ? 'Candidate passed the minimum non-dev distributed-testnet evidence gate. This is not mainnet readiness.'
    : 'Candidate must not be promoted as a distributed testnet.'
};
console.log(JSON.stringify(report, null, 2));
process.exit(fail.length ? 78 : 0);
