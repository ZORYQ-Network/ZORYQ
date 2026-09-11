import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const TESTNET_CHAIN_ID = 5919065;
const PRODUCTION_NETWORK = 'ZORYQ Mainnet';

function fail(message, code = 2) {
  console.error(`[zoryq-mainnet] ${message}`);
  process.exit(code);
}
function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}
function normalizeHex(value, field) {
  const text = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]+$/.test(text)) fail(`${field} must be 0x-prefixed hexadecimal`);
  return text;
}
function normalizeAddress(value, field = 'allocation address') {
  const text = String(value || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(text)) fail(`invalid ${field}: ${value}`);
  if (text === '0x0000000000000000000000000000000000000000') fail(`${field} must not be the zero address`);
  return text;
}
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) fail('usage: node genesis-ceremony.mjs --config <file> --out <directory>');
    args[key.slice(2)] = value;
  }
  return args;
}

const args = parseArgs(process.argv);
if (!args.config || !args.out) fail('usage: node genesis-ceremony.mjs --config <file> --out <directory>');

const raw = fs.readFileSync(args.config, 'utf8');
const lowered = raw.toLowerCase();
for (const forbidden of ['mnemonic', 'privatekey', 'private_key', 'secretkey', 'secret_key']) {
  if (lowered.includes(forbidden)) fail(`secret material is forbidden in genesis ceremony config: ${forbidden}`);
}

let cfg;
try { cfg = JSON.parse(raw); } catch { fail('config is not valid JSON'); }
const network = String(cfg.network || '').trim();
if (!network) fail('network must be declared');
const chainId = Number(cfg.chainId);
if (!Number.isSafeInteger(chainId) || chainId <= 0) fail('chainId must be a positive safe integer');
if (chainId === TESTNET_CHAIN_ID) fail('mainnet chainId must differ from ZORYQ testnet chainId');
if (String(cfg.consensus || '').toLowerCase() === 'dev') fail('dev consensus is forbidden for mainnet genesis');
if (!String(cfg.consensus || '').trim()) fail('consensus must be declared');

const timestamp = normalizeHex(cfg.timestamp, 'timestamp');
const gasLimit = normalizeHex(cfg.gasLimit || '0x1c9c380', 'gasLimit');
const baseFeePerGas = normalizeHex(cfg.baseFeePerGas || '0x3b9aca00', 'baseFeePerGas');
const extraData = String(cfg.extraData ?? '0x').toLowerCase();
if (!/^0x(?:[0-9a-f]{2})*$/.test(extraData)) fail('extraData must be even-length 0x-prefixed hex');

const allocations = Array.isArray(cfg.allocations) ? cfg.allocations : [];
const alloc = {};
let allocationTotalWei = 0n;
for (const item of allocations) {
  const address = normalizeAddress(item?.address);
  if (alloc[address]) fail(`duplicate allocation address: ${address}`);
  const balance = normalizeHex(item?.balanceWei, `balanceWei for ${address}`);
  const balanceWei = BigInt(balance);
  if (balanceWei <= 0n) fail(`allocation must be positive for ${address}`);
  allocationTotalWei += balanceWei;
  alloc[address] = { balance };
}

let treasuryAddress = null;
let expectedAllocTotalWei = null;
if (network === PRODUCTION_NETWORK) {
  if (allocations.length === 0) fail('production genesis must contain at least one explicit allocation');
  treasuryAddress = normalizeAddress(cfg.treasuryAddress, 'treasuryAddress');
  if (!alloc[treasuryAddress]) fail('production treasuryAddress must have an explicit genesis allocation');
  expectedAllocTotalWei = BigInt(normalizeHex(cfg.expectedAllocTotalWei, 'expectedAllocTotalWei'));
  if (expectedAllocTotalWei <= 0n) fail('expectedAllocTotalWei must be positive');
  if (allocationTotalWei !== expectedAllocTotalWei) {
    fail(`allocation total mismatch: expected ${expectedAllocTotalWei.toString()} wei, got ${allocationTotalWei.toString()} wei`);
  }
}

const sortedAlloc = Object.fromEntries(Object.entries(alloc).sort(([a], [b]) => a.localeCompare(b)));
const genesis = canonical({
  config: {
    chainId,
    homesteadBlock: 0,
    eip150Block: 0,
    eip155Block: 0,
    eip158Block: 0,
    byzantiumBlock: 0,
    constantinopleBlock: 0,
    petersburgBlock: 0,
    istanbulBlock: 0,
    berlinBlock: 0,
    londonBlock: 0,
    terminalTotalDifficulty: 0,
    terminalTotalDifficultyPassed: true,
    shanghaiTime: 0,
    cancunTime: 0
  },
  nonce: '0x0',
  timestamp,
  extraData,
  gasLimit,
  difficulty: '0x0',
  mixHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
  coinbase: '0x0000000000000000000000000000000000000000',
  baseFeePerGas,
  alloc: sortedAlloc,
  number: '0x0',
  gasUsed: '0x0',
  parentHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
});

const serialized = `${JSON.stringify(genesis, null, 2)}\n`;
const genesisSha256 = sha256Bytes(Buffer.from(serialized));
const sourceSha256 = sha256Bytes(Buffer.from(JSON.stringify(canonical(cfg))));
const outDir = path.resolve(args.out);
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'genesis.json'), serialized, { mode: 0o644 });
fs.writeFileSync(path.join(outDir, 'genesis.sha256'), `${genesisSha256}  genesis.json\n`, { mode: 0o644 });
fs.writeFileSync(path.join(outDir, 'ceremony.json'), `${JSON.stringify({
  formatVersion: 2,
  network,
  chainId,
  consensus: String(cfg.consensus),
  genesisSha256,
  sourceConfigSha256: sourceSha256,
  allocations: Object.keys(sortedAlloc).length,
  allocationTotalWei: allocationTotalWei.toString(),
  treasuryAddress,
  expectedAllocTotalWei: expectedAllocTotalWei?.toString() || null,
  supplyInvariantVerified: network === PRODUCTION_NETWORK,
  secretMaterialAccepted: false
}, null, 2)}\n`, { mode: 0o644 });

console.log(JSON.stringify({ ok: true, outDir, network, chainId, genesisSha256, allocations: Object.keys(sortedAlloc).length, allocationTotalWei: allocationTotalWei.toString(), supplyInvariantVerified: network === PRODUCTION_NETWORK }, null, 2));
