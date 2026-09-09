import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGzip, createGunzip } from 'node:zlib';
import { finished } from 'node:stream/promises';
import { once } from 'node:events';

const RPC_HOST = process.env.ZORYQ_INTERNAL_RPC_HOST || '127.0.0.1';
const RPC_PORT = Number(process.env.ZORYQ_INTERNAL_RPC_PORT || 8545);
const ROOT = process.env.ZORYQ_CHECKPOINT_ROOT || '/data/zoryq-checkpoints';
const CURRENT = path.join(ROOT, 'current');
const PREVIOUS = path.join(ROOT, 'previous');
const TMP = path.join(ROOT, `.tmp-${process.pid}-${Date.now()}`);
const STATUS = process.env.ZORYQ_PERSISTENCE_STATUS || '/data/zoryq-persistence-status.json';
const LOCK = path.join(ROOT, '.writer-lock');
const TEST_DELAY_MS = Math.max(0, Number(process.env.ZORYQ_RPC_CHECKPOINT_TEST_DELAY_MS || 0));
const RESULT_PREFIX = '"result":"0x';
const EXPECTED_CHAIN_ID = '0x5a5159';
const EXPECTED_CHAIN_ID_DEC = 5919065;
let lockOwned = false;
let restoreMiningInterval = null;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureRoot() { fs.mkdirSync(ROOT, { recursive: true }); }
function atomicJson(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  durableFile(tmp);
  fs.renameSync(tmp, file);
  durableDir(path.dirname(file));
}
function previousStatus() { try { return JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch { return {}; } }
function diskPercent() {
  const s = fs.statfsSync(ROOT);
  const total = Number(s.blocks) * Number(s.bsize);
  const available = Number(s.bavail) * Number(s.bsize);
  return total > 0 ? Math.round((1 - available / total) * 100) : 0;
}
function durableFile(file) {
  const fd = fs.openSync(file, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function durableDir(dir) {
  try {
    const fd = fs.openSync(dir, 'r');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch {}
}
function writeStatus(ok, message, extra = {}) {
  const prev = previousStatus();
  const now = Date.now();
  const failures = ok ? 0 : Number(prev.consecutiveFailures || 0) + 1;
  atomicJson(STATUS, {
    version: 4,
    chainId: EXPECTED_CHAIN_ID_DEC,
    ok,
    message,
    source: 'anvil_dumpState_blob',
    lastAttemptAt: now,
    lastSuccessAt: ok ? now : prev.lastSuccessAt,
    checkpointSha256: ok ? extra.checkpointSha256 : prev.checkpointSha256,
    consecutiveFailures: failures,
    durationMs: Number(extra.durationMs || 0),
    diskPercent: Number(extra.diskPercent ?? diskPercent()),
    rawStateBytes: ok ? Number(extra.rawStateBytes || 0) : prev.rawStateBytes,
    compressedBytes: ok ? Number(extra.compressedBytes || 0) : prev.compressedBytes,
    blockNumber: ok ? extra.blockNumber : prev.blockNumber,
    blockHash: ok ? extra.blockHash : prev.blockHash,
  });
}
function acquireLock() {
  try {
    fs.mkdirSync(LOCK);
    lockOwned = true;
    fs.writeFileSync(path.join(LOCK, 'owner'), `${process.pid}\n`);
    return true;
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
}
function cleanup() {
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
  if (lockOwned) {
    try { fs.rmSync(LOCK, { recursive: true, force: true }); } catch {}
    lockOwned = false;
  }
}
async function jsonRpc(method, params = []) {
  const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }));
  return await new Promise((resolve, reject) => {
    const req = http.request({ host: RPC_HOST, port: RPC_PORT, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(body.length) } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; if (text.length > 2_000_000) req.destroy(new Error('RPC response too large')); });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(text || '{}');
          if (res.statusCode !== 200) throw new Error(`${method} HTTP ${res.statusCode}`);
          if (parsed.error) throw new Error(`${method}: ${parsed.error.message || 'rpc_error'}`);
          resolve(parsed.result);
        } catch (error) { reject(error); }
      });
    });
    req.setTimeout(30_000, () => req.destroy(new Error(`${method} timeout`)));
    req.on('error', reject);
    req.end(body);
  });
}
function dumpRpcResponse() {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_dumpState', params: [false] }));
    const req = http.request({ host: RPC_HOST, port: RPC_PORT, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': String(body.length) } }, resolve);
    req.setTimeout(120_000, () => req.destroy(new Error('anvil_dumpState timeout')));
    req.on('error', reject);
    req.end(body);
  });
}
async function dumpHexToGzip(file) {
  const response = await dumpRpcResponse();
  if (response.statusCode !== 200) throw new Error(`anvil_dumpState HTTP ${response.statusCode}`);
  const gzip = createGzip({ level: 6 });
  const output = fs.createWriteStream(file, { flags: 'wx' });
  gzip.pipe(output);
  let found = false;
  let ended = false;
  let search = '';
  let hexChars = 0;
  for await (const chunk of response) {
    let text = chunk.toString('utf8');
    if (!found) {
      search += text;
      const index = search.indexOf(RESULT_PREFIX);
      if (index < 0) {
        search = search.slice(-Math.max(RESULT_PREFIX.length - 1, 1));
        continue;
      }
      found = true;
      text = search.slice(index + RESULT_PREFIX.length);
      search = '';
    }
    if (ended) continue;
    const quote = text.indexOf('"');
    const part = quote >= 0 ? text.slice(0, quote) : text;
    if (part && !/^[0-9a-fA-F]+$/.test(part)) throw new Error('invalid hex in anvil_dumpState result');
    if (part) {
      hexChars += part.length;
      if (!gzip.write(part.toLowerCase())) await once(gzip, 'drain');
    }
    if (quote >= 0) ended = true;
  }
  if (!found || !ended || hexChars === 0 || hexChars % 2 !== 0) throw new Error('incomplete anvil_dumpState hex payload');
  gzip.end();
  await finished(output);
  return { rawStateBytes: hexChars / 2, hexChars };
}
async function validateHexGzip(file, expectedHexChars) {
  const gunzip = createGunzip();
  const input = fs.createReadStream(file);
  input.pipe(gunzip);
  let count = 0;
  for await (const chunk of gunzip) {
    const text = chunk.toString('ascii');
    if (!/^[0-9a-f]*$/.test(text)) throw new Error('checkpoint contains non-hex data');
    count += text.length;
  }
  if (count === 0 || count % 2 !== 0) throw new Error('checkpoint hex payload invalid');
  if (expectedHexChars != null && count !== expectedHexChars) throw new Error(`checkpoint length mismatch ${count} != ${expectedHexChars}`);
  return count;
}
async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function pauseMining() {
  const current = await jsonRpc('anvil_getIntervalMining', []);
  restoreMiningInterval = current == null ? 2 : Number(current);
  await jsonRpc('evm_setIntervalMining', [0]);
  await sleep(100);
}
async function resumeMining() {
  if (restoreMiningInterval == null) return;
  const interval = Math.max(1, Number(restoreMiningInterval || 2));
  restoreMiningInterval = null;
  try { await jsonRpc('evm_setIntervalMining', [interval]); } catch (error) { console.error('[zoryq-state] failed to resume interval mining', error?.message || error); }
}
async function currentHead() {
  const chainId = await jsonRpc('eth_chainId', []);
  if (String(chainId).toLowerCase() !== EXPECTED_CHAIN_ID) throw new Error(`chain id mismatch ${chainId}`);
  const blockNumber = await jsonRpc('eth_blockNumber', []);
  const block = await jsonRpc('eth_getBlockByNumber', [blockNumber, false]);
  if (!block?.hash) throw new Error('latest block hash unavailable');
  return { chainId: EXPECTED_CHAIN_ID_DEC, chainIdHex: EXPECTED_CHAIN_ID, blockNumber: String(blockNumber).toLowerCase(), blockHash: String(block.hash).toLowerCase() };
}
function rotate(tmpDir) {
  fs.rmSync(PREVIOUS, { recursive: true, force: true });
  if (fs.existsSync(CURRENT)) fs.renameSync(CURRENT, PREVIOUS);
  fs.renameSync(tmpDir, CURRENT);
  durableDir(ROOT);
}

async function main() {
  ensureRoot();
  if (!acquireLock()) {
    console.log('[zoryq-state] RPC checkpoint coalesced: writer already active');
    return;
  }
  const started = Date.now();
  const disk = diskPercent();
  if (disk >= 90) {
    writeStatus(false, 'disk_critical_checkpoint_deferred', { diskPercent: disk });
    throw new Error(`disk critical ${disk}%`);
  }
  if (disk >= 70) console.log(`[zoryq-state] disk warning ${disk}%`);
  fs.mkdirSync(TMP, { recursive: false });
  const blob = path.join(TMP, 'state.hex.gz');
  const metaFile = path.join(TMP, 'meta.json');
  try {
    await pauseMining();
    const head = await currentHead();
    const { rawStateBytes, hexChars } = await dumpHexToGzip(blob);
    const headAfter = await currentHead();
    if (headAfter.blockNumber !== head.blockNumber || headAfter.blockHash !== head.blockHash) throw new Error('head changed while checkpoint mining was paused');
    await validateHexGzip(blob, hexChars);
    durableFile(blob);
    const checkpointSha256 = await sha256(blob);
    const compressedBytes = fs.statSync(blob).size;
    const meta = {
      version: 1,
      format: 'anvil_dumpState_hex_gzip_v1',
      chainId: head.chainId,
      chainIdHex: head.chainIdHex,
      blockNumber: head.blockNumber,
      blockHash: head.blockHash,
      createdAt: Date.now(),
      checkpointSha256,
      rawStateBytes,
      hexChars,
      compressedBytes,
    };
    atomicJson(metaFile, meta);
    durableDir(TMP);
    if (TEST_DELAY_MS > 0) {
      console.log(`[zoryq-state] test crash window open for ${TEST_DELAY_MS}ms`);
      await sleep(TEST_DELAY_MS);
    }
    rotate(TMP);
    const durationMs = Date.now() - started;
    writeStatus(true, 'checkpoint_committed', { ...meta, durationMs, diskPercent: disk });
    console.log(`[zoryq-state] RPC atomic blob checkpoint committed sha256=${checkpointSha256} block=${head.blockNumber} hash=${head.blockHash} rawBytes=${rawStateBytes} compressedBytes=${compressedBytes} durationMs=${durationMs}`);
  } catch (error) {
    writeStatus(false, String(error?.message || error), { diskPercent: disk, durationMs: Date.now() - started });
    throw error;
  } finally {
    await resumeMining();
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
try { await main(); } finally { cleanup(); }
