import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { once } from 'node:events';
import { RegistrationEngine, nodeIdFromPublicKeyBase64, registrationSigningPayload } from '../src/registration-engine.js';
import { ProofEngine } from '../src/proof-engine.js';
import { MemoryXpLedger } from '../src/xp-ledger.js';
import { proofSigningPayload } from '../src/proof-auth.js';
import { createMobileNodeApi } from '../src/api-server.js';

async function startServer() {
  const registrationEngine = new RegistrationEngine({ secret: 'r'.repeat(64) });
  const proofEngine = new ProofEngine({
    secret: 'p'.repeat(64),
    ledger: new MemoryXpLedger(),
    verifyWitness: ({ witness }) => witness.bestBlock === 777 && witness.agreement.checkpoint === '777:0xabc777',
  });
  const server = createMobileNodeApi({ registrationEngine, proofEngine, maxRequestsPerWindow: 1000 });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return { server, base: `http://127.0.0.1:${port}`, registrationEngine, proofEngine };
}

async function post(base, path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function registerNode(base) {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const nodeId = nodeIdFromPublicKeyBase64(publicKeyBase64);
  const issued = await post(base, '/v1/registration/challenge', { nodeId });
  assert.equal(issued.status, 200);
  const body = issued.body.challenge.split('.')[0];
  const registrationPayload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  const signatureBase64 = sign('sha256', Buffer.from(registrationSigningPayload(registrationPayload)), privateKey).toString('base64');
  const registered = await post(base, '/v1/registration', {
    challenge: issued.body.challenge,
    nodeId,
    publicKeyBase64,
    signatureBase64,
  });
  assert.equal(registered.status, 201);
  return { nodeId, privateKey };
}

function witness() {
  return { ok: true, bestBlock: 777, agreement: { checkpoint: '777:0xabc777', votes: 2 } };
}

test('HTTP E2E: register -> challenge -> signed proof -> XP -> replay rejected', async (t) => {
  const { server, base } = await startServer();
  t.after(() => server.close());
  const { nodeId, privateKey } = await registerNode(base);

  const proofChallenge = await post(base, '/v1/proof/challenge', { nodeId });
  assert.equal(proofChallenge.status, 200);
  const observed = witness();
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge: proofChallenge.body.challenge, nodeId, witness: observed })),
    privateKey,
  ).toString('base64');

  const accepted = await post(base, '/v1/proof', {
    challenge: proofChallenge.body.challenge,
    nodeId,
    witness: observed,
    signatureBase64,
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.result.xpAwarded, 10);
  assert.equal(accepted.body.result.xpBalance, 10);
  assert.equal(accepted.body.result.serverVerified, true);

  const xpResponse = await fetch(`${base}/v1/xp/${nodeId}`);
  assert.equal(xpResponse.status, 200);
  assert.equal((await xpResponse.json()).xp, 10);

  const replay = await post(base, '/v1/proof', {
    challenge: proofChallenge.body.challenge,
    nodeId,
    witness: observed,
    signatureBase64,
  });
  assert.equal(replay.status, 409);
  assert.match(replay.body.error, /Replay rejected/);
});

test('HTTP proof rejects unsigned client submission before XP', async (t) => {
  const { server, base } = await startServer();
  t.after(() => server.close());
  const { nodeId } = await registerNode(base);
  const proofChallenge = await post(base, '/v1/proof/challenge', { nodeId });

  const rejected = await post(base, '/v1/proof', {
    challenge: proofChallenge.body.challenge,
    nodeId,
    witness: witness(),
  });
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.error, /signature is required/i);

  const xpResponse = await fetch(`${base}/v1/xp/${nodeId}`);
  assert.equal((await xpResponse.json()).xp, 0);
});

test('HTTP proof rejects client-forged witness even when node signature is valid', async (t) => {
  const { server, base } = await startServer();
  t.after(() => server.close());
  const { nodeId, privateKey } = await registerNode(base);
  const proofChallenge = await post(base, '/v1/proof/challenge', { nodeId });
  const forged = { ok: true, bestBlock: 778, agreement: { checkpoint: '778:0xforged', votes: 2 } };
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge: proofChallenge.body.challenge, nodeId, witness: forged })),
    privateKey,
  ).toString('base64');

  const rejected = await post(base, '/v1/proof', {
    challenge: proofChallenge.body.challenge,
    nodeId,
    witness: forged,
    signatureBase64,
  });
  // A forged client witness is invalid request data, not a server fault.
  // Keep the rejection explicit so operators can distinguish attacks from outages.
  assert.equal(rejected.status, 400);
  assert.match(rejected.body.error, /server witness verification failed/i);

  const xpResponse = await fetch(`${base}/v1/xp/${nodeId}`);
  assert.equal((await xpResponse.json()).xp, 0);
});
