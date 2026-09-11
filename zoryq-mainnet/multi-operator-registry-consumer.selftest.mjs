import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const gate = path.resolve('zoryq-mainnet/multi-operator-evidence.mjs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-registry-consumer-'));
const sha = (value) => createHash('sha256').update(value).digest('hex');
const der = (pair) => pair.publicKey.export({ format: 'der', type: 'spki' });

function validator(i, pair) {
  const keyDer = der(pair);
  return {
    operatorId: `operator-${i + 1}`,
    consensusPublicKey: `0x${String(i + 1).padStart(2, '0').repeat(48)}`,
    withdrawalAddress: `0x${String(i + 1).padStart(2, '0').repeat(20)}`,
    region: ['sa-east', 'us-east', 'eu-west', 'sa-east'][i],
    p2pHost: `validator-${i + 1}.example.net`,
    p2pPort: 30304 + i,
    attestationPublicKeySpkiBase64: keyDer.toString('base64'),
    attestationKeyFingerprintSha256: sha(keyDer)
  };
}
function registry(validators) {
  return {
    formatVersion: 2,
    network: 'ZORYQ Mainnet',
    minimumValidators: 4,
    minimumRegions: 3,
    validatorCount: validators.length,
    regionCount: 3,
    attestationKeyCount: validators.length,
    validators,
    containsPrivateKeyMaterial: false
  };
}
function run(name, reg) {
  const registryFile = path.join(dir, `${name}.registry.json`);
  const evidenceFile = path.join(dir, `${name}.evidence.json`);
  fs.writeFileSync(registryFile, `${JSON.stringify(reg, null, 2)}\n`);
  fs.writeFileSync(evidenceFile, '{}\n');
  const result = spawnSync(process.execPath, [gate, '--input', evidenceFile, '--registry', registryFile], { encoding: 'utf8' });
  let body = {};
  try { body = JSON.parse(result.stdout || '{}'); } catch {}
  return { status: result.status, body };
}
function expectError(name, reg, expected) {
  const result = run(name, reg);
  if (result.status !== 64 || !String(result.body.error || '').includes(expected)) {
    throw new Error(`${name}: expected ${expected}, got status=${result.status} body=${JSON.stringify(result.body)}`);
  }
  process.stdout.write(`${name}: rejected as expected\n`);
}

try {
  const keys = Array.from({ length: 4 }, () => generateKeyPairSync('ed25519'));
  const good = registry(keys.map((pair, i) => validator(i, pair)));
  const acceptedRegistry = run('valid-registry-material', good);
  if (acceptedRegistry.status !== 82 || acceptedRegistry.body.error) {
    throw new Error(`valid registry material rejected before evidence policy: ${JSON.stringify(acceptedRegistry)}`);
  }
  process.stdout.write('valid Ed25519 registry material accepted by registry loader\n');

  const badFingerprint = structuredClone(good);
  badFingerprint.validators[0].attestationKeyFingerprintSha256 = 'f'.repeat(64);
  expectError('fingerprint-mismatch', badFingerprint, 'validator_registry_attestation_fingerprint_mismatch');

  const ecPair = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const wrongAlgorithm = structuredClone(good);
  const ecDer = der(ecPair);
  wrongAlgorithm.validators[0].attestationPublicKeySpkiBase64 = ecDer.toString('base64');
  wrongAlgorithm.validators[0].attestationKeyFingerprintSha256 = sha(ecDer);
  expectError('non-ed25519-key', wrongAlgorithm, 'validator_registry_attestation_key_not_ed25519');

  const duplicateKey = structuredClone(good);
  duplicateKey.validators[3].attestationPublicKeySpkiBase64 = duplicateKey.validators[0].attestationPublicKeySpkiBase64;
  duplicateKey.validators[3].attestationKeyFingerprintSha256 = duplicateKey.validators[0].attestationKeyFingerprintSha256;
  expectError('duplicate-canonical-key', duplicateKey, 'validator_registry_duplicate_attestation_key');

  const malformed = structuredClone(good);
  malformed.validators[1].attestationPublicKeySpkiBase64 = 'not-a-valid-spki';
  expectError('malformed-spki', malformed, 'validator_registry_attestation_key_invalid');

  process.stdout.write('registry consumer adversarial self-test: PASS\n');
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
