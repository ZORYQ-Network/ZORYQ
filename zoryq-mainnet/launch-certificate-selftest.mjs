import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-launch-cert-'));
const verifier = new URL('./launch-certificate.mjs', import.meta.url).pathname;
const roles = ['protocol', 'security', 'operations'];
const signers = [];
const privateKeys = new Map();
for (const role of roles) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const id = `${role}-selftest`;
  signers.push({ id, role, publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) });
  privateKeys.set(id, privateKey);
}
const manifest = {
  network: 'ZORYQ Mainnet',
  chainId: 15919065,
  ceremonyId: '7'.repeat(32),
  validFrom: new Date(Date.now() - 30_000).toISOString(),
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  genesisSha256: '1'.repeat(64),
  releaseCommit: '2'.repeat(40),
  imageDigest: `sha256:${'3'.repeat(64)}`,
  auditReportSha256: '4'.repeat(64),
  incidentRunbookSha256: '5'.repeat(64),
  recoveryDrillSha256: '6'.repeat(64),
  devMode: false,
  faucetEnabled: false,
  debugPublic: false
};
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
function approvalsFor(value) {
  const payload = Buffer.from(JSON.stringify(canonical(value)));
  return {
    approvals: signers.map(({ id }) => ({
      signerId: id,
      signature: sign(null, payload, privateKeys.get(id)).toString('base64')
    }))
  };
}
const approvals = approvalsFor(manifest);
const policy = { threshold: 3, requiredRoles: roles, maxCertificateLifetimeSeconds: 3600, signers };

function write(name, value) {
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(value, null, 2));
}
write('manifest', manifest);
write('policy', policy);
write('approvals', approvals);

function run(expectedCode) {
  const result = spawnSync(process.execPath, [verifier,
    '--manifest', path.join(dir, 'manifest.json'),
    '--policy', path.join(dir, 'policy.json'),
    '--approvals', path.join(dir, 'approvals.json')
  ], { encoding: 'utf8' });
  if (result.status !== expectedCode) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    throw new Error(`expected verifier exit ${expectedCode}, got ${result.status}`);
  }
  return JSON.parse(result.stdout);
}

const accepted = run(0);
if (!accepted.ok || accepted.validApprovals.length !== 3 || accepted.validRoles.length !== 3) {
  throw new Error('valid 3-role threshold certificate was not accepted');
}

const tampered = { ...manifest, chainId: manifest.chainId + 1 };
write('manifest', tampered);
const rejectedTamper = run(79);
if (rejectedTamper.ok || !rejectedTamper.blockers.includes('approval_threshold_not_met')) {
  throw new Error('tampered launch manifest was not rejected');
}

write('manifest', manifest);
write('approvals', { approvals: approvals.approvals.slice(0, 2) });
const rejectedThreshold = run(79);
if (rejectedThreshold.ok || !rejectedThreshold.blockers.includes('approval_threshold_not_met')) {
  throw new Error('below-threshold launch certificate was not rejected');
}

const expiredManifest = {
  ...manifest,
  ceremonyId: '8'.repeat(32),
  validFrom: new Date(Date.now() - 30 * 60_000).toISOString(),
  expiresAt: new Date(Date.now() - 5 * 60_000).toISOString()
};
write('manifest', expiredManifest);
write('approvals', approvalsFor(expiredManifest));
const rejectedExpired = run(79);
if (rejectedExpired.ok || !rejectedExpired.blockers.includes('certificate_expired')) {
  throw new Error('expired launch certificate was not rejected');
}

const tooLongManifest = {
  ...manifest,
  ceremonyId: '9'.repeat(32),
  validFrom: new Date(Date.now() - 30_000).toISOString(),
  expiresAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString()
};
write('manifest', tooLongManifest);
write('approvals', approvalsFor(tooLongManifest));
const rejectedLifetime = run(79);
if (rejectedLifetime.ok || !rejectedLifetime.blockers.includes('certificate_lifetime_exceeds_policy')) {
  throw new Error('overlong launch certificate was not rejected');
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  scheme: 'ed25519',
  threshold: 3,
  requiredRoles: roles,
  tamperRejected: true,
  belowThresholdRejected: true,
  expiredCertificateRejected: true,
  excessiveLifetimeRejected: true,
  privateKeysPersisted: false
}, null, 2)}\n`);
fs.rmSync(dir, { recursive: true, force: true });
