import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const GATE = path.join(ROOT, 'readiness-gate.mjs');
const CONTROLS = [
  'execution-runtime','genesis-ceremony','validator-distribution','consensus-multivalidator','key-custody',
  'independent-security-audit','contract-security','recovery-drill','incident-response','observability-alerting',
  'rpc-abuse-protection','supply-chain-provenance','release-governance','testnet-burn-in','launch-approvals'
];
const REQUIRED_GOVERNANCE_CHECKS = [
  'ZORYQ Mainnet Readiness Gate','ZORYQ Mainnet Launch Guard','ZORYQ Mainnet Runtime Preflight',
  'ZORYQ Mainnet Supply Chain Evidence','ZORYQ Mainnet Release Integrity','ZORYQ Mainnet Multi-Operator Evidence',
  'ZORYQ Contract Tests'
];

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
function run(input) {
  const r = spawnSync(process.execPath, [GATE, '--input', input], { encoding: 'utf8' });
  let body = {};
  try { body = JSON.parse(r.stdout || '{}'); } catch {}
  return { status: r.status, body, stderr: r.stderr };
}
function assert(ok, message) {
  if (!ok) throw new Error(message);
}
function writeEvidence(name, full, observedAt) {
  let body;
  if (name === 'consensus-multivalidator') {
    body = {
      pass: true,
      status: 'MULTI_OPERATOR_CONVERGENCE_EVIDENCE_ACCEPTED',
      network: 'ZORYQ Mainnet',
      chainId: 5919066,
      consensusEngine: 'zoryq-bft-rehearsal',
      nodeCount: 4,
      operatorCount: 4,
      regionCount: 3,
      commonFinalizedCheckpoint: { height: 1000, hash: `0x${'a'.repeat(64)}` },
      blockers: [],
      evidenceSha256: 'c'.repeat(64),
      rule: 'zoryq-mainnet-multi-operator-evidence-v1'
    };
  } else if (name === 'release-governance') {
    body = {
      pass: true,
      status: 'RELEASE_GOVERNANCE_EVIDENCE_ACCEPTED',
      repository: 'ZORYQ-Network/ZORYQ',
      releaseCommit: 'a'.repeat(40),
      observedAt,
      requiredChecks: REQUIRED_GOVERNANCE_CHECKS,
      observedRequiredChecks: [...REQUIRED_GOVERNANCE_CHECKS].sort(),
      blockers: [],
      rule: 'zoryq-mainnet-release-governance-evidence-v1'
    };
  } else {
    body = { control: name, observedAt, fixture: false };
  }
  fs.writeFileSync(full, JSON.stringify(body) + '\n');
}
function makeFixture(dir) {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  const controls = {};
  for (const name of CONTROLS) {
    const evidencePath = `evidence/${name}.json`;
    const full = path.join(dir, evidencePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    writeEvidence(name, full, now.toISOString());
    controls[name] = {
      status: 'pass',
      observedAt: now.toISOString(),
      evidencePath,
      evidenceSha256: sha256(full)
    };
  }
  controls['independent-security-audit'].independent = true;
  Object.assign(controls['validator-distribution'], { validatorCount: 4, regionCount: 3, operatorCount: 4 });
  controls['consensus-multivalidator'].faultTestsPassed = 3;
  controls['testnet-burn-in'].continuousHours = 168;
  const dossier = {
    network: 'ZORYQ Mainnet',
    productionEvidence: true,
    chainId: 5919066,
    genesisSha256: '1'.repeat(64),
    validatorRegistrySha256: '2'.repeat(64),
    releaseCommit: 'a'.repeat(40),
    imageDigest: `sha256:${'b'.repeat(64)}`,
    generatedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
    controls
  };
  const input = path.join(dir, 'readiness.json');
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  return { input, dossier };
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-readiness-selftest-'));
try {
  const { input, dossier } = makeFixture(dir);
  const good = run(input);
  assert(good.status === 0 && good.body.ready === true, `valid dossier rejected: ${JSON.stringify(good.body)}`);
  assert(good.body.verifiedControls?.length === CONTROLS.length, 'not all evidence controls were verified');

  const governancePath = path.join(dir, dossier.controls['release-governance'].evidencePath);
  const weakGovernance = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
  weakGovernance.status = 'RELEASE_GOVERNANCE_EVIDENCE_REJECTED';
  fs.writeFileSync(governancePath, JSON.stringify(weakGovernance) + '\n');
  dossier.controls['release-governance'].evidenceSha256 = sha256(governancePath);
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const semanticGovernance = run(input);
  assert(semanticGovernance.status === 82, `weak governance evidence exit=${semanticGovernance.status}`);
  assert(semanticGovernance.body.blockers?.includes('release_governance_not_accepted'), 'weak semantic governance evidence was not rejected');
  writeEvidence('release-governance', governancePath, dossier.controls['release-governance'].observedAt);
  dossier.controls['release-governance'].evidenceSha256 = sha256(governancePath);

  const consensusPath = path.join(dir, dossier.controls['consensus-multivalidator'].evidencePath);
  const weakConsensus = JSON.parse(fs.readFileSync(consensusPath, 'utf8'));
  weakConsensus.operatorCount = 3;
  fs.writeFileSync(consensusPath, JSON.stringify(weakConsensus) + '\n');
  dossier.controls['consensus-multivalidator'].evidenceSha256 = sha256(consensusPath);
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const semanticConsensus = run(input);
  assert(semanticConsensus.status === 82, `weak consensus evidence exit=${semanticConsensus.status}`);
  assert(semanticConsensus.body.blockers?.includes('consensus_evidence_operator_count_below_policy'), 'weak semantic consensus evidence was not rejected');
  writeEvidence('consensus-multivalidator', consensusPath, dossier.controls['consensus-multivalidator'].observedAt);
  dossier.controls['consensus-multivalidator'].evidenceSha256 = sha256(consensusPath);

  const tampered = path.join(dir, dossier.controls['recovery-drill'].evidencePath);
  fs.appendFileSync(tampered, '{"tampered":true}\n');
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const hashMismatch = run(input);
  assert(hashMismatch.status === 82, `tampered evidence exit=${hashMismatch.status}`);
  assert(hashMismatch.body.blockers?.includes('control_evidence_hash_mismatch:recovery-drill'), 'tampered evidence was not rejected');
  writeEvidence('recovery-drill', tampered, dossier.controls['recovery-drill'].observedAt);
  dossier.controls['recovery-drill'].evidenceSha256 = sha256(tampered);

  dossier.chainId = 5919065;
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const testnetReuse = run(input);
  assert(testnetReuse.status === 82, `testnet reuse exit=${testnetReuse.status}`);
  assert(testnetReuse.body.blockers?.includes('chain_id_reuses_testnet'), 'testnet chain id reuse was not rejected');

  dossier.chainId = 5919066;
  dossier.controls['validator-distribution'].operatorCount = 3;
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const concentration = run(input);
  assert(concentration.status === 82, `operator concentration exit=${concentration.status}`);
  assert(concentration.body.blockers?.includes('validator_operator_count_below_policy'), 'validator operator concentration was not rejected');

  process.stdout.write(JSON.stringify({ ok: true, cases: ['valid-evidence','semantic-governance-rejection','semantic-consensus-rejection','tamper-rejection','testnet-chain-rejection','validator-distribution-policy'] }, null, 2) + '\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
