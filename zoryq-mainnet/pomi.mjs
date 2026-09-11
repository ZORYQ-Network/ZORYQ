import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

function fail(message, code = 2) { console.error(`[pomi] ${message}`); process.exit(code); }
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    const k = argv[i], v = argv[i + 1];
    if (!k?.startsWith('--') || v === undefined) fail('usage: node pomi.mjs --manifest <json> --out <dir> [--genesis <genesis.json>]');
    out[k.slice(2)] = v;
  }
  return out;
}
function digestFile(file) {
  const bytes = fs.readFileSync(file);
  return { path: path.basename(file), sha256: sha256(bytes), bytes: bytes.length };
}

const args = parseArgs(process.argv);
if (!args.manifest || !args.out) fail('manifest and out are required');
const raw = fs.readFileSync(args.manifest, 'utf8');
if (/mnemonic|private[_-]?key|secret[_-]?key/i.test(raw)) fail('secret material forbidden in PoMI input');
let input; try { input = JSON.parse(raw); } catch { fail('manifest is not valid JSON'); }
if (!input.network || !input.chainId || !input.releaseCommit) fail('network, chainId and releaseCommit are required');
if (!/^[0-9a-f]{40}$/i.test(String(input.releaseCommit))) fail('releaseCommit must be a full 40-char git SHA');

const evidence = {};
for (const [name, file] of Object.entries(input.evidence || {})) {
  if (!file) continue;
  if (!fs.existsSync(file)) fail(`evidence missing: ${name}`);
  evidence[name] = digestFile(file);
}
const core = canonical({
  format: 'ZORYQ-PoMI-v1',
  network: String(input.network),
  chainId: Number(input.chainId),
  releaseCommit: String(input.releaseCommit).toLowerCase(),
  releaseTag: input.releaseTag ? String(input.releaseTag) : null,
  policy: {
    launchCertificateThreshold: Number(input.policy?.launchCertificateThreshold || 0),
    minimumIndependentOperators: Number(input.policy?.minimumIndependentOperators || 0),
    auditRequired: input.policy?.auditRequired !== false,
    incidentRunbookRequired: input.policy?.incidentRunbookRequired !== false,
    productionConsensusRequired: input.policy?.productionConsensusRequired !== false
  },
  evidence
});
if (core.policy.launchCertificateThreshold < 2) fail('launch certificate threshold must be >= 2');
if (core.policy.minimumIndependentOperators < 2) fail('minimumIndependentOperators must be >= 2');
const canonicalJson = JSON.stringify(core);
const commitment = sha256(Buffer.from(canonicalJson));
const anchorHex = `0x${commitment}`; // 32-byte commitment; suitable for genesis extraData where consensus permits.
const result = { ...core, commitmentAlgorithm: 'sha256', commitment, genesisAnchor: { field: 'extraData', value: anchorHex, bytes: 32 } };

if (args.genesis) {
  const genesis = JSON.parse(fs.readFileSync(args.genesis, 'utf8'));
  const actual = String(genesis.extraData || '').toLowerCase();
  if (actual !== anchorHex.toLowerCase()) fail('genesis extraData does not match PoMI commitment', 3);
  result.genesisAnchor.verified = true;
  result.genesisSha256 = sha256(fs.readFileSync(args.genesis));
}
const outDir = path.resolve(args.out); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'pomi.json'), `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(path.join(outDir, 'pomi.sha256'), `${sha256(fs.readFileSync(path.join(outDir, 'pomi.json')))}  pomi.json\n`);
console.log(JSON.stringify({ ok: true, commitment, anchorHex, evidenceCount: Object.keys(evidence).length, genesisVerified: Boolean(result.genesisAnchor.verified) }));
