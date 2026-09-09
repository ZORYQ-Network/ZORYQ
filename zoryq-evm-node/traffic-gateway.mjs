import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const EDGE_PORT = Number(process.env.ZORYQ_INTERNAL_EDGE_PORT || 8084);
const MAX_BODY_BYTES = Math.max(64_000, Number(process.env.ZORYQ_MAX_BODY_BYTES || 1_000_000));
const MAX_RPC_BATCH = Math.max(1, Number(process.env.ZORYQ_MAX_RPC_BATCH || 50));
const GLOBAL_RPC_CONCURRENCY = Math.max(4, Number(process.env.ZORYQ_RPC_CONCURRENCY || 64));
const PER_IP_RPC_CONCURRENCY = Math.max(2, Number(process.env.ZORYQ_RPC_IP_CONCURRENCY || 12));
const RPC_PER_MINUTE = Math.max(30, Number(process.env.ZORYQ_RPC_PER_MINUTE || 600));
const FAUCET_PER_HOUR_IP = Math.max(1, Number(process.env.ZORYQ_FAUCET_PER_HOUR_IP || 5));
const FAUCET_CONCURRENCY = Math.max(1, Number(process.env.ZORYQ_FAUCET_CONCURRENCY || 8));
const FAUCET_SUCCESS_PER_HOUR = Math.max(10, Number(process.env.ZORYQ_FAUCET_SUCCESS_PER_HOUR || 300));
const UPSTREAM_TIMEOUT_MS = Math.max(1000, Number(process.env.ZORYQ_UPSTREAM_TIMEOUT_MS || 15_000));
const PERSISTENCE_STATUS = process.env.ZORYQ_PERSISTENCE_STATUS || '/data/zoryq-persistence-status.json';
const LEGACY_PERSISTENCE_CURRENT = process.env.ZORYQ_STATE_CURRENT || '/data/zoryq-state.current.json.gz';
const CHECKPOINT_ROOT = process.env.ZORYQ_CHECKPOINT_ROOT || '/data/zoryq-checkpoints';
const PERSISTENCE_MAX_AGE_MS = Math.max(300_000, Number(process.env.ZORYQ_PERSISTENCE_MAX_AGE_MS || 7_200_000));
const PERSISTENCE_GRACE_MS = Math.max(60_000, Number(process.env.ZORYQ_PERSISTENCE_GRACE_MS || 600_000));
const PERSISTENCE_MAX_FAILURES = Math.max(1, Number(process.env.ZORYQ_PERSISTENCE_MAX_FAILURES || 3));
const STARTED_AT = Date.now();

const edge = spawn(process.execPath, ['edge-gateway.mjs'], { stdio: 'inherit', env: { ...process.env, PORT: String(EDGE_PORT) } });
edge.on('exit', (code, signal) => { console.error('ZORYQ edge gateway exited', { code, signal }); process.exit(code || 1); });
process.on('SIGTERM', () => edge.kill('SIGTERM'));
process.on('SIGINT', () => edge.kill('SIGINT'));

const rpcMinute = new Map();
const faucetHour = new Map();
const rpcInFlightByIp = new Map();
let rpcInFlight = 0;
let faucetInFlight = 0;
let faucetSuccess = { window: Math.floor(Date.now() / 3_600_000), count: 0 };

function loadJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function nativeGenerationExists(name) {
  const dir = path.join(CHECKPOINT_ROOT, name);
  return fs.existsSync(path.join(dir, 'meta.json')) && fs.existsSync(path.join(dir, 'state.hex.gz'));
}
function checkpointAvailability(status) {
  const native = nativeGenerationExists('current') || nativeGenerationExists('previous');
  const legacy = fs.existsSync(LEGACY_PERSISTENCE_CURRENT);
  if (status?.source === 'anvil_dumpState_blob') return { exists: native, mode: 'native-rpc-blob', native, legacy };
  return { exists: legacy || native, mode: native ? 'native-rpc-blob' : 'legacy', native, legacy };
}
function persistenceHealth() {
  const now = Date.now();
  const status = loadJson(PERSISTENCE_STATUS);
  const availability = checkpointAvailability(status);
  if (!status) {
    const initializing = now - STARTED_AT <= PERSISTENCE_GRACE_MS;
    return { ready: initializing, state: initializing ? 'initializing' : 'degraded', checkpointExists: availability.exists, checkpointMode: availability.mode, nativeCurrent: nativeGenerationExists('current'), nativePrevious: nativeGenerationExists('previous'), reason: initializing ? 'awaiting_persistence_status' : 'persistence_status_missing' };
  }
  const lastSuccessAt = Number(status.lastSuccessAt || 0);
  const ageMs = lastSuccessAt ? Math.max(0, now - lastSuccessAt) : null;
  const failures = Number(status.consecutiveFailures || 0);
  const capacityDeferred = ['disk_critical_checkpoint_deferred', 'memory_critical_checkpoint_deferred'].includes(String(status.message || ''));
  const stale = !lastSuccessAt || ageMs > PERSISTENCE_MAX_AGE_MS;
  const repeatedHardFailure = !capacityDeferred && failures >= PERSISTENCE_MAX_FAILURES;
  const ready = availability.exists && !stale && !repeatedHardFailure;
  return { ready, state: ready ? (failures ? 'degraded' : 'healthy') : 'degraded', checkpointExists: availability.exists, checkpointMode: availability.mode, nativeCurrent: nativeGenerationExists('current'), nativePrevious: nativeGenerationExists('previous'), lastSuccessAt: lastSuccessAt || null, ageMs, consecutiveFailures: failures, message: status.message || null, checkpointSha256: status.checkpointSha256 || null, durationMs: status.durationMs ?? null, diskPercent: status.diskPercent ?? null, capacityDeferred };
}
function clientIp(req) { return String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').trim(); }
function windowAllow(map, key, windowMs, limit) { const now = Date.now(); const current = map.get(key); if (!current || now - current.started >= windowMs) { map.set(key, { started: now, count: 1 }); return true; } if (current.count >= limit) return false; current.count++; return true; }
function sendJson(res, status, body, headers = {}) { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', ...headers }); res.end(JSON.stringify(body)); }
async function readBody(req) { const chunks = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 }); chunks.push(chunk); } return Buffer.concat(chunks); }
function faucetSuccessWindow() { const window = Math.floor(Date.now() / 3_600_000); if (faucetSuccess.window !== window) faucetSuccess = { window, count: 0 }; return faucetSuccess; }
function faucetIssuanceAvailable() { return faucetSuccessWindow().count < FAUCET_SUCCESS_PER_HOUR; }
function markFaucetSuccess() { faucetSuccessWindow().count++; }
function releaseRpc(ip) { rpcInFlight = Math.max(0, rpcInFlight - 1); const n = Math.max(0, Number(rpcInFlightByIp.get(ip) || 0) - 1); if (n) rpcInFlightByIp.set(ip, n); else rpcInFlightByIp.delete(ip); }
function proxy(req, res, body, ip, isRpc = false) { const headers = { ...req.headers, host: `127.0.0.1:${EDGE_PORT}` }; if (body) headers['content-length'] = String(body.length); let released = false; const release = () => { if (released) return; released = true; if (isRpc) releaseRpc(ip); }; const upstream = http.request({ hostname: '127.0.0.1', port: EDGE_PORT, path: req.url, method: req.method, headers }, (u) => { res.writeHead(u.statusCode || 502, u.headers); u.pipe(res); u.on('end', release); }); upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => upstream.destroy(new Error('upstream_timeout'))); upstream.on('error', (error) => { release(); if (!res.headersSent) sendJson(res, error.message === 'upstream_timeout' ? 504 : 503, { ok: false, error: error.message === 'upstream_timeout' ? 'upstream_timeout' : 'gateway_unavailable' }); else res.destroy(); }); upstream.on('close', release); if (body) upstream.end(body); else req.pipe(upstream); }
function proxyFaucet(req, res, body) { const headers = { ...req.headers, host: `127.0.0.1:${EDGE_PORT}`, 'content-length': String(body.length) }; faucetInFlight++; let released = false; const release = () => { if (released) return; released = true; faucetInFlight = Math.max(0, faucetInFlight - 1); }; const upstream = http.request({ hostname: '127.0.0.1', port: EDGE_PORT, path: req.url, method: req.method, headers }, (u) => { const chunks = []; let size = 0; u.on('data', (chunk) => { size += chunk.length; if (size <= MAX_BODY_BYTES) chunks.push(chunk); }); u.on('end', () => { release(); const status = u.statusCode || 502; if (status >= 200 && status < 300) markFaucetSuccess(); res.writeHead(status, u.headers); res.end(Buffer.concat(chunks)); }); }); upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => upstream.destroy(new Error('upstream_timeout'))); upstream.on('error', (error) => { release(); if (!res.headersSent) sendJson(res, error.message === 'upstream_timeout' ? 504 : 503, { ok: false, error: error.message === 'upstream_timeout' ? 'upstream_timeout' : 'gateway_unavailable' }); else res.destroy(); }); upstream.on('close', release); upstream.end(body); }
function handleHealth(res) {
  const upstream = http.request({ hostname: '127.0.0.1', port: EDGE_PORT, path: '/health', method: 'GET' }, (u) => {
    let raw = ''; u.on('data', c => { if (raw.length < MAX_BODY_BYTES) raw += c; }); u.on('end', () => {
      let chain = null; try { chain = JSON.parse(raw); } catch {}
      const persistence = persistenceHealth();
      const chainReady = (u.statusCode || 500) < 300 && chain?.ok === true && Number(chain?.chainId) === 5919065 && Number.isFinite(Number(chain?.block));
      const ready = chainReady && persistence.ready;
      return sendJson(res, ready ? 200 : 503, { ok: ready, status: ready ? (persistence.state === 'healthy' ? 'healthy' : 'degraded') : 'not_ready', chain, persistence });
    });
  });
  upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => upstream.destroy(new Error('upstream_timeout')));
  upstream.on('error', e => sendJson(res, 503, { ok: false, status: 'not_ready', error: e.message, persistence: persistenceHealth() }));
  upstream.end();
}

const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url || '/', 'http://localhost');
  const isRpc = req.method === 'POST' && (url.pathname === '/rpc' || url.pathname === '/');
  const isFaucet = req.method === 'POST' && url.pathname === '/faucet';
  try {
    if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/ready')) return handleHealth(res);
    if (isRpc) {
      if (!windowAllow(rpcMinute, ip, 60_000, RPC_PER_MINUTE)) return sendJson(res, 429, { jsonrpc: '2.0', id: null, error: { code: -32005, message: 'RPC rate limit exceeded' } }, { 'retry-after': '60' });
      const ipInflight = Number(rpcInFlightByIp.get(ip) || 0);
      if (rpcInFlight >= GLOBAL_RPC_CONCURRENCY || ipInflight >= PER_IP_RPC_CONCURRENCY) return sendJson(res, 503, { jsonrpc: '2.0', id: null, error: { code: -32005, message: 'RPC temporarily saturated; retry shortly' } }, { 'retry-after': '1' });
      const body = await readBody(req); let payload; try { payload = JSON.parse(body.toString('utf8')); } catch { return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
      if (Array.isArray(payload) && payload.length > MAX_RPC_BATCH) return sendJson(res, 413, { jsonrpc: '2.0', id: null, error: { code: -32600, message: `JSON-RPC batch limit is ${MAX_RPC_BATCH}` } });
      rpcInFlight++; rpcInFlightByIp.set(ip, ipInflight + 1); return proxy(req, res, body, ip, true);
    }
    if (isFaucet) {
      if (!windowAllow(faucetHour, ip, 3_600_000, FAUCET_PER_HOUR_IP)) return sendJson(res, 429, { ok: false, error: 'faucet_ip_rate_limit' }, { 'retry-after': '3600' });
      if (faucetInFlight >= FAUCET_CONCURRENCY) return sendJson(res, 503, { ok: false, error: 'faucet_temporarily_saturated' }, { 'retry-after': '2' });
      if (!faucetIssuanceAvailable()) return sendJson(res, 503, { ok: false, error: 'faucet_issuance_budget_exhausted' }, { 'retry-after': '3600' });
      const body = await readBody(req); return proxyFaucet(req, res, body);
    }
    const declared = Number(req.headers['content-length'] || 0); if (declared > MAX_BODY_BYTES) return sendJson(res, 413, { ok: false, error: 'request_too_large' });
    return proxy(req, res, null, ip, false);
  } catch (error) { return sendJson(res, Number(error.status || 500), { ok: false, error: error.message || 'internal_error' }); }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ZORYQ traffic gateway listening on :${PORT}; protected edge :${EDGE_PORT}`);
  console.log('ZORYQ public protection enabled', { MAX_BODY_BYTES, MAX_RPC_BATCH, GLOBAL_RPC_CONCURRENCY, PER_IP_RPC_CONCURRENCY, RPC_PER_MINUTE, FAUCET_PER_HOUR_IP, FAUCET_CONCURRENCY, FAUCET_SUCCESS_PER_HOUR, UPSTREAM_TIMEOUT_MS, PERSISTENCE_MAX_AGE_MS, PERSISTENCE_MAX_FAILURES });
});
