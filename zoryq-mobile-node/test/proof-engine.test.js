import test from 'node:test';
import assert from 'node:assert/strict';
import { ProofEngine } from '../src/proof-engine.js';

const SECRET = 'zoryq-mobile-node-test-secret-32-bytes-minimum';
const witness = {
  ok: true,
  bestBlock: 4242,
  agreement: { checkpoint: '4242:0xabc123', votes: 2 }
};

function trustedVerifier({ witness: proof }) {
  // Test double for a server-owned RPC re-verifier. Production must independently
  // read the checkpoint from ZORYQ RPCs instead of trusting client fields.
  return proof.bestBlock === 4242 && proof.agreement?.checkpoint === '4242:0xabc123';
}

function engine(options = {}) {
  return new ProofEngine({ secret: SECRET, now: () => 1_000, verifyWitness: trustedVerifier, ...options });
}

test('engine refuses to start without server-owned witness verifier', () => {
  assert.throws(() => new ProofEngine({ secret: SECRET }), /server-owned verifyWitness/);
});

test('challenge -> server-verified proof -> XP credited', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const result = value.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.equal(result.accepted, true);
  assert.equal(result.serverVerified, true);
  assert.equal(result.xpAwarded, 10);
  assert.equal(result.xpBalance, 10);
  assert.equal(value.getXp('node-1'), 10);
});

test('replay is rejected and cannot mint XP twice', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  value.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
    /Replay rejected/
  );
  assert.equal(value.getXp('node-1'), 10);
});

test('challenge cannot be used by another node identity', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-2', witness }),
    /Challenge node mismatch/
  );
  assert.equal(value.getXp('node-2'), 0);
});

test('expired challenge is rejected with zero XP', () => {
  let now = 1_000;
  const value = new ProofEngine({ secret: SECRET, ttlMs: 100, now: () => now, verifyWitness: trustedVerifier });
  const challenge = value.issueChallenge('node-1');
  now = 1_101;
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
    /Expired challenge/
  );
  assert.equal(value.getXp('node-1'), 0);
});

test('tampered challenge is rejected with zero XP', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const [body, sig] = challenge.split('.');
  const tampered = `${body.slice(0, -1)}A.${sig}`;
  assert.throws(
    () => value.verifyAndCredit({ challenge: tampered, nodeId: 'node-1', witness }),
    /(Invalid challenge signature|Malformed challenge)/
  );
  assert.equal(value.getXp('node-1'), 0);
});

test('unhealthy or malformed witness earns zero XP', () => {
  const value = engine();
  const challengeA = value.issueChallenge('node-1');
  assert.throws(
    () => value.verifyAndCredit({ challenge: challengeA, nodeId: 'node-1', witness: { ok: false } }),
    /not healthy/
  );

  const challengeB = value.issueChallenge('node-1');
  assert.throws(
    () => value.verifyAndCredit({ challenge: challengeB, nodeId: 'node-1', witness: { ok: true, bestBlock: -1 } }),
    /Invalid witness block/
  );
  assert.equal(value.getXp('node-1'), 0);
});

test('single RPC vote cannot mint XP', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const weakWitness = { ...witness, agreement: { ...witness.agreement, votes: 1 } };
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: weakWitness }),
    /Independent RPC agreement required/
  );
  assert.equal(value.getXp('node-1'), 0);
});

test('client-forged checkpoint is rejected by server verifier and earns zero XP', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const forged = { ok: true, bestBlock: 9999, agreement: { checkpoint: '9999:0xfake', votes: 2 } };
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: forged }),
    /Server witness verification failed/
  );
  assert.equal(value.getXp('node-1'), 0);
});

test('checkpoint block must match claimed best block', () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const mismatch = { ok: true, bestBlock: 4242, agreement: { checkpoint: '4243:0xabc123', votes: 2 } };
  assert.throws(
    () => value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: mismatch }),
    /Witness checkpoint mismatch/
  );
  assert.equal(value.getXp('node-1'), 0);
});
