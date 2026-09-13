import { createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const sourceRpcUrl = process.env.SOURCE_RPC_URL || 'http://127.0.0.1:8081/rpc';
const targetRpcUrl = process.env.TARGET_RPC_URL || 'http://127.0.0.1:8545';
const targetEngineUrl = process.env.TARGET_ENGINE_URL || 'http://127.0.0.1:8551';
const jwtSecretPath = process.env.JWT_SECRET_PATH || '/tmp/zoryq-engine.jwt';
const maxBlocks = Number(process.env.MAX_BLOCKS || '8');
const outputPath = process.env.EVIDENCE_PATH || 'zoryq-rpc-engine-replica-evidence.json';
const zero32 = `0x${'00'.repeat(32)}`;

function invariant(ok, message) {
  if (!ok) throw new Error(message);
}
function b64url(value) { return Buffer.from(value).toString('base64url'); }
function loadSecret() {
  const raw = readFileSync(jwtSecretPath, 'utf8').trim().replace(/^0x/, '');
  invariant(/^[0-9a-fA-F]{64}$/.test(raw), 'JWT secret must be exactly 32 bytes');
  return Buffer.from(raw, 'hex');
}
const secret = loadSecret();
function jwt() {
  const h = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000) }));
  const body = `${h}.${p}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}
async function call(url, method, params = [], authenticated = false, attempts = 3) {
  let last;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(authenticated ? { authorization: `Bearer ${jwt()}` } : {}) },
        body: JSON.stringify({ jsonrpc: '2.0', id: i, method, params }),
        signal: AbortSignal.timeout(6000),
      });
      invariant(response.ok, `${method}: HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
      return body.result;
    } catch (error) {
      last = error;
      if (i < attempts) await new Promise((r) => setTimeout(r, 250));
    }
  }
  throw last;
}
const source = (method, params = []) => call(sourceRpcUrl, method, params, false);
const target = (method, params = []) => call(targetRpcUrl, method, params, false);
const engine = (method, params = []) => call(targetEngineUrl, method, params, true);

async function waitSourceHeight(minHeight) {
  for (let i = 0; i < 120; i += 1) {
    const height = Number(BigInt(await source('eth_blockNumber')));
    if (height >= minHeight) return height;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Source did not reach block ${minHeight}`);
}

async function rawTransactions(block) {
  const raw = [];
  const versionedHashes = [];
  for (const txHash of block.transactions || []) {
    const encoded = await source('eth_getRawTransactionByHash', [txHash]);
    invariant(typeof encoded === 'string' && encoded.startsWith('0x'), `Raw transaction unavailable: ${txHash}`);
    raw.push(encoded);
    const tx = await source('eth_getTransactionByHash', [txHash]);
    for (const hash of tx?.blobVersionedHashes || []) versionedHashes.push(hash);
  }
  return { raw, versionedHashes };
}

async function importBlock(block, genesisHash) {
  const { raw, versionedHashes } = await rawTransactions(block);
  const payload = {
    parentHash: block.parentHash,
    feeRecipient: block.miner,
    stateRoot: block.stateRoot,
    receiptsRoot: block.receiptsRoot,
    logsBloom: block.logsBloom,
    prevRandao: block.mixHash,
    blockNumber: block.number,
    gasLimit: block.gasLimit,
    gasUsed: block.gasUsed,
    timestamp: block.timestamp,
    extraData: block.extraData,
    baseFeePerGas: block.baseFeePerGas,
    blockHash: block.hash,
    transactions: raw,
    withdrawals: block.withdrawals || [],
    blobGasUsed: block.blobGasUsed || '0x0',
    excessBlobGas: block.excessBlobGas || '0x0',
  };
  const parentBeaconBlockRoot = block.parentBeaconBlockRoot || zero32;
  const accepted = await engine('engine_newPayloadV3', [payload, versionedHashes, parentBeaconBlockRoot]);
  invariant(accepted?.status === 'VALID', `Block ${block.number} rejected: ${JSON.stringify(accepted)}`);
  const committed = await engine('engine_forkchoiceUpdatedV3', [{
    headBlockHash: block.hash,
    safeBlockHash: block.parentHash,
    finalizedBlockHash: genesisHash,
  }, null]);
  invariant(committed?.payloadStatus?.status === 'VALID', `Forkchoice ${block.number} rejected: ${JSON.stringify(committed)}`);

  for (let i = 0; i < 40; i += 1) {
    const replicated = await target('eth_getBlockByNumber', [block.number, false]);
    if (replicated?.hash === block.hash) return;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Target did not canonicalize source block ${block.number}/${block.hash}`);
}

async function main() {
  invariant(Number.isInteger(maxBlocks) && maxBlocks >= 2 && maxBlocks <= 128, 'MAX_BLOCKS must be 2..128');
  const [sourceChainId, targetChainId] = await Promise.all([source('eth_chainId'), target('eth_chainId')]);
  invariant(BigInt(sourceChainId) === 5919065n && BigInt(targetChainId) === 5919065n, 'Chain ID mismatch');
  const [sourceGenesis, targetGenesis] = await Promise.all([
    source('eth_getBlockByNumber', ['0x0', false]),
    target('eth_getBlockByNumber', ['0x0', false]),
  ]);
  invariant(sourceGenesis?.hash === targetGenesis?.hash, `Genesis mismatch source=${sourceGenesis?.hash} target=${targetGenesis?.hash}`);

  const sourceHeight = await waitSourceHeight(maxBlocks);
  const imported = [];
  for (let n = 1; n <= maxBlocks; n += 1) {
    const tag = `0x${n.toString(16)}`;
    const block = await source('eth_getBlockByNumber', [tag, false]);
    invariant(block?.hash, `Missing source block ${n}`);
    await importBlock(block, sourceGenesis.hash);
    imported.push({ number: n, hash: block.hash, transactionCount: (block.transactions || []).length });
    console.log(`Replicated source block ${n}: ${block.hash}`);
  }

  const sourceFinal = await source('eth_getBlockByNumber', [`0x${maxBlocks.toString(16)}`, false]);
  const targetFinal = await target('eth_getBlockByNumber', [`0x${maxBlocks.toString(16)}`, false]);
  invariant(sourceFinal.hash === targetFinal.hash, 'Final canonical hash mismatch');

  const evidence = {
    schemaVersion: 1,
    status: 'RPC_TO_ENGINE_CANONICAL_REPLICA',
    chainId: 5919065,
    sourceObservedHeight: sourceHeight,
    importedBlocks: maxBlocks,
    genesisHash: sourceGenesis.hash,
    finalCanonicalNumber: maxBlocks,
    finalCanonicalHash: targetFinal.hash,
    hashesMatchSource: true,
    imported,
    claimBoundary: 'This research evidence proves a non-dev Reth instance can reconstruct and canonicalize a bounded sequence of ZORYQ testnet blocks obtained from a dev-mode JSON-RPC source through authenticated Engine API V3 while preserving block hashes. It does not prove a production consensus bridge, unbounded live replication, Internet reachability, decentralization, fault tolerance, or mainnet readiness.',
  };
  const json = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(outputPath, json);
  const digest = createHash('sha256').update(json).digest('hex');
  writeFileSync(`${outputPath}.sha256`, `${digest}  ${outputPath}\n`);
  console.log(JSON.stringify({ ...evidence, evidenceSha256: digest }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
