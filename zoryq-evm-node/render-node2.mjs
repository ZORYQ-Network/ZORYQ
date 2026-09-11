import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PORT = Number(process.env.PORT || 10000);
const CHAIN_ID = Number(process.env.ZORYQ_CHAIN_ID || 5919065);
const DATA_DIR = process.env.ZORYQ_RETH_DATA_DIR || '/tmp/zoryq-render-node2';
const HTTP_PORT = Number(process.env.ZORYQ_RETH_HTTP_PORT || 8545);
const GENESIS = '/app/zoryq-reth-genesis.json';
const TRUSTED_PEER = (process.env.ZORYQ_TRUSTED_PEER || '').trim();

fs.mkdirSync(DATA_DIR, { recursive: true });

const args = [
  'node',
  '--chain', GENESIS,
  '--datadir', DATA_DIR,
  '--http',
  '--http.addr', '127.0.0.1',
  '--http.port', String(HTTP_PORT),
  '--http.api', 'eth,net,web3',
  '--engine.disable-state-cache',
  '--engine.disable-prewarming',
  '--engine.memory-block-buffer-target', '1',
  '--engine.persistence-threshold', '1',
  '--tx-channel-memory-limit', '8388608',
  '--rpc.evm-memory-limit', '16777216'
];
if (TRUSTED_PEER) args.push('--trusted-peers', TRUSTED_PEER);

let child = null;
let lastExit = null;
let startedAt = Date.now();

function startReth() {
  child = spawn('/usr/local/bin/reth', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[reth] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[reth] ${d}`));
  child.on('exit', (code, signal) => {
    lastExit = { code, signal, at: Date.now() };
    child = null;
  });
}
startReth();

async function rpc(method, params = []) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: HTTP_PORT, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data).result); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(1500, () => req.destroy(new Error('rpc_timeout')));
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/health') {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  }
  let chainId = null;
  let peerCount = null;
  let blockNumber = null;
  let rpcReady = false;
  try {
    const [cid, peers, block] = await Promise.all([
      rpc('eth_chainId'), rpc('net_peerCount'), rpc('eth_blockNumber')
    ]);
    chainId = cid ? Number(BigInt(cid)) : null;
    peerCount = peers ? Number(BigInt(peers)) : 0;
    blockNumber = block ? Number(BigInt(block)) : null;
    rpcReady = chainId === CHAIN_ID;
  } catch {}

  const body = {
    ok: Boolean(child) && rpcReady,
    role: 'zoryq-render-node2-observer-probe',
    chainId,
    expectedChainId: CHAIN_ID,
    peerCount,
    blockNumber,
    p2pConfigured: Boolean(TRUSTED_PEER),
    persistentDisk: false,
    freeTierProbeOnly: true,
    processAlive: Boolean(child),
    uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
    lastExit
  };
  res.writeHead(body.ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[zoryq-node2] health server listening on :${PORT}`);
});

for (const sig of ['SIGTERM','SIGINT']) process.on(sig, () => {
  if (child) child.kill('SIGTERM');
  server.close(() => process.exit(0));
});
