import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const RETH_RPC_URL = String(process.env.ZORYQ_RETH_RPC_URL || 'http://127.0.0.1:8545');
const CHAIN_ID = Number(process.env.ZORYQ_MAINNET_CHAIN_ID || 0);
const TESTNET_CHAIN_ID = 5919065;
const MAX_BODY_BYTES = Number(process.env.ZORYQ_RPC_MAX_BODY_BYTES || 1_000_000);
const MAX_BATCH = Number(process.env.ZORYQ_RPC_MAX_BATCH || 50);
const RPC_RATE_LIMIT = Number(process.env.ZORYQ_MAINNET_RPC_RATE_LIMIT_PER_MINUTE || 600);
const MIN_PEERS = Number(process.env.ZORYQ_MAINNET_MIN_PEERS || 1);
const MAX_STALL_MS = Number(process.env.ZORYQ_MAINNET_MAX_STALL_MS || 30_000);
const TRUST_PROXY_HEADERS = String(process.env.ZORYQ_TRUST_PROXY_HEADERS || 'false').toLowerCase() === 'true';
const BLOCKED_PREFIXES = ['anvil_', 'hardhat_', 'evm_', 'debug_', 'trace_', 'admin_', 'engine_', 'miner_', 'personal_', 'reth_', 'txpool_'];
const BLOCKED_METHODS = new Set(['eth_accounts', 'eth_sendTransaction', 'eth_sign', 'eth_signTransaction', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']);
const rateWindows = new Map();
const startedAt = Date.now();
let lastBlockNumber = null;
let lastProgressAt = startedAt;
let lastHealthSnapshot = null;

if (!Number.isSafeInteger(CHAIN_ID) || CHAIN_ID <= 0 || CHAIN_ID === TESTNET_CHAIN_ID) {
  throw new Error('ZORYQ_MAINNET_CHAIN_ID must be a positive mainnet-only chain id distinct from testnet');
}
for (const [name, value] of [['ZORYQ_RPC_MAX_BODY_BYTES', MAX_BODY_BYTES], ['ZORYQ_RPC_MAX_BATCH', MAX_BATCH], ['ZORYQ_MAINNET_RPC_RATE_LIMIT_PER_MINUTE', RPC_RATE_LIMIT], ['ZORYQ_MAINNET_MIN_PEERS', MIN_PEERS], ['ZORYQ_MAINNET_MAX_STALL_MS', MAX_STALL_MS]]) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}
function send(res, status, payload) {
  cors(res);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(payload));
}
function clientKey(req) {
  if (TRUST_PROXY_HEADERS) {
    const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwarded) return forwarded;
    const real = String(req.headers['x-real-ip'] || '').trim();
    if (real) return real;
  }
  return req.socket.remoteAddress || 'unknown';
}
function rateLimit(req) {
  const now = Date.now();
  const key = clientKey(req);
  const current = rateWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    rateWindows.set(key, { startedAt: now, count: 1 });
    return { ok: true, remaining: RPC_RATE_LIMIT - 1 };
  }
  current.count += 1;
  if (rateWindows.size > 10_000 && Math.random() < 0.02) {
    for (const [candidate, window] of rateWindows) if (now - window.startedAt >= 60_000) rateWindows.delete(candidate);
  }
  return { ok: current.count <= RPC_RATE_LIMIT, remaining: Math.max(0, RPC_RATE_LIMIT - current.count) };
}
async function readBody(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
function blocked(call) {
  return !!call && typeof call.method === 'string' && (BLOCKED_METHODS.has(call.method) || BLOCKED_PREFIXES.some((prefix) => call.method.startsWith(prefix)));
}
function blockedReply(call) {
  return { jsonrpc: '2.0', id: call?.id ?? null, error: { code: -32601, message: 'Administrative, tracing, engine and node-managed signing RPC methods are disabled on the public ZORYQ mainnet endpoint' } };
}
async function rpc(payload) {
  const response = await fetch(RETH_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000)
  });
  return { status: response.status, text: await response.text() };
}
async function rpcResult(method, params = []) {
  const response = await rpc({ jsonrpc: '2.0', id: 1, method, params });
  const value = JSON.parse(response.text);
  if (value.error) throw new Error(value.error.message || 'rpc_error');
  return value.result;
}
async function health() {
  const [chainHex, clientVersion, blockHex, peerHex, syncing] = await Promise.all([
    rpcResult('eth_chainId'),
    rpcResult('web3_clientVersion'),
    rpcResult('eth_blockNumber'),
    rpcResult('net_peerCount'),
    rpcResult('eth_syncing')
  ]);
  const now = Date.now();
  const observedChainId = Number(BigInt(chainHex));
  const blockNumber = Number(BigInt(blockHex));
  const peerCount = Number(BigInt(peerHex));
  if (lastBlockNumber === null || blockNumber > lastBlockNumber) {
    lastBlockNumber = blockNumber;
    lastProgressAt = now;
  }
  const stallAgeMs = now - lastProgressAt;
  const executionClientOk = /reth/i.test(String(clientVersion));
  const peersOk = peerCount >= MIN_PEERS;
  const syncingOk = syncing === false;
  const progressing = stallAgeMs <= MAX_STALL_MS;
  const healthy = observedChainId === CHAIN_ID && executionClientOk && peersOk && syncingOk && progressing;
  const snapshot = {
    ok: healthy,
    network: 'ZORYQ Mainnet',
    mode: 'mainnet-production-runtime',
    chainId: observedChainId,
    expectedChainId: CHAIN_ID,
    executionClient: 'reth',
    clientVersion,
    blockNumber,
    peerCount,
    minimumPeers: MIN_PEERS,
    syncing,
    stallAgeMs,
    maxStallMs: MAX_STALL_MS,
    blockProgressing: progressing,
    faucet: false,
    devMode: false,
    debugPublic: false,
    engineApiPublic: false
  };
  lastHealthSnapshot = snapshot;
  return snapshot;
}
async function metrics() {
  let status;
  try { status = await health(); } catch { status = lastHealthSnapshot; }
  const now = Date.now();
  const lines = [
    '# HELP zoryq_mainnet_up Mainnet public RPC readiness (1 ready, 0 not ready)',
    '# TYPE zoryq_mainnet_up gauge',
    `zoryq_mainnet_up ${status?.ok ? 1 : 0}`,
    '# HELP zoryq_mainnet_block_number Latest observed execution block',
    '# TYPE zoryq_mainnet_block_number gauge',
    `zoryq_mainnet_block_number ${Number.isSafeInteger(status?.blockNumber) ? status.blockNumber : -1}`,
    '# HELP zoryq_mainnet_peer_count Current Reth peer count',
    '# TYPE zoryq_mainnet_peer_count gauge',
    `zoryq_mainnet_peer_count ${Number.isSafeInteger(status?.peerCount) ? status.peerCount : -1}`,
    '# HELP zoryq_mainnet_block_stall_seconds Seconds since observed block progress',
    '# TYPE zoryq_mainnet_block_stall_seconds gauge',
    `zoryq_mainnet_block_stall_seconds ${Math.max(0, now - lastProgressAt) / 1000}`,
    '# HELP zoryq_mainnet_process_uptime_seconds Gateway process uptime',
    '# TYPE zoryq_mainnet_process_uptime_seconds gauge',
    `zoryq_mainnet_process_uptime_seconds ${(now - startedAt) / 1000}`
  ];
  return `${lines.join('\n')}\n`;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/health' && req.method === 'GET') {
      try {
        const status = await health();
        return send(res, status.ok ? 200 : 503, status);
      } catch (error) {
        return send(res, 503, { ok: false, network: 'ZORYQ Mainnet', mode: 'mainnet-production-runtime', error: String(error?.message || error).slice(0, 240) });
      }
    }
    if (url.pathname === '/metrics' && req.method === 'GET') {
      const body = await metrics();
      res.writeHead(200, { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(body);
    }
    if (url.pathname === '/rpc' && req.method === 'POST') {
      const limit = rateLimit(req);
      res.setHeader('x-ratelimit-limit', String(RPC_RATE_LIMIT));
      res.setHeader('x-ratelimit-remaining', String(limit.remaining));
      if (!limit.ok) return send(res, 429, { error: 'rpc_rate_limit' });
      const payload = await readBody(req);
      if (Array.isArray(payload)) {
        if (payload.length === 0 || payload.length > MAX_BATCH) return send(res, 400, { error: 'rpc_batch_limit', maxBatch: MAX_BATCH });
        if (payload.some(blocked)) return send(res, 200, payload.map((call) => blocked(call) ? blockedReply(call) : { jsonrpc: '2.0', id: call?.id ?? null, error: { code: -32600, message: 'Batch rejected because it contains blocked RPC methods' } }));
      } else if (blocked(payload)) {
        return send(res, 200, blockedReply(payload));
      }
      const response = await rpc(payload);
      cors(res);
      res.writeHead(response.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(response.text);
    }
    if (url.pathname === '/faucet' || url.pathname === '/faucet/claim') {
      return send(res, 404, { error: 'faucet_not_available_on_mainnet' });
    }
    return send(res, 404, { error: 'not_found' });
  } catch (error) {
    const status = Number(error?.status || 500);
    return send(res, status, { error: status === 413 ? 'request_too_large' : 'request_failed' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[zoryq-mainnet] public RPC gateway listening on :${PORT}; chainId=${CHAIN_ID}; faucet=disabled; public-debug=disabled; minPeers=${MIN_PEERS}; maxStallMs=${MAX_STALL_MS}`);
});
