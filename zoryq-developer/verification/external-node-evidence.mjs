#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const NODE_RPC = process.env.ZORYQ_NODE_RPC;
const REFERENCE_RPC = process.env.ZORYQ_REFERENCE_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const OPERATOR_ID = String(process.env.ZORYQ_OPERATOR_ID || 'independent-operator').trim();
const OUT = process.env.ZORYQ_EXTERNAL_NODE_EVIDENCE_OUT || 'zoryq-independent-node-evidence.json';
const CHAIN_ID = 5919065;

if (!NODE_RPC) throw new Error('ZORYQ_NODE_RPC is required and must point to the independent operator node RPC');
if (!/^https?:\/\//i.test(NODE_RPC)) throw new Error('ZORYQ_NODE_RPC must be an http(s) URL');
if (!/^https?:\/\//i.test(REFERENCE_RPC)) throw new Error('ZORYQ_REFERENCE_RPC must be an http(s) URL');

const sha256 = value => createHash('sha256').update(value).digest('hex');

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}: ${text.slice(0, 300)}`);
  const body = JSON.parse(text);
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

const toNumber = hex => Number(BigInt(hex));

async function nodeSnapshot(url) {
  const [chainIdHex, clientVersion, peerCountHex, blockNumberHex, genesis] = await Promise.all([
    rpc(url, 'eth_chainId'),
    rpc(url, 'web3_clientVersion'),
    rpc(url, 'net_peerCount'),
    rpc(url, 'eth_blockNumber'),
    rpc(url, 'eth_getBlockByNumber', ['0x0', false]),
  ]);
  const blockNumber = toNumber(blockNumberHex);
  const head = await rpc(url, 'eth_getBlockByNumber', [`0x${blockNumber.toString(16)}`, false]);
  return {
    chainId: toNumber(chainIdHex),
    clientVersion: String(clientVersion),
    peerCount: toNumber(peerCountHex),
    blockNumber,
    genesisHash: genesis?.hash || null,
    headHash: head?.hash || null,
  };
}

async function main() {
  const [node, referenceInitial] = await Promise.all([nodeSnapshot(NODE_RPC), nodeSnapshot(REFERENCE_RPC)]);
  assert.equal(node.chainId, CHAIN_ID, `independent node chain ID mismatch: ${node.chainId}`);
  assert.equal(referenceInitial.chainId, CHAIN_ID, `reference chain ID mismatch: ${referenceInitial.chainId}`);
  assert.match(node.clientVersion, /reth/i, `independent node is not reporting Reth: ${node.clientVersion}`);
  assert(node.genesisHash, 'independent node genesis hash unavailable');
  assert(referenceInitial.genesisHash, 'reference genesis hash unavailable');
  assert.equal(node.genesisHash.toLowerCase(), referenceInitial.genesisHash.toLowerCase(), 'genesis hash mismatch');
  assert(node.peerCount > 0, 'independent node has zero peers; P2P connectivity is not verified');

  // Compare one canonical height that both endpoints already have.
  const sharedHeight = Math.min(node.blockNumber, referenceInitial.blockNumber);
  assert(sharedHeight >= 0, 'no shared canonical height available');
  const blockTag = `0x${sharedHeight.toString(16)}`;
  const [nodeBlock, referenceBlock] = await Promise.all([
    rpc(NODE_RPC, 'eth_getBlockByNumber', [blockTag, false]),
    rpc(REFERENCE_RPC, 'eth_getBlockByNumber', [blockTag, false]),
  ]);
  assert(nodeBlock?.hash, `independent node block ${sharedHeight} unavailable`);
  assert(referenceBlock?.hash, `reference block ${sharedHeight} unavailable`);
  assert.equal(nodeBlock.hash.toLowerCase(), referenceBlock.hash.toLowerCase(), `canonical block hash mismatch at ${sharedHeight}`);

  const evidence = {
    schemaVersion: 1,
    status: 'INDEPENDENT_NODE_CONNECTIVITY_EVIDENCE',
    generatedAt: new Date().toISOString(),
    operatorId: OPERATOR_ID,
    chainId: CHAIN_ID,
    independentNode: node,
    reference: {
      rpcHost: new URL(REFERENCE_RPC).host,
      blockNumber: referenceInitial.blockNumber,
      genesisHash: referenceInitial.genesisHash,
    },
    canonicalComparison: {
      blockNumber: sharedHeight,
      blockHash: nodeBlock.hash,
      equalToReference: true,
    },
    peerConnectivityVerified: node.peerCount > 0,
    claimBoundary: 'Passing this collector proves that the supplied independently operated RPC reports the ZORYQ chain identity, matching genesis and a matching canonical block sample with at least one P2P peer. It does not by itself prove operator independence, decentralization, fault tolerance, consensus safety, mainnet readiness, or long-term availability.',
  };
  evidence.evidenceSha256 = sha256(JSON.stringify(evidence));
  await writeFile(OUT, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    output: OUT,
    status: evidence.status,
    peerCount: node.peerCount,
    comparedBlock: sharedHeight,
    evidenceSha256: evidence.evidenceSha256,
  }, null, 2));
}

main().catch(async error => {
  await writeFile(OUT, `${JSON.stringify({ schemaVersion: 1, status: 'FAIL', error: error?.stack || String(error) }, null, 2)}\n`).catch(() => {});
  console.error(error?.stack || error);
  process.exit(1);
});
