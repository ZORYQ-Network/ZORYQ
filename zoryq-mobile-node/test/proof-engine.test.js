import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ProofEngine } from '../src/proof-engine.js';
import { FileXpLedger, MemoryXpLedger } from '../src/xp-ledger.js';

const SECRET = 'zoryq-mobile-node-test-secret-32-bytes-minimum';
const witness = { ok: true, bestBlock: 4242, agreement: { checkpoint: '4242:0xabc123', votes: 2 } };

function trustedVerifier({ witness: proof }) {
  return proof.bestBlock === 4242 && proof.agreement?.checkpoint === '4242:0xabc123';
}

function engine(options = {}) {
  return new ProofEngine({
    secret: SECRET,
    now: () => 1_000,
    verifyWitness: trustedVerifier,
    ledger: new MemoryXpLedger(),
    ...options,
  });
}

test('engine refuses to start without server-owned witness verifier', () => {
  assert.throws(() => new ProofEngine({ secret: SECRET, ledger: new MemoryXpLedger() }), /server-owned verifyWitness/);
});

test('engine refuses to start without idempotent ledger', () => {
  assert.throws(() => new ProofEngine({ secret: SECRET, verifyWitness: trustedVerifier }), /idempotent XP ledger/);
});

test('challenge -> server-verified proof -> XP credited', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const result = await value.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.equal(result.accepted, true);
  assert.equal(result.serverVerified, true);
  assert.equal(result.xpAwarded, 10);
  assert.equal(result.xpBalance, 10);
});

test('async server-owned verifier is awaited before XP credit', async () => {
  let finished = false;
  const value = engine({
    verifyWitness: async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      finished = true;
      return true;
    },
  });
  const challenge = value.issueChallenge('node-1');
  const result = await value.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.equal(finished, true);
  assert.equal(result.xpBalance, 10);
});

test('replay is rejected and cannot mint XP twice', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  await value.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }), /Replay rejected/);
  assert.equal(value.getXp('node-1'), 10);
});

test('concurrent replay cannot mint XP twice across async verification window', async () => {
  const value = engine({
    verifyWitness: async () => {
      await new Promise(resolve => setTimeout(resolve, 15));
      return true;
    },
  });
  const challenge = value.issueChallenge('node-1');
  const results = await Promise.allSettled([
    value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
    value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);
  assert.equal(value.getXp('node-1'), 10);
});

test('challenge cannot be used by another node identity', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-2', witness }), /Challenge node mismatch/);
  assert.equal(value.getXp('node-2'), 0);
});

test('expired challenge is rejected with zero XP', async () => {
  let now = 1_000;
  const value = new ProofEngine({ secret: SECRET, ttlMs: 100, now: () => now, verifyWitness: trustedVerifier, ledger: new MemoryXpLedger() });
  const challenge = value.issueChallenge('node-1');
  now = 1_101;
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-1', witness }), /Expired challenge/);
  assert.equal(value.getXp('node-1'), 0);
});

test('tampered challenge is rejected with zero XP', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const [body, sig] = challenge.split('.');
  const tampered = `${body.slice(0, -1)}A.${sig}`;
  await assert.rejects(value.verifyAndCredit({ challenge: tampered, nodeId: 'node-1', witness }), /(Invalid challenge signature|Malformed challenge)/);
  assert.equal(value.getXp('node-1'), 0);
});

test('single RPC vote cannot mint XP', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const weak = { ...witness, agreement: { ...witness.agreement, votes: 1 } };
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: weak }), /Independent RPC agreement required/);
  assert.equal(value.getXp('node-1'), 0);
});

test('client-forged checkpoint is rejected by server verifier', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const forged = { ok: true, bestBlock: 9999, agreement: { checkpoint: '9999:0xfake', votes: 2 } };
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: forged }), /Server witness verification failed/);
  assert.equal(value.getXp('node-1'), 0);
});

test('checkpoint block must match claimed best block', async () => {
  const value = engine();
  const challenge = value.issueChallenge('node-1');
  const mismatch = { ok: true, bestBlock: 4242, agreement: { checkpoint: '4243:0xabc123', votes: 2 } };
  await assert.rejects(value.verifyAndCredit({ challenge, nodeId: 'node-1', witness: mismatch }), /Witness checkpoint mismatch/);
  assert.equal(value.getXp('node-1'), 0);
});

test('append-only ledger reconstructs XP and replay state after restart', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-xp-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'xp-ledger.jsonl');

  const first = engine({ ledger: new FileXpLedger(ledgerPath) });
  const challenge = first.issueChallenge('node-1');
  await first.verifyAndCredit({ challenge, nodeId: 'node-1', witness });
  assert.equal(first.getXp('node-1'), 10);

  const restarted = engine({ ledger: new FileXpLedger(ledgerPath) });
  assert.equal(restarted.getXp('node-1'), 10);
  await assert.rejects(restarted.verifyAndCredit({ challenge, nodeId: 'node-1', witness }), /Replay rejected/);
  assert.equal(restarted.getXp('node-1'), 10);
});

test('corrupt ledger fails closed instead of forgetting replay state', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-xp-corrupt-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const ledgerPath = path.join(dir, 'xp-ledger.jsonl');
  fs.writeFileSync(ledgerPath, '{broken-json}\n', { mode: 0o600 });
  assert.throws(() => new FileXpLedger(ledgerPath), /Corrupt XP ledger/);
});
