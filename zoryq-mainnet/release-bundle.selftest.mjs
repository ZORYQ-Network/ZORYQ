import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const script = new URL('./release-bundle.mjs', import.meta.url).pathname;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-release-bundle-'));
const evidenceRoot = path.join(tmp, 'evidence');
fs.mkdirSync(evidenceRoot);

const required = [
  'audit-report', 'consensus-evidence', 'genesis', 'incident-runbook',
  'key-custody-evidence', 'launch-certificate', 'observability-evidence',
  'readiness-report', 'recovery-drill', 'release-governance-evidence',
  'sbom', 'validator-registry'
];
const sha = (data) => createHash('sha256').update(data).digest('hex');
const components = required.map((id) => {
  const rel = `${id}.json`;
  const content = JSON.stringify({ fixture: true, id, purpose: 'release-bundle-selftest' });
  fs.writeFileSync(path.join(evidenceRoot, rel), content);
  return { id, path: rel, sha256: sha(content) };
});
const manifestPath = path.join(tmp, 'manifest.json');
const base = {
  network: 'ZORYQ Mainnet',
  chainId: 77117711,
  releaseCommit: 'a'.repeat(40),
  imageDigest: `sha256:${'b'.repeat(64)}`,
  generatedAt: new Date().toISOString(),
  integrityRoot: '0'.repeat(64),
  components
};

function run(manifest, expectedCommit = manifest.releaseCommit) {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  const result = spawnSync(process.execPath, [script, '--manifest', manifestPath, '--root', evidenceRoot, '--expected-commit', expectedCommit], { encoding: 'utf8' });
  let report = null;
  try { report = JSON.parse(result.stdout); } catch {}
  return { ...result, report };
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function blocker(result, value) {
  return Array.isArray(result.report?.blockers) && result.report.blockers.includes(value);
}

try {
  const bootstrap = run(base);
  assert(bootstrap.status === 80, 'bootstrap manifest must fail before integrity root is bound');
  assert(blocker(bootstrap, 'integrity_root_mismatch'), 'bootstrap must expose computed root via integrity mismatch');
  assert(/^[0-9a-f]{64}$/.test(bootstrap.report?.integrityRoot || ''), 'computed integrity root missing');

  const valid = { ...base, integrityRoot: bootstrap.report.integrityRoot };
  const ok = run(valid);
  assert(ok.status === 0, `valid bundle rejected: ${ok.stderr || ok.stdout}`);
  assert(ok.report?.ok === true, 'valid bundle report must be ok');
  assert(ok.report?.componentCount === required.length, 'not all required components were verified');
  assert(ok.report?.integrityRoot === valid.integrityRoot, 'integrity root changed unexpectedly');

  fs.appendFileSync(path.join(evidenceRoot, 'genesis.json'), '\nTAMPERED');
  const tampered = run(valid);
  assert(tampered.status === 80, 'tampered evidence must fail');
  assert(blocker(tampered, 'component_hash_mismatch:genesis'), 'tampered genesis hash was not detected');
  fs.writeFileSync(path.join(evidenceRoot, 'genesis.json'), JSON.stringify({ fixture: true, id: 'genesis', purpose: 'release-bundle-selftest' }));

  const wrongChain = run({ ...valid, chainId: 5919065 });
  assert(wrongChain.status === 80, 'testnet chain id must fail');
  assert(blocker(wrongChain, 'testnet_chain_id_forbidden'), 'testnet chain id blocker missing');

  const wrongCommit = run(valid, 'c'.repeat(40));
  assert(wrongCommit.status === 80, 'release commit mismatch must fail');
  assert(blocker(wrongCommit, 'release_commit_mismatch'), 'release commit mismatch blocker missing');

  const secretComponent = structuredClone(valid);
  secretComponent.components[0] = { ...secretComponent.components[0], path: 'private-key.json' };
  const secretPath = run(secretComponent);
  assert(secretPath.status === 80, 'secret-like path must fail');
  assert(blocker(secretPath, `secret_material_path_forbidden:${secretComponent.components[0].id}`), 'secret path blocker missing');

  const missing = structuredClone(valid);
  missing.components = missing.components.filter((x) => x.id !== 'audit-report');
  const missingRequired = run(missing);
  assert(missingRequired.status === 80, 'missing required component must fail');
  assert(blocker(missingRequired, 'required_component_missing:audit-report'), 'missing component blocker missing');

  process.stdout.write(JSON.stringify({
    ok: true,
    policy: 'zoryq-launch-integrity-root-v1',
    integrityRoot: valid.integrityRoot,
    adversarialCases: 5,
    requiredComponents: required.length
  }, null, 2) + '\n');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
