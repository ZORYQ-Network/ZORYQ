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
function runNode(script, argv) {
  const result = spawnSync(process.execPath, [script, ...argv], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    process.exit(result.status || 2);
  }
  return result.stdout;
}
function generateAttestationPublicKeySpkiBase64() {
  const { publicKey } = generateKeyPairSync('ed25519');
  return publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
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
runNode(new URL('./genesis-ceremony.mjs', import.meta.url).pathname, ['--config', configPath, '--out', out]);

const validatorConfig = {
  network: 'ZORYQ Mainnet',
  minimumValidators: 4,
  minimumRegions: 3,
  validators: [
    { operatorId: 'preflight-a', consensusPublicKey: `0x${'11'.repeat(48)}`, withdrawalAddress: `0x${'11'.repeat(20)}`, region: 'sa-east', p2pHost: 'validator-a.example.net', p2pPort: 30304, attestationPublicKeySpkiBase64: generateAttestationPublicKeySpkiBase64() },
    { operatorId: 'preflight-b', consensusPublicKey: `0x${'22'.repeat(48)}`, withdrawalAddress: `0x${'22'.repeat(20)}`, region: 'us-east', p2pHost: 'validator-b.example.net', p2pPort: 30305, attestationPublicKeySpkiBase64: generateAttestationPublicKeySpkiBase64() },
    { operatorId: 'preflight-c', consensusPublicKey: `0x${'33'.repeat(48)}`, withdrawalAddress: `0x${'33'.repeat(20)}`, region: 'eu-west', p2pHost: 'validator-c.example.net', p2pPort: 30306, attestationPublicKeySpkiBase64: generateAttestationPublicKeySpkiBase64() },
    { operatorId: 'preflight-d', consensusPublicKey: `0x${'44'.repeat(48)}`, withdrawalAddress: `0x${'44'.repeat(20)}`, region: 'sa-east', p2pHost: 'validator-d.example.net', p2pPort: 30307, attestationPublicKeySpkiBase64: generateAttestationPublicKeySpkiBase64() }
  ]
};
const validatorConfigPath = path.join(out, 'validator-config.json');
fs.writeFileSync(validatorConfigPath, JSON.stringify(validatorConfig, null, 2));
runNode(new URL('./validator-registry.mjs', import.meta.url).pathname, ['--config', validatorConfigPath, '--out', out]);

const audit = path.join(out, 'audit-report.txt');
const runbook = path.join(out, 'incident-runbook.txt');
const recovery = path.join(out, 'recovery-evidence.txt');
const consensus = path.join(out, 'consensus-evidence.txt');
const keyCustody = path.join(out, 'key-custody-evidence.txt');
const governance = path.join(out, 'release-governance.txt');
const observability = path.join(out, 'observability-evidence.txt');
fs.writeFileSync(audit, 'CI PREFLIGHT FIXTURE — not a production audit\n');
fs.writeFileSync(runbook, 'CI PREFLIGHT FIXTURE — not a production incident runbook\n');
fs.writeFileSync(recovery, 'CI PREFLIGHT FIXTURE — not production recovery evidence\n');
fs.writeFileSync(consensus, 'CI PREFLIGHT FIXTURE — not production consensus evidence\n');
fs.writeFileSync(keyCustody, 'CI PREFLIGHT FIXTURE — not production key-custody evidence\n');
fs.writeFileSync(governance, 'CI PREFLIGHT FIXTURE — not production release-governance evidence\n');
fs.writeFileSync(observability, 'CI PREFLIGHT FIXTURE — not production observability evidence\n');
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
  validatorRegistrySha256: sha(path.join(out, 'validator-registry.json')),
  consensusEvidenceSha256: sha(consensus),
  keyCustodyEvidenceSha256: sha(keyCustody),
  releaseGovernanceSha256: sha(governance),
  observabilityEvidenceSha256: sha(observability),
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
  validatorRegistrySha256: manifest.validatorRegistrySha256,
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
  validatorRegistrySha256: manifest.validatorRegistrySha256,
  evidenceBound: true,
  ceremonyId: manifest.ceremonyId,
  validFrom,
  expiresAt,
  fixtureOnly: true
}, null, 2));
