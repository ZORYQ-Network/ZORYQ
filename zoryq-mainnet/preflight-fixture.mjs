import fs from 'node:fs';
import path from 'node:path';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';

function fail(message) { console.error(message); process.exit(2); }
function sha(file) { return createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const outIndex = process.argv.indexOf('--out');
const out = outIndex >= 0 ? process.argv[outIndex + 1] : null;
if (!out) fail('usage: node preflight-fixture.mjs --out <directory>');
fs.mkdirSync(out, { recursive: true });

const config = {
  network: 'ZORYQ Mainnet Preflight',
  chainId: 15919065,
  consensus: 'external-engine',
  timestamp: '0x1',
  gasLimit: '0x1c9c380',
  baseFeePerGas: '0x3b9aca00',
  extraData: '0x',
  allocations: []
};
const configPath = path.join(out, 'genesis-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
const ceremony = spawnSync(process.execPath, [new URL('./genesis-ceremony.mjs', import.meta.url).pathname, '--config', configPath, '--out', out], { encoding: 'utf8' });
if (ceremony.status !== 0) {
  process.stderr.write(ceremony.stdout || '');
  process.stderr.write(ceremony.stderr || '');
  process.exit(ceremony.status || 2);
}

const audit = path.join(out, 'audit-report.txt');
const runbook = path.join(out, 'incident-runbook.txt');
const recovery = path.join(out, 'recovery-evidence.txt');
fs.writeFileSync(audit, 'CI PREFLIGHT FIXTURE — not a production audit\n');
fs.writeFileSync(runbook, 'CI PREFLIGHT FIXTURE — not a production incident runbook\n');
fs.writeFileSync(recovery, 'CI PREFLIGHT FIXTURE — not production recovery evidence\n');
fs.writeFileSync(path.join(out, 'jwt.hex'), `${randomBytes(32).toString('hex')}\n`, { mode: 0o600 });

const releaseCommit = 'a'.repeat(40);
const imageDigest = `sha256:${'b'.repeat(64)}`;
const validFrom = new Date().toISOString();
const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
const manifest = {
  network: 'ZORYQ Mainnet',
  chainId: config.chainId,
  ceremonyId: randomBytes(16).toString('hex'),
  validFrom,
  expiresAt,
  genesisSha256: sha(path.join(out, 'genesis.json')),
  releaseCommit,
  imageDigest,
  auditReportSha256: sha(audit),
  incidentRunbookSha256: sha(runbook),
  recoveryDrillSha256: sha(recovery),
  devMode: false,
  faucetEnabled: false,
  debugPublic: false
};

const roles = ['protocol', 'security', 'operations'];
const signers = [];
const approvals = [];
const payload = Buffer.from(JSON.stringify(canonical(manifest)));
for (const role of roles) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const id = `${role}-preflight`;
  signers.push({ id, role, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) });
  approvals.push({ signerId: id, signature: sign(null, payload, privateKey).toString('base64') });
}
fs.writeFileSync(path.join(out, 'launch-manifest.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(out, 'launch-policy.json'), JSON.stringify({
  threshold: 3,
  requiredRoles: roles,
  maxCertificateLifetimeSeconds: 3600,
  signers
}, null, 2));
fs.writeFileSync(path.join(out, 'launch-approvals.json'), JSON.stringify({ approvals }, null, 2));
fs.writeFileSync(path.join(out, 'fixture-meta.json'), JSON.stringify({
  ok: true,
  fixtureOnly: true,
  productionEvidence: false,
  chainId: config.chainId,
  genesisSha256: manifest.genesisSha256,
  releaseCommit,
  imageDigest,
  ceremonyId: manifest.ceremonyId,
  validFrom,
  expiresAt
}, null, 2));

console.log(JSON.stringify({
  ok: true,
  out,
  chainId: config.chainId,
  genesisSha256: manifest.genesisSha256,
  ceremonyId: manifest.ceremonyId,
  validFrom,
  expiresAt,
  fixtureOnly: true
}, null, 2));
