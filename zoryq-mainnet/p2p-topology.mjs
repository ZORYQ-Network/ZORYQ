import fs from 'node:fs';
import path from 'node:path';

function fail(message, code = 64) {
  process.stdout.write(`${JSON.stringify({ ok: false, error: message })}\n`);
  process.exit(code);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || argv[i + 1] === undefined) fail('usage: node p2p-topology.mjs --registry <validator-registry.json> --identities <p2p-identities.json> --out <directory>');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
function parseEnode(value) {
  const match = /^enode:\/\/([0-9a-fA-F]{128})@([^:/\s]+):(\d{2,5})$/.exec(String(value || '').trim());
  if (!match) return null;
  const port = Number(match[3]);
  if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) return null;
  return { nodeId: match[1].toLowerCase(), host: match[2].toLowerCase(), port, enode: String(value).trim() };
}

const args = parseArgs(process.argv);
if (!args.registry || !args.identities || !args.out) fail('usage: node p2p-topology.mjs --registry <validator-registry.json> --identities <p2p-identities.json> --out <directory>');
let registry, identities;
try { registry = JSON.parse(fs.readFileSync(args.registry, 'utf8')); } catch { fail('validator_registry_invalid_json'); }
try { identities = JSON.parse(fs.readFileSync(args.identities, 'utf8')); } catch { fail('p2p_identities_invalid_json'); }
if (registry?.formatVersion !== 2 || registry?.network !== 'ZORYQ Mainnet') fail('validator_registry_v2_mainnet_required');
const validators = Array.isArray(registry.validators) ? registry.validators : [];
if (validators.length < 4) fail('minimum_four_validators_required');
const entries = Array.isArray(identities?.nodes) ? identities.nodes : [];
if (entries.length !== validators.length) fail('p2p_identity_count_must_match_validator_count');

const identityByOperator = new Map();
const enodes = new Set();
const nodeIds = new Set();
for (const entry of entries) {
  const operatorId = String(entry?.operatorId || '').trim().toLowerCase();
  if (!operatorId || identityByOperator.has(operatorId)) fail('duplicate_or_missing_operator_identity');
  const parsed = parseEnode(entry?.enode);
  if (!parsed) fail(`invalid_enode:${entry?.operatorId || 'unknown'}`);
  if (enodes.has(parsed.enode.toLowerCase())) fail(`duplicate_enode:${entry.operatorId}`);
  if (nodeIds.has(parsed.nodeId)) fail(`duplicate_p2p_node_id:${entry.operatorId}`);
  identityByOperator.set(operatorId, parsed);
  enodes.add(parsed.enode.toLowerCase());
  nodeIds.add(parsed.nodeId);
}

const topology = [];
for (const validator of validators) {
  const operatorId = String(validator.operatorId || '').trim();
  const identity = identityByOperator.get(operatorId.toLowerCase());
  if (!identity) fail(`missing_p2p_identity:${operatorId}`);
  if (identity.host !== String(validator.p2pHost || '').trim().toLowerCase()) fail(`p2p_host_registry_mismatch:${operatorId}`);
  if (identity.port !== Number(validator.p2pPort)) fail(`p2p_port_registry_mismatch:${operatorId}`);
  const bootnodes = entries
    .filter((item) => String(item.operatorId || '').trim().toLowerCase() !== operatorId.toLowerCase())
    .map((item) => String(item.enode).trim());
  if (bootnodes.length < 2) fail(`insufficient_bootnodes:${operatorId}`);
  topology.push({
    operatorId,
    region: validator.region,
    p2pHost: validator.p2pHost,
    p2pPort: validator.p2pPort,
    enode: identity.enode,
    bootnodes,
    environment: {
      ZORYQ_MAINNET_P2P_ADDR: '0.0.0.0',
      ZORYQ_MAINNET_P2P_PORT: String(validator.p2pPort),
      ZORYQ_MAINNET_BOOTNODES: bootnodes.join(','),
      ZORYQ_MAINNET_P2P_SECRET_KEY_PATH: '/run/secrets/zoryq-p2p-secret-key'
    }
  });
}
const regions = new Set(topology.map((item) => String(item.region).toLowerCase()));
if (regions.size < 3) fail('minimum_three_regions_required');
const outDir = path.resolve(args.out);
fs.mkdirSync(outDir, { recursive: true });
const document = {
  formatVersion: 1,
  network: 'ZORYQ Mainnet',
  validatorCount: topology.length,
  operatorCount: topology.length,
  regionCount: regions.size,
  bootnodeRedundancyPerNode: Math.min(...topology.map((item) => item.bootnodes.length)),
  nodes: topology,
  containsPrivateKeyMaterial: false,
  rule: 'zoryq-mainnet-p2p-topology-v1'
};
fs.writeFileSync(path.join(outDir, 'p2p-topology.json'), `${JSON.stringify(document, null, 2)}\n`, { mode: 0o644 });
process.stdout.write(`${JSON.stringify({ ok: true, validatorCount: topology.length, regionCount: regions.size, bootnodeRedundancyPerNode: document.bootnodeRedundancyPerNode, output: path.join(outDir, 'p2p-topology.json') }, null, 2)}\n`);
