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
function makeFixture(dir) {
  const now = new Date();
  const expires = new Date(now.getTime() + 60 * 60 * 1000);
  const controls = {};
  for (const name of CONTROLS) {
    const evidencePath = `evidence/${name}.json`;
    const full = path.join(dir, evidencePath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, JSON.stringify({ control: name, observedAt: now.toISOString(), fixture: false }) + '\n');
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

  const tampered = path.join(dir, dossier.controls['recovery-drill'].evidencePath);
  fs.appendFileSync(tampered, '{"tampered":true}\n');
  const hashMismatch = run(input);
  assert(hashMismatch.status === 82, `tampered evidence exit=${hashMismatch.status}`);
  assert(hashMismatch.body.blockers?.includes('control_evidence_hash_mismatch:recovery-drill'), 'tampered evidence was not rejected');
  fs.writeFileSync(tampered, JSON.stringify({ control: 'recovery-drill', observedAt: dossier.controls['recovery-drill'].observedAt, fixture: false }) + '\n');
  dossier.controls['recovery-drill'].evidenceSha256 = sha256(tampered);

  dossier.chainId = 5919065;
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const testnetReuse = run(input);
  assert(testnetReuse.status === 82, `testnet reuse exit=${testnetReuse.status}`);
  assert(testnetReuse.body.blockers?.includes('chain_id_reuses_testnet'), 'testnet chain id reuse was not rejected');

  dossier.chainId = 5919066;
  dossier.privateKey = 'forbidden-even-as-placeholder';
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const secret = run(input);
  assert(secret.status === 82, `secret material exit=${secret.status}`);
  assert(secret.body.blockers?.some((x) => x.startsWith('secret_material_field_present:')), 'secret material field was not rejected');

  delete dossier.privateKey;
  dossier.controls['validator-distribution'].operatorCount = 3;
  fs.writeFileSync(input, JSON.stringify(dossier, null, 2));
  const concentration = run(input);
  assert(concentration.status === 82, `operator concentration exit=${concentration.status}`);
  assert(concentration.body.blockers?.includes('validator_operator_count_below_policy'), 'validator operator concentration was not rejected');

  process.stdout.write(JSON.stringify({ ok: true, cases: ['valid-evidence','tamper-rejection','testnet-chain-rejection','secret-field-rejection','validator-distribution-policy'] }, null, 2) + '\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
