import crypto from 'node:crypto';

const BASE = process.env.MOBILE_BACKEND_URL || 'http://127.0.0.1:18084';
const RPC = process.env.ZORYQ_MOBILE_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
const nodeId = 'zq-' + crypto.createHash('sha256').update(Buffer.from(pub, 'base64')).digest('hex').slice(0, 24);
const sign = payload => crypto.sign('sha256', Buffer.from(payload), privateKey).toString('base64');

async function post(path, body, expected = 200) {
  const r = await fetch(BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  const json = await r.json();
  if (r.status !== expected) throw new Error(`${path}: expected ${expected}, got ${r.status}: ${JSON.stringify(json)}`);
  return json;
}
async function rpc(method, params) {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`RPC HTTP ${r.status}`);
  const j = await r.json(); if (j.error) throw new Error(`RPC ${j.error.message}`); return j.result;
}

const regChallenge = await post('/mobile-node/registration-challenge', { nodeId, publicKey: pub });
if (!regChallenge.registrationPayload) throw new Error('registrationPayload missing');
await post('/mobile-node/register', { challengeId: regChallenge.id, nodeId, publicKey: pub, signature: sign(regChallenge.registrationPayload) });

const task = await post('/mobile-node/challenge', { nodeId });
if (Number(task.chainId) !== 5919065) throw new Error(`wrong task chain ${task.chainId}`);
const tag = '0x' + Number(task.targetBlock).toString(16);
const block = await rpc('eth_getBlockByNumber', [tag, false]);
if (!block?.hash || !block?.parentHash) throw new Error('target block unavailable');
const observedAt = new Date().toISOString();
const proof = {
  challengeId: task.id,
  nonce: task.nonce,
  nodeId,
  chainId: 5919065,
  blockNumber: Number(task.targetBlock),
  blockHash: block.hash,
  parentHash: block.parentHash,
  observedAt
};
const payload = ['zoryq-mobile-proof-v1', proof.challengeId, proof.nonce, proof.nodeId, String(proof.chainId), String(proof.blockNumber), proof.blockHash, proof.parentHash, proof.observedAt].join('|');
proof.signature = sign(payload);
const receipt = await post('/mobile-node/proof', proof);
if (receipt.xpAwarded !== 3 || receipt.totalXp !== 3 || !receipt.proofHash || !receipt.eventId) throw new Error(`invalid XP receipt ${JSON.stringify(receipt)}`);
const replay = await post('/mobile-node/proof', proof, 409);
if (replay.error !== 'CHALLENGE_ALREADY_USED') throw new Error(`replay was not rejected: ${JSON.stringify(replay)}`);
const statusRes = await fetch(`${BASE}/mobile-node/status?nodeId=${encodeURIComponent(nodeId)}`, { signal: AbortSignal.timeout(10_000) });
const status = await statusRes.json();
if (!statusRes.ok || status.totalXp !== 3 || status.acceptedProofs !== 1) throw new Error(`invalid status ${JSON.stringify(status)}`);
console.log(JSON.stringify({ ok: true, chainId: task.chainId, blockNumber: task.targetBlock, xpAwarded: receipt.xpAwarded, totalXp: receipt.totalXp, replayRejected: true, acceptedProofs: status.acceptedProofs }));
