import test from 'node:test';
import assert from 'node:assert/strict';
import { ProofEngine } from '../src/proof-engine.js';

const SECRET = 'zoryq-mobile-node-test-secret-32-bytes-minimum';
const witness = {
  ok: true,
  bestBlock: 4242,
  agreement: { checkpoint: '4242:0xabc123', votes: 2 }
};

test('challenge -> valid proof -> XP credited', () => {
  const engine = new ProofEngine({ secret: SECRET, now: () => 1_000 });
  const challenge = engine.issueChallenge('node-1');
  const result = engine.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.equal(result.accepted, true);
  assert.equal(result.xpAwarded, 10);
  assert.equal(result.xpBalance, 10);
  assert.equal(engine.getXp('node-1'), 10);
});

test('replay is rejected and cannot mint XP twice', () => {
  const engine = new ProofEngine({ secret: SECRET, now: () => 1_000 });
  const challenge = engine.issueChallenge('node-1');
  engine.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.throws(
    () => engine.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
    /Replay rejected/
  );
  assert.equal(engine.getXp('node-1'), 10);
});

test('challenge cannot be used by another node identity', () => {
  const engine = new ProofEngine({ secret: SECRET, now: () => 1_000 });
  const challenge = engine.issueChallenge('node-1');
  assert.throws(
    () => engine.verifyAndCredit({ challenge, nodeId: 'node-2', witness }),
    /Challenge node mismatch/
  );
  assert.equal(engine.getXp('node-2'), 0);
});

test('expired challenge is rejected', () => {
  let now = 1_000;
  const engine = new ProofEngine({ secret: SECRET, ttlMs: 100, now: () => now });
  const challenge = engine.issueChallenge('node-1');
  now = 1_101;
  assert.throws(
    () => engine.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
    /Expired challenge/
  );
});

test('tampered challenge is rejected', () => {
  const engine = new ProofEngine({ secret: SECRET, now: () => 1_000 });
  const challenge = engine.issueChallenge('node-1');
  const [body, sig] = challenge.split('.');
  const tampered = `${body.slice(0, -1)}A.${sig}`;
  assert.throws(
    () => engine.verifyAndCredit({ challenge: tampered, nodeId: 'node-1', witness }),
    /(Invalid challenge signature|Malformed challenge)/
  );
});

test('unhealthy or malformed witness earns no XP', () => {
  const engine = new ProofEngine({ secret: SECRET, now: () => 1_000 });
  const challengeA = engine.issueChallenge('node-1');
  assert.throws(
    () => engine.verifyAndCredit({ challenge: challengeA, nodeId: 'node-1', witness: { ok: false } }),
    /not healthy/
  );

  const challengeB = engine.issueChallenge('node-1');
  assert.throws(
    () => engine.verifyAndCredit({ challenge: challengeB, nodeId: 'node-1', witness: { ok: true, bestBlock: -1 } }),
    /Invalid witness block/
  );
  assert.equal(engine.getXp('node-1'), 0);
});
