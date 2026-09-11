import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const RETH_RPC_URL = String(process.env.ZORYQ_RETH_RPC_URL || 'http://127.0.0.1:8545');
const CHAIN_ID = Number(process.env.ZORYQ_MAINNET_CHAIN_ID || 0);
const TESTNET_CHAIN_ID = 5919065;
const MAX_BODY_BYTES = Number(process.env.ZORYQ_RPC_MAX_BODY_BYTES || 1_000_000);
const MAX_BATCH = Number(process.env.ZORYQ_RPC_MAX_BATCH || 50);
const BLOCKED_PREFIXES = ['anvil_', 'hardhat_', 'evm_', 'debug_', 'trace_', 'admin_', 'engine_', 'miner_', 'personal_', 'reth_', 'txpool_'];
const BLOCKED_METHODS = new Set(['eth_accounts', 'eth_sendTransaction', 'eth_sign', 'eth_signTransaction', 'eth_signTypedData', 'eth_signTypedData_v3', 'eth_signTypedData_v4']);

if (!Number.isSafeInteger(CHAIN_ID) || CHAIN_ID <= 0 || CHAIN_ID === TESTNET_CHAIN_ID) {
  throw new Error('ZORYQ_MAINNET_CHAIN_ID must be a positive mainnet-only chain id distinct from testnet');
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
  const [chainHex, clientVersion, blockHex] = await Promise.all([
    rpcResult('eth_chainId'),
    rpcResult('web3_clientVersion'),
    rpcResult('eth_blockNumber')
  ]);
  const observedChainId = Number(BigInt(chainHex));
  const executionClientOk = /reth/i.test(String(clientVersion));
  const healthy = observedChainId === CHAIN_ID && executionClientOk;
  return {
    ok: healthy,
    network: 'ZORYQ Mainnet',
    mode: 'mainnet-production-runtime',
    chainId: observedChainId,
    expectedChainId: CHAIN_ID,
    executionClient: 'reth',
    clientVersion,
    blockNumber: Number(BigInt(blockHex)),
    faucet: false,
    devMode: false,
    debugPublic: false,
    engineApiPublic: false
  };
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
    if (url.pathname === '/rpc' && req.method === 'POST') {
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
  console.log(`[zoryq-mainnet] public RPC gateway listening on :${PORT}; chainId=${CHAIN_ID}; faucet=disabled; public-debug=disabled`);
});
