import http from 'node:http';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const CHAIN_ID = Number(process.env.ZORYQ_CHAIN_ID || 5919065);
const DATA_DIR = process.env.ZORYQ_RETH_DATA_DIR || '/tmp/zoryq-render-node2';
const HTTP_PORT = Number(process.env.ZORYQ_RETH_HTTP_PORT || 8545);
const GENESIS = '/app/zoryq-reth-genesis.json';
const EXPECTED_GENESIS_SHA256 = (process.env.ZORYQ_GENESIS_SHA256 || '').trim().toLowerCase();
const NODE1_RPC = (process.env.ZORYQ_NODE1_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc').trim();
const DEFAULT_NODE1_PEER = 'enode://7e3f88fe3d4df573c58b1fdb6983e5e080083bb04de9c1b9771328814cc24adafce0fd3276253986d96c79bfb75eaf9ae2f6a6787c65e6a09ce2715988f48e24@nozomi.proxy.rlwy.net:48857';
const ENV_PEER = (process.env.ZORYQ_TRUSTED_PEER || process.env.ZORYQ_NODE2_TRUSTED_PEERS || process.env.ZORYQ_NODE2_BOOTNODES || '').trim();
const TRUSTED_PEER = ENV_PEER || DEFAULT_NODE1_PEER;
const PEER_SOURCE = ENV_PEER ? 'environment' : 'default-node1-testnet';
const PEER_ENDPOINT = TRUSTED_PEER.includes('@') ? TRUSTED_PEER.split('@').pop() : null;

fs.mkdirSync(DATA_DIR, { recursive: true });

function sha256File(path) {
  return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}
const genesisSha256 = sha256File(GENESIS);
if (EXPECTED_GENESIS_SHA256 && genesisSha256 !== EXPECTED_GENESIS_SHA256) {
  console.error(`[zoryq-node2] FATAL genesis sha256 mismatch expected=${EXPECTED_GENESIS_SHA256} actual=${genesisSha256}`);
  process.exit(72);
}
console.log(`[zoryq-node2] canonical genesis verified sha256=${genesisSha256}`);

const args = [
  'node', '--chain', GENESIS, '--datadir', DATA_DIR,
  '--http', '--http.addr', '127.0.0.1', '--http.port', String(HTTP_PORT),
  '--http.api', 'eth,net,web3',
  '--disable-auth-server',
  '--engine.disable-state-cache', '--engine.disable-prewarming',
  '--engine.memory-block-buffer-target', '1', '--engine.persistence-threshold', '1',
  '--tx-channel-memory-limit', '8388608', '--rpc.evm-memory-limit', '16777216'
];
if (TRUSTED_PEER) {
  args.push('--trusted-peers', TRUSTED_PEER);
  args.push('--bootnodes', TRUSTED_PEER);
}

let child = null;
let lastExit = null;
let previousBlock = null;
let lastProgressAt = null;
let progressEvents = 0;
const startedAt = Date.now();
function startReth() {
  console.log(`[zoryq-node2] p2p configured=${Boolean(TRUSTED_PEER)} source=${PEER_SOURCE} endpoint=${PEER_ENDPOINT || 'unknown'}`);
  console.log('[zoryq-node2] Engine API auth server disabled: observer has no consensus client');
  child = spawn('/usr/local/bin/reth', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => process.stdout.write(`[reth] ${d}`));
  child.stderr.on('data', d => process.stderr.write(`[reth] ${d}`));
  child.on('exit', (code, signal) => { lastExit = { code, signal, at: Date.now() }; child = null; });
}
startReth();

async function rpc(method, params = []) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: HTTP_PORT, path: '/', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { const j = JSON.parse(data); if (j.error) reject(new Error(j.error.message || 'rpc_error')); else resolve(j.result); } catch (e) { reject(e); } });
    });
    req.on('error', reject);
    req.setTimeout(1800, () => req.destroy(new Error('rpc_timeout')));
    req.write(body); req.end();
  });
}

async function node1Rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(NODE1_RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`node1_http_${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || 'node1_rpc_error');
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url !== '/' && req.url !== '/health') {
    res.writeHead(404, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  }

  let chainId=null, peerCount=null, blockNumber=null, genesisHash=null, headHash=null, networkId=null, clientVersion=null, syncing=null;
  let node1Reachable=false, node1ChainId=null, node1BlockNumber=null, node1GenesisHash=null, node1HeadHash=null, node1Error=null;
  let commonBlockNumber=null, localCommonHash=null, node1CommonHash=null;

  try {
    const [cid, peers, block, genesis, head, netv, clientv, syncv] = await Promise.all([
      rpc('eth_chainId'), rpc('net_peerCount'), rpc('eth_blockNumber'),
      rpc('eth_getBlockByNumber',['0x0',false]), rpc('eth_getBlockByNumber',['latest',false]),
      rpc('net_version'), rpc('web3_clientVersion'), rpc('eth_syncing')
    ]);
    chainId = cid ? Number(BigInt(cid)) : null;
    peerCount = peers ? Number(BigInt(peers)) : 0;
    blockNumber = block ? Number(BigInt(block)) : null;
    genesisHash = genesis?.hash || null;
    headHash = head?.hash || null;
    networkId = netv || null;
    clientVersion = clientv || null;
    syncing = syncv;
  } catch {}

  if (Number.isInteger(blockNumber)) {
    if (Number.isInteger(previousBlock) && blockNumber > previousBlock) {
      progressEvents += 1;
      lastProgressAt = Date.now();
    }
    previousBlock = blockNumber;
  }

  try {
    const [cid, block, genesis, head] = await Promise.all([
      node1Rpc('eth_chainId'),
      node1Rpc('eth_blockNumber'),
      node1Rpc('eth_getBlockByNumber', ['0x0', false]),
      node1Rpc('eth_getBlockByNumber', ['latest', false])
    ]);
    node1Reachable = true;
    node1ChainId = cid ? Number(BigInt(cid)) : null;
    node1BlockNumber = block ? Number(BigInt(block)) : null;
    node1GenesisHash = genesis?.hash || null;
    node1HeadHash = head?.hash || null;

    if (Number.isInteger(blockNumber) && blockNumber > 0 && Number.isInteger(node1BlockNumber) && node1BlockNumber > 0) {
      commonBlockNumber = Math.min(blockNumber, node1BlockNumber);
      const tag = `0x${commonBlockNumber.toString(16)}`;
      const [localCommon, remoteCommon] = await Promise.all([
        rpc('eth_getBlockByNumber', [tag, false]),
        node1Rpc('eth_getBlockByNumber', [tag, false])
      ]);
      localCommonHash = localCommon?.hash || null;
      node1CommonHash = remoteCommon?.hash || null;
    }
  } catch (error) {
    node1Error = error?.message || String(error);
  }

  const rpcReady = chainId === CHAIN_ID;
  const genesisMatch = Boolean(genesisHash && node1GenesisHash && genesisHash === node1GenesisHash);
  const commonBlockMatch = Boolean(localCommonHash && node1CommonHash && localCommonHash === node1CommonHash);
  const blockLag = Number.isInteger(blockNumber) && Number.isInteger(node1BlockNumber) ? Math.max(0, node1BlockNumber - blockNumber) : null;
  const chainProgressing = progressEvents > 0 && lastProgressAt !== null && (Date.now() - lastProgressAt) < 180000;
  const chainCompatibilityProven = node1Reachable && node1ChainId === CHAIN_ID && genesisMatch && (commonBlockNumber === null || commonBlockMatch);
  const synchronizationProven = chainCompatibilityProven && peerCount > 0 && blockNumber > 0 && commonBlockMatch && (chainProgressing || blockLag === 0);
  const caughtUp = synchronizationProven && blockLag !== null && blockLag <= 2;

  const body = {
    ok: Boolean(child) && rpcReady,
    role: 'zoryq-render-node2-observer-probe',
    chainId, expectedChainId: CHAIN_ID, networkId, clientVersion,
    peerCount, blockNumber, genesisHash, headHash, syncing,
    genesisSha256, expectedGenesisSha256: EXPECTED_GENESIS_SHA256 || null,
    genesisVerified: !EXPECTED_GENESIS_SHA256 || genesisSha256 === EXPECTED_GENESIS_SHA256,
    p2pConfigured: Boolean(TRUSTED_PEER),
    p2pPeerSource: PEER_SOURCE,
    p2pPeerEndpoint: PEER_ENDPOINT,
    engineApiRequired: false,
    engineAuthServerDisabled: true,
    node1: {
      rpc: NODE1_RPC,
      reachable: node1Reachable,
      chainId: node1ChainId,
      blockNumber: node1BlockNumber,
      genesisHash: node1GenesisHash,
      headHash: node1HeadHash,
      error: node1Error
    },
    proof: {
      genesisMatch,
      commonBlockNumber,
      localCommonHash,
      node1CommonHash,
      commonBlockMatch,
      blockLag,
      progressEvents,
      lastProgressAt,
      chainProgressing,
      chainCompatibilityProven,
      synchronizationProven,
      caughtUp
    },
    persistentDisk: false,
    freeTierProbeOnly: true,
    processAlive: Boolean(child),
    uptimeSec: Math.floor((Date.now()-startedAt)/1000),
    lastExit
  };
  res.writeHead(body.ok ? 200 : 503, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
});
server.listen(PORT, '0.0.0.0', () => console.log(`[zoryq-node2] health server listening on :${PORT}`));
for (const sig of ['SIGTERM','SIGINT']) process.on(sig, () => { if (child) child.kill('SIGTERM'); server.close(() => process.exit(0)); });
