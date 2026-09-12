import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  MobileNodeProtocol,
  nodeIdFromPublicKey,
  registrationPayload,
  proofPayload,
  heartbeatPayload,
  ZORYQ_CHAIN_ID,
  MOBILE_PROTOCOL_VERSION,
  TASK_CHALLENGE_COOLDOWN_MS,
  HEARTBEAT_CHALLENGE_COOLDOWN_MS,
  MAX_ACCEPTED_PROOFS_PER_HOUR,
  XP_BLOCK_VERIFICATION
} from './mobile-node.mjs';

function identity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const publicKeyBase64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  return {
    publicKey: publicKeyBase64,
    nodeId: nodeIdFromPublicKey(publicKeyBase64),
    sign(payload) { return crypto.sign('sha256', Buffer.from(payload), privateKey).toString('base64'); }
  };
}

function fixture() {
  let now = Date.parse('2026-09-12T04:00:00.000Z');
  const stateFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zoryq-mobile-')), 'state.jsonl');
  const chainReader = async target => ({
    chainId: ZORYQ_CHAIN_ID,
    blockNumber: target === 'latest' ? 1200 : Number(target),
    blockHash: '0x' + 'ab'.repeat(32),
    parentHash: '0x' + 'cd'.repeat(32)
  });
  return {
    stateFile,
    chainReader,
    get now() { return now; },
    advance(ms) { now += ms; },
    protocol: new MobileNodeProtocol({ stateFile, chainReader, clock: () => now })
  };
}

function register(f, id) {
  const c = f.protocol.registrationChallenge({ nodeId: id.nodeId, publicKey: id.publicKey });
  return f.protocol.register({
    challengeId: c.id,
    nodeId: id.nodeId,
    publicKey: id.publicKey,
    signature: id.sign(registrationPayload({ ...c, publicKey: id.publicKey }))
  });
}

function signedProof(f, id, c, overrides = {}) {
  const proof = {
    challengeId: c.id,
    nonce: c.nonce,
    nodeId: id.nodeId,
    chainId: ZORYQ_CHAIN_ID,
    blockNumber: c.targetBlock,
    blockHash: '0x' + 'ab'.repeat(32),
    parentHash: '0x' + 'cd'.repeat(32),
    observedAt: new Date(f.now).toISOString(),
    ...overrides
  };
  proof.signature = id.sign(proofPayload(proof));
  return proof;
}

test('node identity is derived from SPKI public key', () => {
  const id = identity();
  assert.match(id.nodeId, /^zq-[0-9a-f]{24}$/);
  assert.equal(id.nodeId, nodeIdFromPublicKey(id.publicKey));
});

test('registration requires a valid dedicated node signature', () => {
  const f = fixture();
  const id = identity();
  const c = f.protocol.registrationChallenge({ nodeId: id.nodeId, publicKey: id.publicKey });
  assert.throws(() => f.protocol.register({ challengeId: c.id, nodeId: id.nodeId, publicKey: id.publicKey, signature: Buffer.from('bad').toString('base64') }), /INVALID_NODE_SIGNATURE/);
  assert.equal(f.protocol.register({ challengeId: c.id, nodeId: id.nodeId, publicKey: id.publicKey, signature: id.sign(registrationPayload({ ...c, publicKey: id.publicKey })) }).ok, true);
});

test('verified block proof awards XP exactly once and replay is rejected', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = await f.protocol.taskChallenge(id.nodeId);
  const proof = signedProof(f, id, c);
  const accepted = await f.protocol.submitProof(proof);
  assert.equal(accepted.xpAwarded, XP_BLOCK_VERIFICATION);
  assert.equal(accepted.totalXp, XP_BLOCK_VERIFICATION);
  await assert.rejects(() => f.protocol.submitProof(proof), /CHALLENGE_ALREADY_USED/);
  assert.equal(f.protocol.status(id.nodeId).totalXp, XP_BLOCK_VERIFICATION);
  const lines = fs.readFileSync(f.stateFile, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.filter(e => e.type === 'xp_awarded').length, 1);
});

test('challenge hoarding is blocked and consumed task enters cooldown', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const first = await f.protocol.taskChallenge(id.nodeId);
  await assert.rejects(() => f.protocol.taskChallenge(id.nodeId), /TASK_CHALLENGE_PENDING/);
  await f.protocol.submitProof(signedProof(f, id, first));
  await assert.rejects(() => f.protocol.taskChallenge(id.nodeId), /TASK_CHALLENGE_COOLDOWN/);
  f.advance(TASK_CHALLENGE_COOLDOWN_MS);
  const second = await f.protocol.taskChallenge(id.nodeId);
  assert.notEqual(second.id, first.id);
  assert.equal(f.protocol.status(id.nodeId).pendingTaskChallenges, 1);
});

test('expired pending task is cleaned so a node cannot deadlock itself', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const first = await f.protocol.taskChallenge(id.nodeId);
  f.advance(6 * 60_000);
  const second = await f.protocol.taskChallenge(id.nodeId);
  assert.notEqual(second.id, first.id);
  assert.equal(f.protocol.status(id.nodeId).pendingTaskChallenges, 1);
});

test('hourly XP cap blocks automated farming even with valid cryptographic proofs', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  for (let i = 0; i < MAX_ACCEPTED_PROOFS_PER_HOUR; i++) {
    const c = await f.protocol.taskChallenge(id.nodeId);
    const accepted = await f.protocol.submitProof(signedProof(f, id, c));
    assert.equal(accepted.xpAwarded, XP_BLOCK_VERIFICATION);
    f.advance(TASK_CHALLENGE_COOLDOWN_MS);
  }
  await assert.rejects(() => f.protocol.taskChallenge(id.nodeId), /XP_RATE_LIMITED/);
  const status = f.protocol.status(id.nodeId);
  assert.equal(status.acceptedProofsLastHour, MAX_ACCEPTED_PROOFS_PER_HOUR);
  assert.equal(status.totalXp, MAX_ACCEPTED_PROOFS_PER_HOUR * XP_BLOCK_VERIFICATION);
});

test('XP window recovers after one hour without mutating historical ledger', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  for (let i = 0; i < MAX_ACCEPTED_PROOFS_PER_HOUR; i++) {
    const c = await f.protocol.taskChallenge(id.nodeId);
    await f.protocol.submitProof(signedProof(f, id, c));
    f.advance(TASK_CHALLENGE_COOLDOWN_MS);
  }
  const historicalXp = f.protocol.status(id.nodeId).totalXp;
  f.advance(60 * 60_000);
  const next = await f.protocol.taskChallenge(id.nodeId);
  const accepted = await f.protocol.submitProof(signedProof(f, id, next));
  assert.equal(accepted.xpAwarded, XP_BLOCK_VERIFICATION);
  assert.equal(f.protocol.status(id.nodeId).totalXp, historicalXp + XP_BLOCK_VERIFICATION);
});

test('signed heartbeat records activity, awards zero XP, and replay is rejected', () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = f.protocol.heartbeatChallenge(id.nodeId);
  const heartbeat = { challengeId: c.id, nonce: c.nonce, nodeId: id.nodeId, chainId: ZORYQ_CHAIN_ID, blockSeen: 1200, reportedAt: new Date(f.now).toISOString(), protocolVersion: MOBILE_PROTOCOL_VERSION };
  heartbeat.signature = id.sign(heartbeatPayload(heartbeat));
  const accepted = f.protocol.submitHeartbeat(heartbeat);
  assert.equal(accepted.xpAwarded, 0);
  const status = f.protocol.status(id.nodeId);
  assert.equal(status.totalXp, 0);
  assert.equal(status.heartbeatCount, 1);
  assert.equal(status.reputationStatus, 'not-scored');
  assert.throws(() => f.protocol.submitHeartbeat(heartbeat), /CHALLENGE_ALREADY_USED/);
});

test('heartbeat challenge hoarding is blocked and heartbeat never becomes an XP path', () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = f.protocol.heartbeatChallenge(id.nodeId);
  assert.throws(() => f.protocol.heartbeatChallenge(id.nodeId), /HEARTBEAT_CHALLENGE_PENDING/);
  const heartbeat = { challengeId: c.id, nonce: c.nonce, nodeId: id.nodeId, chainId: ZORYQ_CHAIN_ID, blockSeen: 1200, reportedAt: new Date(f.now).toISOString(), protocolVersion: MOBILE_PROTOCOL_VERSION };
  heartbeat.signature = id.sign(heartbeatPayload(heartbeat));
  f.protocol.submitHeartbeat(heartbeat);
  assert.throws(() => f.protocol.heartbeatChallenge(id.nodeId), /HEARTBEAT_CHALLENGE_COOLDOWN/);
  f.advance(HEARTBEAT_CHALLENGE_COOLDOWN_MS);
  assert.equal(f.protocol.heartbeatChallenge(id.nodeId).kind, 'heartbeat');
  assert.equal(f.protocol.status(id.nodeId).totalXp, 0);
});

test('invalid heartbeat signature and wrong chain award zero XP', () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = f.protocol.heartbeatChallenge(id.nodeId);
  const wrongChain = { challengeId: c.id, nonce: c.nonce, nodeId: id.nodeId, chainId: 1, blockSeen: 1200, reportedAt: new Date(f.now).toISOString(), protocolVersion: MOBILE_PROTOCOL_VERSION, signature: Buffer.from('bad').toString('base64') };
  assert.throws(() => f.protocol.submitHeartbeat(wrongChain), /HEARTBEAT_CHAIN_MISMATCH/);
  assert.equal(f.protocol.status(id.nodeId).totalXp, 0);
});

test('wrong block data earns zero XP', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = await f.protocol.taskChallenge(id.nodeId);
  const proof = signedProof(f, id, c, { blockHash: '0x' + 'ee'.repeat(32) });
  await assert.rejects(() => f.protocol.submitProof(proof), /BLOCK_PROOF_MISMATCH/);
  assert.equal(f.protocol.status(id.nodeId).totalXp, 0);
});

test('expired challenge earns zero XP', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const c = await f.protocol.taskChallenge(id.nodeId);
  f.advance(6 * 60_000);
  const proof = signedProof(f, id, c, { observedAt: c.issuedAt });
  await assert.rejects(() => f.protocol.submitProof(proof), /CHALLENGE_EXPIRED/);
  assert.equal(f.protocol.status(id.nodeId).totalXp, 0);
});

test('append-only ledger reconstructs XP heartbeat consumed challenges and rate state after restart', async () => {
  const f = fixture();
  const id = identity();
  register(f, id);
  const hc = f.protocol.heartbeatChallenge(id.nodeId);
  const hb = { challengeId: hc.id, nonce: hc.nonce, nodeId: id.nodeId, chainId: ZORYQ_CHAIN_ID, blockSeen: 1200, reportedAt: new Date(f.now).toISOString(), protocolVersion: MOBILE_PROTOCOL_VERSION };
  hb.signature = id.sign(heartbeatPayload(hb));
  f.protocol.submitHeartbeat(hb);
  const c = await f.protocol.taskChallenge(id.nodeId);
  const proof = signedProof(f, id, c);
  await f.protocol.submitProof(proof);
  const restarted = new MobileNodeProtocol({ stateFile: f.stateFile, chainReader: f.chainReader, clock: () => f.now });
  assert.equal(restarted.status(id.nodeId).totalXp, XP_BLOCK_VERIFICATION);
  assert.equal(restarted.status(id.nodeId).heartbeatCount, 1);
  assert.equal(restarted.status(id.nodeId).acceptedProofsLastHour, 1);
  await assert.rejects(() => restarted.submitProof(proof), /CHALLENGE_ALREADY_USED/);
  assert.throws(() => restarted.submitHeartbeat(hb), /CHALLENGE_ALREADY_USED/);
  await assert.rejects(() => restarted.taskChallenge(id.nodeId), /TASK_CHALLENGE_COOLDOWN/);
});
