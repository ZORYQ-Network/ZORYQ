import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-validator-registry-'));
const tool = new URL('./validator-registry.mjs', import.meta.url).pathname;
const mkValidator = (n, region) => ({
  operatorId: `operator-${n}`,
  consensusPublicKey: `0x${n.toString(16).repeat(96).slice(0, 96)}`,
  withdrawalAddress: `0x${n.toString(16).repeat(40).slice(0, 40)}`,
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
const a = run(valid, 'a');
const b = run(valid, 'b');
if (fs.readFileSync(path.join(a.out, 'validator-registry.json'), 'utf8') !== fs.readFileSync(path.join(b.out, 'validator-registry.json'), 'utf8')) {
  throw new Error('validator registry is not deterministic');
}
if (fs.readFileSync(path.join(a.out, 'validator-registry.sha256'), 'utf8') !== fs.readFileSync(path.join(b.out, 'validator-registry.sha256'), 'utf8')) {
  throw new Error('validator registry hash is not deterministic');
}
const registry = JSON.parse(fs.readFileSync(path.join(a.out, 'validator-registry.json'), 'utf8'));
if (registry.validatorCount !== 4 || registry.regionCount !== 3 || registry.containsPrivateKeyMaterial !== false || registry.validators[0].operatorId !== 'operator-1') {
  throw new Error('canonical registry semantics are incorrect');
}

run({ ...valid, private_key: 'never-accept' }, 'secret-rejected', 2);
run({ ...valid, minimumRegions: 4 }, 'region-rejected', 2);
const duplicate = structuredClone(valid);
duplicate.validators[1].consensusPublicKey = duplicate.validators[0].consensusPublicKey;
run(duplicate, 'duplicate-key-rejected', 2);

process.stdout.write(`${JSON.stringify({
  ok: true,
  deterministic: true,
  validatorCount: registry.validatorCount,
  regionCount: registry.regionCount,
  secretMaterialRejected: true,
  duplicateKeyRejected: true,
  insufficientRegionsRejected: true
}, null, 2)}\n`);
fs.rmSync(root, { recursive: true, force: true });
