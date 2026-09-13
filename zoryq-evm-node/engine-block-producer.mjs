import { createHmac, createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const engineUrl = process.env.ENGINE_URL || 'http://127.0.0.1:8551';
const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
const jwtSecretPath = process.env.JWT_SECRET_PATH || '/tmp/zoryq-engine.jwt';
const blockCount = Number(process.env.BLOCK_COUNT || '8');
const outputPath = process.env.EVIDENCE_PATH || 'zoryq-engine-producer-evidence.json';
const zero32 = `0x${'00'.repeat(32)}`;
const zeroAddress = `0x${'00'.repeat(20)}`;

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

async function jsonRpc(url, method, params, authenticated = false, attempts = 1) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(authenticated ? { authorization: `Bearer ${jwt()}` } : {}),
        },
        body: JSON.stringify({ jsonrpc: '2.0', id: attempt, method, params }),
        signal: AbortSignal.timeout(5000),
      });
      invariant(response.ok, `${method}: HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
      return body.result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw lastError;
}

async function publicRpc(method, params = []) {
  return jsonRpc(rpcUrl, method, params, false, 3);
}

async function engine(method, params = [], attempts = 1) {
  return jsonRpc(engineUrl, method, params, true, attempts);
}

function hexToBigInt(value) {
  invariant(typeof value === 'string' && value.startsWith('0x'), `Expected hex value, got ${value}`);
  return BigInt(value);
}

function asHex(value) {
  return `0x${BigInt(value).toString(16)}`;
}

async function waitForCanonical(expectedNumber, expectedHash) {
  for (let i = 0; i < 40; i += 1) {
    const number = hexToBigInt(await publicRpc('eth_blockNumber'));
    if (number >= expectedNumber) {
      const block = await publicRpc('eth_getBlockByNumber', [asHex(expectedNumber), false]);
      if (block?.hash === expectedHash) return block;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Canonical head did not advance to block ${expectedNumber} (${expectedHash})`);
}

async function buildOne(parent, genesisHash, index) {
  const nextTimestamp = hexToBigInt(parent.timestamp) + 2n;
  const parentBeaconBlockRoot = `0x${createHash('sha256').update(`zoryq-parent-beacon-${index}`).digest('hex')}`;
  const prevRandao = `0x${createHash('sha256').update(`zoryq-prev-randao-${index}`).digest('hex')}`;
  const attrs = {
    timestamp: asHex(nextTimestamp),
    prevRandao,
    suggestedFeeRecipient: zeroAddress,
    withdrawals: [],
    parentBeaconBlockRoot,
  };
  const startState = {
    headBlockHash: parent.hash,
    safeBlockHash: parent.hash,
    finalizedBlockHash: genesisHash,
  };

  const prepared = await engine('engine_forkchoiceUpdatedV3', [startState, attrs], 3);
  invariant(prepared?.payloadStatus?.status === 'VALID', `forkchoice prepare status=${prepared?.payloadStatus?.status}`);
  invariant(prepared?.payloadId, 'forkchoice prepare returned no payloadId');

  let envelope;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      envelope = await engine('engine_getPayloadV3', [prepared.payloadId], 1);
      if (envelope?.executionPayload?.blockHash) break;
    } catch (error) {
      if (attempt === 19) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  invariant(envelope?.executionPayload?.blockHash, 'engine_getPayloadV3 returned no execution payload');

  const payload = envelope.executionPayload;
  const expectedNumber = hexToBigInt(payload.blockNumber);
  invariant(expectedNumber === hexToBigInt(parent.number) + 1n, `Unexpected block number ${payload.blockNumber}`);
  invariant(payload.parentHash === parent.hash, 'Produced payload parentHash does not match current canonical parent');

  const accepted = await engine('engine_newPayloadV3', [payload, [], parentBeaconBlockRoot], 3);
  invariant(accepted?.status === 'VALID', `newPayload status=${accepted?.status} latestValidHash=${accepted?.latestValidHash}`);

  const commitState = {
    headBlockHash: payload.blockHash,
    safeBlockHash: parent.hash,
    finalizedBlockHash: genesisHash,
  };
  const committed = await engine('engine_forkchoiceUpdatedV3', [commitState, null], 3);
  invariant(committed?.payloadStatus?.status === 'VALID', `forkchoice commit status=${committed?.payloadStatus?.status}`);

  const canonical = await waitForCanonical(expectedNumber, payload.blockHash);
  return {
    number: Number(expectedNumber),
    hash: canonical.hash,
    parentHash: canonical.parentHash,
    timestamp: canonical.timestamp,
    enginePayloadHash: payload.blockHash,
    payloadStatus: accepted.status,
  };
}

async function main() {
  invariant(Number.isInteger(blockCount) && blockCount >= 2 && blockCount <= 128, 'BLOCK_COUNT must be an integer between 2 and 128');
  const chainId = await publicRpc('eth_chainId');
  invariant(BigInt(chainId) === 5919065n, `Wrong chainId ${chainId}`);

  const genesis = await publicRpc('eth_getBlockByNumber', ['0x0', false]);
  invariant(genesis?.hash, 'Genesis block unavailable');
  let parent = genesis;
  const produced = [];

  for (let i = 1; i <= blockCount; i += 1) {
    const evidence = await buildOne(parent, genesis.hash, i);
    produced.push(evidence);
    parent = await publicRpc('eth_getBlockByNumber', [asHex(i), false]);
    invariant(parent?.hash === evidence.hash, `Canonical block ${i} changed unexpectedly`);
    console.log(`Produced canonical block ${i}: ${evidence.hash}`);
  }

  const finalHead = await publicRpc('eth_getBlockByNumber', ['latest', false]);
  invariant(Number(hexToBigInt(finalHead.number)) === blockCount, `Final head mismatch: ${finalHead.number}`);

  const evidence = {
    schemaVersion: 1,
    status: 'ENGINE_API_V3_NON_DEV_CANONICAL_BLOCKS',
    chainId: 5919065,
    engineApi: 'V3',
    blockCount,
    genesisHash: genesis.hash,
    finalCanonicalNumber: Number(hexToBigInt(finalHead.number)),
    finalCanonicalHash: finalHead.hash,
    produced,
    claimBoundary: 'This research evidence proves a non-dev Reth process can be driven through authenticated Engine API V3 to create deterministic canonical ZORYQ test blocks. It does not prove production consensus, decentralization, validator independence, Byzantine fault tolerance, public Internet reachability, or mainnet readiness.',
  };
  const canonicalJson = `${JSON.stringify(evidence, null, 2)}\n`;
  writeFileSync(outputPath, canonicalJson);
  const digest = createHash('sha256').update(canonicalJson).digest('hex');
  writeFileSync(`${outputPath}.sha256`, `${digest}  ${outputPath}\n`);
  console.log(JSON.stringify({ ...evidence, evidenceSha256: digest }, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exit(1);
});
