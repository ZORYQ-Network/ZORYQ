import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createGzip } from 'node:zlib';
import { finished } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';

const RPC_HOST = process.env.ZORYQ_INTERNAL_RPC_HOST || '127.0.0.1';
const RPC_PORT = Number(process.env.ZORYQ_INTERNAL_RPC_PORT || 8545);
const CURRENT = process.env.ZORYQ_STATE_CURRENT || '/data/zoryq-state.current.json.gz';
const PREVIOUS = process.env.ZORYQ_STATE_PREVIOUS || '/data/zoryq-state.previous.json.gz';
const TMP = process.env.ZORYQ_STATE_TMP || '/data/zoryq-state.checkpoint.tmp.gz';
const STATUS = process.env.ZORYQ_PERSISTENCE_STATUS || '/data/zoryq-persistence-status.json';
const LOCK = process.env.ZORYQ_PERSISTENCE_LOCK || '/data/zoryq-persistence.lock';
const VALIDATOR = process.env.ZORYQ_STREAM_VALIDATOR || '/app/persistence-validator.mjs';
const TEST_DELAY_MS = Math.max(0, Number(process.env.ZORYQ_RPC_CHECKPOINT_TEST_DELAY_MS || 0));
const RESULT_PREFIX = '"result":"0x';
let lockOwned = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function atomicJson(file, value) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value));
  const fd = fs.openSync(tmp, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, file);
}

function previousStatus() {
  try { return JSON.parse(fs.readFileSync(STATUS, 'utf8')); } catch { return {}; }
}

function diskPercent() {
  const s = fs.statfsSync(path.dirname(CURRENT));
  const total = Number(s.blocks) * Number(s.bsize);
  const available = Number(s.bavail) * Number(s.bsize);
  return total > 0 ? Math.round((1 - available / total) * 100) : 0;
}

function writeStatus(ok, message, extra = {}) {
  const prev = previousStatus();
  const now = Date.now();
  const failures = ok ? 0 : Number(prev.consecutiveFailures || 0) + 1;
  atomicJson(STATUS, {
    version: 3,
    chainId: 5919065,
    ok,
    message,
    source: 'anvil_dumpState',
    lastAttemptAt: now,
    lastSuccessAt: ok ? now : prev.lastSuccessAt,
    checkpointSha256: ok ? extra.checkpointSha256 : prev.checkpointSha256,
    consecutiveFailures: failures,
    durationMs: Number(extra.durationMs || 0),
    diskPercent: Number(extra.diskPercent ?? diskPercent()),
    rawStateBytes: ok ? Number(extra.rawStateBytes || 0) : prev.rawStateBytes,
    compressedBytes: ok ? Number(extra.compressedBytes || 0) : prev.compressedBytes,
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
  try { if (fs.existsSync(TMP)) fs.unlinkSync(TMP); } catch {}
  if (lockOwned) {
    try { fs.rmSync(LOCK, { recursive: true, force: true }); } catch {}
    lockOwned = false;
  }
}

function rpcResponse() {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_dumpState', params: [false] }));
    const req = http.request({
      host: RPC_HOST,
      port: RPC_PORT,
      path: '/',
      method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': String(body.length) },
    }, resolve);
    req.setTimeout(120_000, () => req.destroy(new Error('anvil_dumpState timeout')));
    req.on('error', reject);
    req.end(body);
  });
}

async function dumpToGzip() {
  fs.rmSync(TMP, { force: true });
  const response = await rpcResponse();
  if (response.statusCode !== 200) throw new Error(`anvil_dumpState HTTP ${response.statusCode}`);

  const gzip = createGzip({ level: 6 });
  const output = fs.createWriteStream(TMP, { flags: 'wx' });
  gzip.pipe(output);

  let found = false;
  let ended = false;
  let search = '';
  let nibble = '';
  let rawStateBytes = 0;

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
    const hexPart = quote >= 0 ? text.slice(0, quote) : text;
    if (hexPart && !/^[0-9a-fA-F]+$/.test(hexPart)) throw new Error('invalid hex in anvil_dumpState result');
    let hex = nibble + hexPart;
    if (hex.length % 2) {
      nibble = hex.slice(-1);
      hex = hex.slice(0, -1);
    } else {
      nibble = '';
    }
    if (hex.length) {
      const bytes = Buffer.from(hex, 'hex');
      rawStateBytes += bytes.length;
      if (!gzip.write(bytes)) await once(gzip, 'drain');
    }
    if (quote >= 0) ended = true;
  }

  if (!found || !ended || nibble) throw new Error('incomplete anvil_dumpState response');
  gzip.end();
  await finished(output);
  return rawStateBytes;
}

function validateCheckpoint(file) {
  const result = spawnSync(process.execPath, [VALIDATOR, file, '--gzip'], { stdio: 'ignore' });
  return result.status === 0;
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

function durableFile(file) {
  const fd = fs.openSync(file, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

async function main() {
  if (!acquireLock()) {
    console.log('[zoryq-state] RPC checkpoint coalesced: writer already active');
    return;
  }

  const started = Date.now();
  const disk = diskPercent();
  if (disk >= 85) {
    writeStatus(false, 'disk_critical_checkpoint_deferred', { diskPercent: disk });
    throw new Error(`disk critical ${disk}%`);
  }
  if (disk >= 70) console.log(`[zoryq-state] disk warning ${disk}%`);

  try {
    const rawStateBytes = await dumpToGzip();
    if (!validateCheckpoint(TMP)) throw new Error('RPC checkpoint JSON validation failed');
    durableFile(TMP);
    const digest = await sha256(TMP);

    // Test-only crash injection point. Production leaves this at zero.
    if (TEST_DELAY_MS > 0) {
      console.log(`[zoryq-state] test crash window open for ${TEST_DELAY_MS}ms`);
      await sleep(TEST_DELAY_MS);
    }

    // At high disk pressure preserve only one known-good checkpoint. Otherwise keep one previous.
    if (disk >= 80) fs.rmSync(PREVIOUS, { force: true });
    else if (fs.existsSync(CURRENT)) fs.renameSync(CURRENT, PREVIOUS);

    fs.renameSync(TMP, CURRENT);
    durableFile(CURRENT);
    const compressedBytes = fs.statSync(CURRENT).size;
    const durationMs = Date.now() - started;
    writeStatus(true, 'checkpoint_committed', {
      checkpointSha256: digest,
      durationMs,
      diskPercent: disk,
      rawStateBytes,
      compressedBytes,
    });
    console.log(`[zoryq-state] RPC atomic checkpoint committed sha256=${digest} rawBytes=${rawStateBytes} compressedBytes=${compressedBytes} durationMs=${durationMs}`);
  } catch (error) {
    writeStatus(false, String(error?.message || error), { diskPercent: disk, durationMs: Date.now() - started });
    throw error;
  }
}

process.on('SIGINT', () => { cleanup(); process.exit(130); });
process.on('SIGTERM', () => { cleanup(); process.exit(143); });
try {
  await main();
} finally {
  cleanup();
}
