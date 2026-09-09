import http from 'node:http';
import { spawn } from 'node:child_process';

const PORT = Number(process.env.PORT || 8080);
const EDGE_PORT = Number(process.env.ZORYQ_INTERNAL_EDGE_PORT || 8084);
const MAX_BODY_BYTES = Math.max(64_000, Number(process.env.ZORYQ_MAX_BODY_BYTES || 1_000_000));
const MAX_RPC_BATCH = Math.max(1, Number(process.env.ZORYQ_MAX_RPC_BATCH || 50));
const GLOBAL_RPC_CONCURRENCY = Math.max(4, Number(process.env.ZORYQ_RPC_CONCURRENCY || 64));
const PER_IP_RPC_CONCURRENCY = Math.max(2, Number(process.env.ZORYQ_RPC_IP_CONCURRENCY || 12));
const RPC_PER_MINUTE = Math.max(30, Number(process.env.ZORYQ_RPC_PER_MINUTE || 600));
const FAUCET_PER_HOUR_IP = Math.max(1, Number(process.env.ZORYQ_FAUCET_PER_HOUR_IP || 5));
const FAUCET_GLOBAL_PER_HOUR = Math.max(10, Number(process.env.ZORYQ_FAUCET_GLOBAL_PER_HOUR || 300));
const UPSTREAM_TIMEOUT_MS = Math.max(1000, Number(process.env.ZORYQ_UPSTREAM_TIMEOUT_MS || 15_000));

const edge = spawn(process.execPath, ['edge-gateway.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: String(EDGE_PORT) },
});
edge.on('exit', (code, signal) => {
  console.error('ZORYQ edge gateway exited', { code, signal });
  process.exit(code || 1);
});
process.on('SIGTERM', () => edge.kill('SIGTERM'));
process.on('SIGINT', () => edge.kill('SIGINT'));

const rpcMinute = new Map();
const faucetHour = new Map();
const rpcInFlightByIp = new Map();
let rpcInFlight = 0;
let faucetGlobal = { window: Math.floor(Date.now() / 3_600_000), count: 0 };

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown');
}
function windowAllow(map, key, windowMs, limit) {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now - current.started >= windowMs) {
    map.set(key, { started: now, count: 1 });
    return true;
  }
  if (current.count >= limit) return false;
  current.count++;
  return true;
}
function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    ...headers,
  });
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function faucetGlobalAllow() {
  const window = Math.floor(Date.now() / 3_600_000);
  if (faucetGlobal.window !== window) faucetGlobal = { window, count: 0 };
  if (faucetGlobal.count >= FAUCET_GLOBAL_PER_HOUR) return false;
  faucetGlobal.count++;
  return true;
}
function releaseRpc(ip) {
  rpcInFlight = Math.max(0, rpcInFlight - 1);
  const n = Math.max(0, Number(rpcInFlightByIp.get(ip) || 0) - 1);
  if (n) rpcInFlightByIp.set(ip, n); else rpcInFlightByIp.delete(ip);
}
function proxy(req, res, body, ip, isRpc = false) {
  const headers = { ...req.headers, host: `127.0.0.1:${EDGE_PORT}` };
  if (body) headers['content-length'] = String(body.length);
  const upstream = http.request({ hostname: '127.0.0.1', port: EDGE_PORT, path: req.url, method: req.method, headers }, (u) => {
    res.writeHead(u.statusCode || 502, u.headers);
    u.pipe(res);
  });
  upstream.setTimeout(UPSTREAM_TIMEOUT_MS, () => upstream.destroy(new Error('upstream_timeout')));
  upstream.on('error', (error) => {
    if (!res.headersSent) sendJson(res, error.message === 'upstream_timeout' ? 504 : 503, { ok: false, error: error.message === 'upstream_timeout' ? 'upstream_timeout' : 'gateway_unavailable' });
    else res.destroy();
  });
  if (isRpc) upstream.on('close', () => releaseRpc(ip));
  if (body) upstream.end(body); else req.pipe(upstream);
}

const server = http.createServer(async (req, res) => {
  const ip = clientIp(req);
  const url = new URL(req.url || '/', 'http://localhost');
  const isRpc = req.method === 'POST' && (url.pathname === '/rpc' || url.pathname === '/');
  const isFaucet = req.method === 'POST' && url.pathname === '/faucet';

  try {
    if (isRpc) {
      if (!windowAllow(rpcMinute, ip, 60_000, RPC_PER_MINUTE)) return sendJson(res, 429, { jsonrpc: '2.0', id: null, error: { code: -32005, message: 'RPC rate limit exceeded' } }, { 'retry-after': '60' });
      const ipInflight = Number(rpcInFlightByIp.get(ip) || 0);
      if (rpcInFlight >= GLOBAL_RPC_CONCURRENCY || ipInflight >= PER_IP_RPC_CONCURRENCY) return sendJson(res, 503, { jsonrpc: '2.0', id: null, error: { code: -32005, message: 'RPC temporarily saturated; retry shortly' } }, { 'retry-after': '1' });
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body.toString('utf8')); } catch { return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }); }
      if (Array.isArray(payload) && payload.length > MAX_RPC_BATCH) return sendJson(res, 413, { jsonrpc: '2.0', id: null, error: { code: -32600, message: `JSON-RPC batch limit is ${MAX_RPC_BATCH}` } });
      rpcInFlight++;
      rpcInFlightByIp.set(ip, ipInflight + 1);
      return proxy(req, res, body, ip, true);
    }

    if (isFaucet) {
      if (!windowAllow(faucetHour, ip, 3_600_000, FAUCET_PER_HOUR_IP)) return sendJson(res, 429, { ok: false, error: 'faucet_ip_rate_limit' }, { 'retry-after': '3600' });
      if (!faucetGlobalAllow()) return sendJson(res, 503, { ok: false, error: 'faucet_circuit_breaker' }, { 'retry-after': '3600' });
      const body = await readBody(req);
      return proxy(req, res, body, ip, false);
    }

    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) return sendJson(res, 413, { ok: false, error: 'request_too_large' });
    return proxy(req, res, null, ip, false);
  } catch (error) {
    return sendJson(res, Number(error.status || 500), { ok: false, error: error.message || 'internal_error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ZORYQ traffic gateway listening on :${PORT}; protected edge :${EDGE_PORT}`);
  console.log('ZORYQ public protection enabled', { MAX_BODY_BYTES, MAX_RPC_BATCH, GLOBAL_RPC_CONCURRENCY, PER_IP_RPC_CONCURRENCY, RPC_PER_MINUTE, FAUCET_PER_HOUR_IP, FAUCET_GLOBAL_PER_HOUR, UPSTREAM_TIMEOUT_MS });
});
