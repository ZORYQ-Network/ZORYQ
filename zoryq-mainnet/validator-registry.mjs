import fs from 'node:fs';
import path from 'node:path';
import { createHash, createPublicKey } from 'node:crypto';

function fail(message, code = 2) {
  console.error(`[zoryq-mainnet] ${message}`);
  process.exit(code);
}
function args(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node validator-registry.mjs --config <file> --out <directory>');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function parseAttestationKey(value, operatorId) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) fail(`invalid Ed25519 attestation public key for ${operatorId}`);
  try {
    const der = Buffer.from(value, 'base64');
    if (!der.length || der.toString('base64') !== value) fail(`invalid Ed25519 attestation public key for ${operatorId}`);
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'ed25519') fail(`attestation public key must be Ed25519 for ${operatorId}`);
    const canonicalDer = key.export({ format: 'der', type: 'spki' });
    return {
      attestationPublicKeySpkiBase64: canonicalDer.toString('base64'),
      attestationKeyFingerprintSha256: sha(canonicalDer)
    };
  } catch (error) {
    if (error?.code === 2) throw error;
    fail(`invalid Ed25519 attestation public key for ${operatorId}`);
  }
}

const input = args(process.argv);
if (!input.config || !input.out) fail('usage: node validator-registry.mjs --config <file> --out <directory>');
const raw = fs.readFileSync(input.config, 'utf8');
const lowered = raw.toLowerCase();
for (const forbidden of ['mnemonic', 'privatekey', 'private_key', 'secretkey', 'secret_key', 'keystore', 'password']) {
  if (lowered.includes(forbidden)) fail(`secret-bearing field is forbidden in validator registry: ${forbidden}`);
}
let cfg;
try { cfg = JSON.parse(raw); } catch { fail('validator config is not valid JSON'); }
if (cfg.network !== 'ZORYQ Mainnet') fail('network must be exactly ZORYQ Mainnet');
const minimumValidators = Number(cfg.minimumValidators ?? 4);
const minimumRegions = Number(cfg.minimumRegions ?? 3);
if (!Number.isSafeInteger(minimumValidators) || minimumValidators < 4) fail('minimumValidators must be an integer >= 4');
if (!Number.isSafeInteger(minimumRegions) || minimumRegions < 2) fail('minimumRegions must be an integer >= 2');
const validators = Array.isArray(cfg.validators) ? cfg.validators : [];
if (validators.length < minimumValidators) fail(`at least ${minimumValidators} validators are required`);

const operatorIds = new Set();
const publicKeys = new Set();
const attestationKeys = new Set();
const endpointKeys = new Set();
const regions = new Set();
const normalized = [];
for (const item of validators) {
  const operatorId = String(item?.operatorId || '').trim();
  const consensusPublicKey = String(item?.consensusPublicKey || '').trim().toLowerCase();
  const withdrawalAddress = String(item?.withdrawalAddress || '').trim().toLowerCase();
  const region = String(item?.region || '').trim().toLowerCase();
  const p2pHost = String(item?.p2pHost || '').trim().toLowerCase();
  const p2pPort = Number(item?.p2pPort ?? 30303);
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(operatorId)) fail(`invalid operatorId: ${operatorId}`);
  if (operatorIds.has(operatorId.toLowerCase())) fail(`duplicate operatorId: ${operatorId}`);
  if (!/^0x[0-9a-f]{96}$/.test(consensusPublicKey)) fail(`invalid 48-byte BLS public key for ${operatorId}`);
  if (publicKeys.has(consensusPublicKey)) fail(`duplicate consensus public key for ${operatorId}`);
  if (!/^0x[0-9a-f]{40}$/.test(withdrawalAddress)) fail(`invalid withdrawalAddress for ${operatorId}`);
  if (!/^[a-z0-9][a-z0-9._-]{1,31}$/i.test(region)) fail(`invalid region for ${operatorId}`);
  if (!p2pHost || /^(localhost|127\.|0\.0\.0\.0|::1$)/i.test(p2pHost)) fail(`p2pHost must be externally routable for ${operatorId}`);
  if (!Number.isSafeInteger(p2pPort) || p2pPort < 1024 || p2pPort > 65535) fail(`invalid p2pPort for ${operatorId}`);
  const endpointKey = `${p2pHost}:${p2pPort}`;
  if (endpointKeys.has(endpointKey)) fail(`duplicate P2P endpoint: ${endpointKey}`);
  const attestation = parseAttestationKey(item?.attestationPublicKeySpkiBase64, operatorId);
  if (attestationKeys.has(attestation.attestationKeyFingerprintSha256)) fail(`duplicate attestation public key for ${operatorId}`);
  operatorIds.add(operatorId.toLowerCase());
  publicKeys.add(consensusPublicKey);
  attestationKeys.add(attestation.attestationKeyFingerprintSha256);
  endpointKeys.add(endpointKey);
  regions.add(region);
  normalized.push({ operatorId, consensusPublicKey, withdrawalAddress, region, p2pHost, p2pPort, ...attestation });
}
if (regions.size < minimumRegions) fail(`validator registry requires at least ${minimumRegions} distinct regions`);
normalized.sort((a, b) => a.operatorId.toLowerCase().localeCompare(b.operatorId.toLowerCase()));
const registry = canonical({
  formatVersion: 2,
  network: 'ZORYQ Mainnet',
  minimumValidators,
  minimumRegions,
  validatorCount: normalized.length,
  regionCount: regions.size,
  attestationKeyCount: attestationKeys.size,
  validators: normalized,
  containsPrivateKeyMaterial: false
});
const serialized = `${JSON.stringify(registry, null, 2)}\n`;
const digest = sha(Buffer.from(serialized));
const outDir = path.resolve(input.out);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'validator-registry.json'), serialized, { mode: 0o644 });
fs.writeFileSync(path.join(outDir, 'validator-registry.sha256'), `${digest}  validator-registry.json\n`, { mode: 0o644 });
console.log(JSON.stringify({ ok: true, validatorCount: normalized.length, regionCount: regions.size, attestationKeyCount: attestationKeys.size, validatorRegistrySha256: digest, privateKeysAccepted: false }, null, 2));
