import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-validator-registry-'));
const tool = new URL('./validator-registry.mjs', import.meta.url).pathname;
const attestationKeys = Array.from({ length: 4 }, () => generateKeyPairSync('ed25519').publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
const mkValidator = (n, region) => ({
  operatorId: `operator-${n}`,
  consensusPublicKey: `0x${n.toString(16).repeat(96).slice(0, 96)}`,
  withdrawalAddress: `0x${n.toString(16).repeat(40).slice(0, 40)}`,
  attestationPublicKeySpkiBase64: attestationKeys[n - 1],
  region,
  p2pHost: `validator-${n}.example.net`,
  p2pPort: 30303 + n
});
const valid = {
  network: 'ZORYQ Mainnet',
  minimumValidators: 4,
  minimumRegions: 3,
  validators: [mkValidator(4, 'sa-east'), mkValidator(2, 'eu-west'), mkValidator(1, 'us-east'), mkValidator(3, 'sa-east')]
};
function run(config, outName, expect = 0) {
  const configPath = path.join(root, `${outName}.json`);
  const out = path.join(root, outName);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  const result = spawnSync(process.execPath, [tool, '--config', configPath, '--out', out], { encoding: 'utf8' });
  if (result.status !== expect) {
    process.stderr.write(result.stdout || '');
    process.stderr.write(result.stderr || '');
    throw new Error(`expected exit ${expect}, got ${result.status}`);
  }
  return { out, result };
}
try {
  const a = run(valid, 'a');
  const b = run(valid, 'b');
  if (fs.readFileSync(path.join(a.out, 'validator-registry.json'), 'utf8') !== fs.readFileSync(path.join(b.out, 'validator-registry.json'), 'utf8')) throw new Error('validator registry is not deterministic');
  if (fs.readFileSync(path.join(a.out, 'validator-registry.sha256'), 'utf8') !== fs.readFileSync(path.join(b.out, 'validator-registry.sha256'), 'utf8')) throw new Error('validator registry hash is not deterministic');
  const registry = JSON.parse(fs.readFileSync(path.join(a.out, 'validator-registry.json'), 'utf8'));
  if (registry.formatVersion !== 2 || registry.validatorCount !== 4 || registry.regionCount !== 3 || registry.attestationKeyCount !== 4 || registry.containsPrivateKeyMaterial !== false || registry.validators[0].operatorId !== 'operator-1') throw new Error('canonical registry semantics are incorrect');
  if (!/^[0-9a-f]{64}$/.test(registry.validators[0].attestationKeyFingerprintSha256)) throw new Error('missing attestation key fingerprint');

  run({ ...valid, private_key: 'never-accept' }, 'secret-rejected', 2);
  run({ ...valid, minimumRegions: 4 }, 'region-rejected', 2);
  const duplicateConsensus = structuredClone(valid);
  duplicateConsensus.validators[1].consensusPublicKey = duplicateConsensus.validators[0].consensusPublicKey;
  run(duplicateConsensus, 'duplicate-consensus-key-rejected', 2);
  const duplicateAttestation = structuredClone(valid);
  duplicateAttestation.validators[1].attestationPublicKeySpkiBase64 = duplicateAttestation.validators[0].attestationPublicKeySpkiBase64;
  run(duplicateAttestation, 'duplicate-attestation-key-rejected', 2);
  const invalidAttestation = structuredClone(valid);
  invalidAttestation.validators[0].attestationPublicKeySpkiBase64 = 'not-base64';
  run(invalidAttestation, 'invalid-attestation-key-rejected', 2);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    deterministic: true,
    validatorCount: registry.validatorCount,
    regionCount: registry.regionCount,
    attestationKeyCount: registry.attestationKeyCount,
    secretMaterialRejected: true,
    duplicateKeyRejected: true,
    duplicateAttestationKeyRejected: true,
    invalidAttestationKeyRejected: true,
    insufficientRegionsRejected: true
  }, null, 2)}\n`);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
