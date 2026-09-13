import { createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const engineUrl = process.env.FOLLOWER_ENGINE_URL || 'http://127.0.0.1:8552';
const followerRpcUrl = process.env.FOLLOWER_RPC_URL || 'http://127.0.0.1:8546';
const referenceRpcUrl = process.env.REFERENCE_RPC_URL || 'http://127.0.0.1:8545';
const jwtSecretPath = process.env.JWT_SECRET_PATH || '/tmp/zoryq-engine.jwt';
const outputPath = process.env.EVIDENCE_PATH || 'zoryq-p2p-forkchoice-evidence.json';

function invariant(ok, message) {
  if (!ok) throw new Error(message);
}

function b64url(value) {
  return Buffer.from(value).toString('base64url');
}

function loadJwtSecret() {
  const raw = readFileSync(jwtSecretPath, 'utf8').trim().replace(/^0x/, '');
  invariant(/^[0-9a-fA-F]{64}$/.test(raw), 'JWT secret must be exactly 32 bytes encoded as 64 hex characters');
  return Buffer.from(raw, 'hex');
}

const jwtSecret = loadJwtSecret();

function jwt() {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000) }));
  const body = `${header}.${payload}`;
  const signature = createHmac('sha256', jwtSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

async function rpc(url, method, params = [], authenticated = false) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authenticated ? { authorization: `Bearer ${jwt()}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(5000),
  });
  invariant(response.ok, `${method}: HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function waitForPeer() {
  for (let i = 0; i < 90; i += 1) {
    try {
      const peers = BigInt(await rpc(followerRpcUrl, 'net_peerCount'));
      if (peers > 0n) return Number(peers);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Follower did not establish a P2P peer');
}

async function main() {
  const referenceChainId = await rpc(referenceRpcUrl, 'eth_chainId');
  const followerChainId = await rpc(followerRpcUrl, 'eth_chainId');
  invariant(BigInt(referenceChainId) === 5919065n, `Reference chainId mismatch ${referenceChainId}`);
  invariant(BigInt(followerChainId) === 5919065n, `Follower chainId mismatch ${followerChainId}`);

  const referenceGenesis = await rpc(referenceRpcUrl, 'eth_getBlockByNumber', ['0x0', false]);
  const followerGenesis = await rpc(followerRpcUrl, 'eth_getBlockByNumber', ['0x0', false]);
  invariant(referenceGenesis?.hash === followerGenesis?.hash, 'Genesis hash mismatch');

  const peerCount = await waitForPeer();
  const target = await rpc(referenceRpcUrl, 'eth_getBlockByNumber', ['latest', false]);
  invariant(target?.hash && BigInt(target.number) > 0n, 'Reference target head is not above genesis');

  const state = {
    headBlockHash: target.hash,
    safeBlockHash: referenceGenesis.hash,
    finalizedBlockHash: referenceGenesis.hash,
  };

  const statuses = [];
  let matched = null;
  for (let attempt = 1; attempt <= 120; attempt += 1) {
    const fcu = await rpc(engineUrl, 'engine_forkchoiceUpdatedV3', [state, null], true);
    statuses.push(fcu?.payloadStatus?.status || 'UNKNOWN');

    try {
      const followerAtTarget = await rpc(followerRpcUrl, 'eth_getBlockByNumber', [target.number, false]);
      const followerHead = await rpc(followerRpcUrl, 'eth_getBlockByNumber', ['latest', false]);
      if (followerAtTarget?.hash === target.hash && followerHead?.hash === target.hash) {
        matched = followerHead;
        invariant(fcu?.payloadStatus?.status === 'VALID', `Target matched but forkchoice status is ${fcu?.payloadStatus?.status}`);
        break;
      }
    } catch {}

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  invariant(matched, `Follower never canonicalized target ${target.number}/${target.hash}; statuses=${[...new Set(statuses)].join(',')}`);
  const finalPeerCount = Number(BigInt(await rpc(followerRpcUrl, 'net_peerCount')));
  invariant(finalPeerCount > 0, 'Follower lost all P2P peers before evidence capture');

  const evidence = {
    schemaVersion: 1,
    status: 'FORKCHOICE_ONLY_P2P_CANONICAL_SYNC',
    chainId: 5919065,
    genesisHash: referenceGenesis.hash,
    targetNumber: Number(BigInt(target.number)),
    targetHash: target.hash,
    followerCanonicalNumber: Number(BigInt(matched.number)),
    followerCanonicalHash: matched.hash,
    peerCount: finalPeerCount,
    observedForkchoiceStatuses: [...new Set(statuses)],
    payloadInjectedIntoFollowerViaRpc: false,
    claimBoundary: 'This CI research evidence proves a non-dev Reth follower can receive canonical forkchoice information while obtaining the referenced ZORYQ execution block through direct P2P from another non-dev Reth peer in an isolated Docker network. It does not prove Internet reachability, an independent external operator, production consensus, decentralization, Byzantine fault tolerance, or mainnet readiness.',
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
