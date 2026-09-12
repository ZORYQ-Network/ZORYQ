import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { RegistrationEngine, nodeIdFromPublicKeyBase64, registrationSigningPayload } from '../src/registration-engine.js';
import { proofSigningPayload, verifyRegisteredNodeProof } from '../src/proof-auth.js';

function fixture() {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
  const nodeId = nodeIdFromPublicKeyBase64(publicKeyBase64);
  const registrationEngine = new RegistrationEngine({ secret: 'r'.repeat(64) });
  const registrationChallenge = registrationEngine.issueChallenge({ nodeId });
  const registrationPayload = registrationEngine.inspectChallenge(registrationChallenge);
  const registrationSignature = sign('sha256', Buffer.from(registrationSigningPayload(registrationPayload)), privateKey).toString('base64');
  registrationEngine.register({
    challenge: registrationChallenge,
    nodeId,
    publicKeyBase64,
    signatureBase64: registrationSignature,
  });
  return { privateKey, publicKeyBase64, nodeId, registrationEngine };
}

function witness(block = 123) {
  return {
    ok: true,
    bestBlock: block,
    agreement: {
      checkpoint: `${block}:0xabc123`,
      votes: 2,
    },
  };
}

test('registered node key authorizes the exact challenge and witness', () => {
  const { privateKey, nodeId, registrationEngine } = fixture();
  const challenge = 'proof.challenge.token';
  const observed = witness();
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge, nodeId, witness: observed })),
    privateKey,
  ).toString('base64');

  assert.equal(verifyRegisteredNodeProof({ registrationEngine, challenge, nodeId, witness: observed, signatureBase64 }), true);
});

test('signature cannot be replayed onto a different challenge', () => {
  const { privateKey, nodeId, registrationEngine } = fixture();
  const observed = witness();
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge: 'challenge-A', nodeId, witness: observed })),
    privateKey,
  ).toString('base64');

  assert.throws(
    () => verifyRegisteredNodeProof({ registrationEngine, challenge: 'challenge-B', nodeId, witness: observed, signatureBase64 }),
    /Invalid node proof signature/,
  );
});

test('signature cannot be transplanted to a forged checkpoint', () => {
  const { privateKey, nodeId, registrationEngine } = fixture();
  const original = witness(123);
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge: 'challenge-A', nodeId, witness: original })),
    privateKey,
  ).toString('base64');
  const forged = witness(124);

  assert.throws(
    () => verifyRegisteredNodeProof({ registrationEngine, challenge: 'challenge-A', nodeId, witness: forged, signatureBase64 }),
    /Invalid node proof signature/,
  );
});

test('unregistered node cannot submit XP proof even with a valid key signature', () => {
  const { privateKey, nodeId } = fixture();
  const emptyRegistrationEngine = new RegistrationEngine({ secret: 's'.repeat(64) });
  const observed = witness();
  const challenge = 'challenge-A';
  const signatureBase64 = sign(
    'sha256',
    Buffer.from(proofSigningPayload({ challenge, nodeId, witness: observed })),
    privateKey,
  ).toString('base64');

  assert.throws(
    () => verifyRegisteredNodeProof({ registrationEngine: emptyRegistrationEngine, challenge, nodeId, witness: observed, signatureBase64 }),
    /Node is not registered/,
  );
});
