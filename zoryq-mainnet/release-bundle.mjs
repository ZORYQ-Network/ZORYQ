import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;
const REQUIRED_COMPONENTS = [
  'audit-report',
  'consensus-evidence',
  'genesis',
  'incident-runbook',
  'key-custody-evidence',
  'launch-certificate',
  'observability-evidence',
  'readiness-report',
  'recovery-drill',
  'release-governance-evidence',
  'sbom',
  'validator-registry'
];
const SECRETISH = /(^|[._/-])(secret|private|mnemonic|seed|keystore|jwt)([._/-]|$)/i;

function fail(message, code = 2) {
  process.stderr.write(`[zoryq-mainnet] ${message}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) {
      fail('usage: node release-bundle.mjs --manifest <file> --root <evidence-root> [--expected-commit <sha>]');
    }
    args[key.slice(2)] = value;
  }
  return args;
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function bytes(value) {
  return Buffer.from(JSON.stringify(canonical(value)));
}
function hash(data) {
  return createHash('sha256').update(data).digest('hex');
}
function fileHash(file) {
  return hash(fs.readFileSync(file));
}
function isHex64(value) {
  return /^[0-9a-f]{64}$/.test(String(value || '').toLowerCase());
}
function isCommit(value) {
  return /^[0-9a-f]{40}$/.test(String(value || '').toLowerCase());
}
function isImageDigest(value) {
  return /^sha256:[0-9a-f]{64}$/.test(String(value || '').toLowerCase());
}
function parseTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function merkleRoot(hexLeaves) {
  if (!hexLeaves.length) return null;
  let level = hexLeaves.map((leaf) => Buffer.from(leaf, 'hex'));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = level[i + 1] || left;
      next.push(Buffer.from(hash(Buffer.concat([left, right])), 'hex'));
    }
    level = next;
  }
  return level[0].toString('hex');
}

const args = parseArgs(process.argv);
if (!args.manifest || !args.root) {
  fail('usage: node release-bundle.mjs --manifest <file> --root <evidence-root> [--expected-commit <sha>]');
}

let manifest;
try { manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8')); } catch {
  fail(`manifest is not valid JSON: ${args.manifest}`);
}

const blockers = [];
const chainId = Number(manifest.chainId);
if (manifest.network !== 'ZORYQ Mainnet') blockers.push('network_name_invalid');
if (!Number.isSafeInteger(chainId) || chainId <= 0) blockers.push('chain_id_invalid');
if (chainId === TESTNET_CHAIN_ID) blockers.push('testnet_chain_id_forbidden');
if (!isCommit(manifest.releaseCommit)) blockers.push('release_commit_invalid');
if (args['expected-commit'] && String(manifest.releaseCommit).toLowerCase() !== String(args['expected-commit']).toLowerCase()) {
  blockers.push('release_commit_mismatch');
}
if (!isImageDigest(manifest.imageDigest)) blockers.push('image_digest_invalid');
if (!isHex64(manifest.integrityRoot)) blockers.push('integrity_root_invalid');

const generatedAtMs = parseTimestamp(manifest.generatedAt);
if (generatedAtMs === null) blockers.push('generated_at_invalid');
else if (generatedAtMs > Date.now() + 60_000) blockers.push('generated_at_in_future');

const components = Array.isArray(manifest.components) ? manifest.components : [];
const ids = new Set();
const verified = [];
let rootReal = null;
try { rootReal = fs.realpathSync(args.root); } catch { blockers.push('evidence_root_missing'); }

for (const component of components) {
  const id = String(component?.id || '');
  const rel = String(component?.path || '');
  const expected = String(component?.sha256 || '').toLowerCase();
  if (!id || ids.has(id)) {
    blockers.push(id ? `duplicate_component:${id}` : 'component_id_missing');
    continue;
  }
  ids.add(id);
  if (!isHex64(expected)) blockers.push(`component_hash_invalid:${id}`);
  if (!rel || path.isAbsolute(rel) || rel.split(/[\\/]+/).includes('..')) {
    blockers.push(`component_path_unsafe:${id}`);
    continue;
  }
  if (SECRETISH.test(rel)) {
    blockers.push(`secret_material_path_forbidden:${id}`);
    continue;
  }
  if (!rootReal) continue;
  const candidate = path.resolve(rootReal, rel);
  let real;
  try { real = fs.realpathSync(candidate); } catch {
    blockers.push(`component_missing:${id}`);
    continue;
  }
  if (!(real === rootReal || real.startsWith(`${rootReal}${path.sep}`))) {
    blockers.push(`component_escapes_root:${id}`);
    continue;
  }
  let stat;
  try { stat = fs.statSync(real); } catch {
    blockers.push(`component_unreadable:${id}`);
    continue;
  }
  if (!stat.isFile()) {
    blockers.push(`component_not_file:${id}`);
    continue;
  }
  const actual = fileHash(real);
  if (isHex64(expected) && actual !== expected) blockers.push(`component_hash_mismatch:${id}`);
  verified.push({ id, path: rel, sha256: actual });
}

for (const required of REQUIRED_COMPONENTS) {
  if (!ids.has(required)) blockers.push(`required_component_missing:${required}`);
}

const anchor = {
  network: manifest.network,
  chainId,
  releaseCommit: String(manifest.releaseCommit || '').toLowerCase(),
  imageDigest: String(manifest.imageDigest || '').toLowerCase()
};
const leaves = [hash(bytes({ type: 'release-anchor', ...anchor }))];
for (const component of [...verified].sort((a, b) => a.id.localeCompare(b.id))) {
  leaves.push(hash(bytes({ type: 'component', ...component })));
}
const computedIntegrityRoot = merkleRoot(leaves);
if (isHex64(manifest.integrityRoot) && computedIntegrityRoot !== String(manifest.integrityRoot).toLowerCase()) {
  blockers.push('integrity_root_mismatch');
}

const report = {
  ok: blockers.length === 0,
  policy: 'zoryq-launch-integrity-root-v1',
  network: manifest.network || null,
  chainId: Number.isSafeInteger(chainId) ? chainId : null,
  releaseCommit: manifest.releaseCommit || null,
  imageDigest: manifest.imageDigest || null,
  generatedAt: manifest.generatedAt || null,
  integrityRoot: computedIntegrityRoot,
  declaredIntegrityRoot: manifest.integrityRoot || null,
  componentCount: verified.length,
  requiredComponents: REQUIRED_COMPONENTS,
  verifiedComponents: verified.map(({ id, sha256 }) => ({ id, sha256 })),
  blockers
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (blockers.length) process.exit(80);
