import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ZORYQ_CHAIN_ID = 5919065;
export const MOBILE_PROTOCOL_VERSION = 'zoryq-mobile-node-v1';
export const XP_BLOCK_VERIFICATION = 3;
const CHALLENGE_TTL_MS = 5 * 60_000;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;
const NODE_ID = /^zq-[0-9a-f]{24}$/;
const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

function nowIso(now = Date.now()) { return new Date(now).toISOString(); }
function sha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }

export function nodeIdFromPublicKey(publicKeyBase64) {
  if (typeof publicKeyBase64 !== 'string' || publicKeyBase64.length < 40 || publicKeyBase64.length > 2048 || !B64.test(publicKeyBase64)) {
    throw new Error('INVALID_PUBLIC_KEY');
  }
  const der = Buffer.from(publicKeyBase64, 'base64');
  crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  return `zq-${sha256(der).slice(0, 24)}`;
}

export function verifyNodeSignature(publicKeyBase64, payload, signatureBase64) {
  try {
    if (typeof payload !== 'string' || payload.length < 1 || payload.length > 4096) return false;
    if (typeof signatureBase64 !== 'string' || signatureBase64.length < 8 || signatureBase64.length > 1024 || !B64.test(signatureBase64)) return false;
    const key = crypto.createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    return crypto.verify('sha256', Buffer.from(payload, 'utf8'), key, Buffer.from(signatureBase64, 'base64'));
  } catch { return false; }
}

export function registrationPayload(challenge) {
  return ['zoryq-mobile-register-v1', challenge.id, challenge.nonce, challenge.nodeId, challenge.expiresAt].join('|');
}

export function proofPayload({ challengeId, nonce, nodeId, chainId, blockNumber, blockHash, parentHash, observedAt }) {
  return ['zoryq-mobile-proof-v1', challengeId, nonce, nodeId, String(chainId), String(blockNumber), blockHash, parentHash, observedAt].join('|');
}

function safeRecord(record) {
  return JSON.stringify(record).replace(/[\r\n]/g, '');
}

export class MobileNodeProtocol {
  constructor({ stateFile, chainReader, clock = () => Date.now() } = {}) {
    if (typeof chainReader !== 'function') throw new Error('CHAIN_READER_REQUIRED');
    this.chainReader = chainReader;
    this.clock = clock;
    this.stateFile = stateFile || '';
    this.nodes = new Map();
    this.registrationChallenges = new Map();
    this.taskChallenges = new Map();
    this.usedChallenges = new Set();
    this.xpEvents = new Map();
    this.load();
  }

  load() {
    if (!this.stateFile || !fs.existsSync(this.stateFile)) return;
    const lines = fs.readFileSync(this.stateFile, 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      let e; try { e = JSON.parse(line); } catch { throw new Error('MOBILE_STATE_CORRUPT'); }
      if (e.type === 'registration_challenge') this.registrationChallenges.set(e.challenge.id, e.challenge);
      if (e.type === 'node_registered') this.nodes.set(e.node.nodeId, e.node);
      if (e.type === 'task_challenge') this.taskChallenges.set(e.challenge.id, e.challenge);
      if (e.type === 'challenge_consumed') this.usedChallenges.add(e.challengeId);
      if (e.type === 'xp_awarded') this.xpEvents.set(e.challengeId, e);
    }
  }

  append(event) {
    if (this.stateFile) {
      fs.mkdirSync(path.dirname(this.stateFile), { recursive: true });
      fs.appendFileSync(this.stateFile, `${safeRecord(event)}\n`, { encoding: 'utf8', mode: 0o600 });
    }
  }

  registrationChallenge({ nodeId, publicKey }) {
    const derived = nodeIdFromPublicKey(publicKey);
    if (nodeId !== derived || !NODE_ID.test(nodeId)) throw new Error('NODE_ID_PUBLIC_KEY_MISMATCH');
    const issuedAtMs = this.clock();
    const challenge = {
      kind: 'registration', id: crypto.randomUUID(), nonce: crypto.randomBytes(24).toString('base64url'),
      nodeId, publicKey, issuedAt: nowIso(issuedAtMs), expiresAt: nowIso(issuedAtMs + CHALLENGE_TTL_MS), protocolVersion: MOBILE_PROTOCOL_VERSION
    };
    this.registrationChallenges.set(challenge.id, challenge);
    this.append({ type: 'registration_challenge', at: challenge.issuedAt, challenge });
    return { ...challenge, publicKey: undefined };
  }

  register({ challengeId, nodeId, publicKey, signature }) {
    const c = this.registrationChallenges.get(challengeId);
    if (!c || c.nodeId !== nodeId || c.publicKey !== publicKey) throw new Error('REGISTRATION_CHALLENGE_INVALID');
    if (this.usedChallenges.has(challengeId)) throw new Error('CHALLENGE_ALREADY_USED');
    if (this.clock() > Date.parse(c.expiresAt)) throw new Error('CHALLENGE_EXPIRED');
    if (nodeIdFromPublicKey(publicKey) !== nodeId) throw new Error('NODE_ID_PUBLIC_KEY_MISMATCH');
    if (!verifyNodeSignature(publicKey, registrationPayload(c), signature)) throw new Error('INVALID_NODE_SIGNATURE');
    const node = { nodeId, publicKey, registeredAt: nowIso(this.clock()), protocolVersion: MOBILE_PROTOCOL_VERSION };
    this.nodes.set(nodeId, node);
    this.usedChallenges.add(challengeId);
    this.append({ type: 'node_registered', at: node.registeredAt, node });
    this.append({ type: 'challenge_consumed', at: node.registeredAt, challengeId, reason: 'registration' });
    return { ok: true, nodeId, registeredAt: node.registeredAt, protocolVersion: MOBILE_PROTOCOL_VERSION };
  }

  async taskChallenge(nodeId) {
    if (!this.nodes.has(nodeId)) throw new Error('NODE_NOT_REGISTERED');
    const chain = await this.chainReader('latest');
    if (Number(chain.chainId) !== ZORYQ_CHAIN_ID) throw new Error('CHAIN_ID_MISMATCH');
    const targetBlock = Number(chain.blockNumber);
    if (!Number.isSafeInteger(targetBlock) || targetBlock < 0) throw new Error('INVALID_TARGET_BLOCK');
    const issuedAtMs = this.clock();
    const challenge = {
      kind: 'block_verification', id: crypto.randomUUID(), nonce: crypto.randomBytes(24).toString('base64url'),
      nodeId, chainId: ZORYQ_CHAIN_ID, targetBlock, issuedAt: nowIso(issuedAtMs), expiresAt: nowIso(issuedAtMs + CHALLENGE_TTL_MS),
      protocolVersion: MOBILE_PROTOCOL_VERSION
    };
    this.taskChallenges.set(challenge.id, challenge);
    this.append({ type: 'task_challenge', at: challenge.issuedAt, challenge });
    return challenge;
  }

  async submitProof(proof) {
    const c = this.taskChallenges.get(proof?.challengeId);
    if (!c || c.nodeId !== proof?.nodeId || c.nonce !== proof?.nonce) throw new Error('TASK_CHALLENGE_INVALID');
    if (this.usedChallenges.has(c.id) || this.xpEvents.has(c.id)) throw new Error('CHALLENGE_ALREADY_USED');
    const now = this.clock();
    if (now > Date.parse(c.expiresAt)) throw new Error('CHALLENGE_EXPIRED');
    if (Number(proof.chainId) !== ZORYQ_CHAIN_ID || Number(proof.blockNumber) !== c.targetBlock) throw new Error('PROOF_TARGET_MISMATCH');
    const observedMs = Date.parse(proof.observedAt);
    if (!Number.isFinite(observedMs) || observedMs < Date.parse(c.issuedAt) - MAX_CLOCK_SKEW_MS || observedMs > now + MAX_CLOCK_SKEW_MS || observedMs > Date.parse(c.expiresAt) + MAX_CLOCK_SKEW_MS) throw new Error('PROOF_TIMESTAMP_INVALID');
    if (!/^0x[0-9a-fA-F]{64}$/.test(proof.blockHash || '') || !/^0x[0-9a-fA-F]{64}$/.test(proof.parentHash || '')) throw new Error('PROOF_HASH_INVALID');
    const node = this.nodes.get(c.nodeId);
    if (!node) throw new Error('NODE_NOT_REGISTERED');
    const payload = proofPayload(proof);
    if (!verifyNodeSignature(node.publicKey, payload, proof.signature)) throw new Error('INVALID_NODE_SIGNATURE');

    const canonical = await this.chainReader(c.targetBlock);
    if (Number(canonical.chainId) !== ZORYQ_CHAIN_ID || Number(canonical.blockNumber) !== c.targetBlock) throw new Error('CHAIN_VERIFICATION_FAILED');
    if (String(canonical.blockHash).toLowerCase() !== String(proof.blockHash).toLowerCase() || String(canonical.parentHash).toLowerCase() !== String(proof.parentHash).toLowerCase()) throw new Error('BLOCK_PROOF_MISMATCH');

    const acceptedAt = nowIso(now);
    const event = {
      type: 'xp_awarded', eventId: crypto.randomUUID(), at: acceptedAt, challengeId: c.id, nodeId: c.nodeId,
      taskType: c.kind, proofHash: sha256(payload), xpDelta: XP_BLOCK_VERIFICATION, reason: 'verified_block_challenge', verificationStatus: 'accepted'
    };
    this.usedChallenges.add(c.id);
    this.xpEvents.set(c.id, event);
    this.append({ type: 'challenge_consumed', at: acceptedAt, challengeId: c.id, reason: 'proof_accepted' });
    this.append(event);
    return { ok: true, accepted: true, xpAwarded: event.xpDelta, eventId: event.eventId, proofHash: event.proofHash, totalXp: this.status(c.nodeId).totalXp };
  }

  status(nodeId) {
    if (!this.nodes.has(nodeId)) throw new Error('NODE_NOT_REGISTERED');
    const events = [...this.xpEvents.values()].filter(e => e.nodeId === nodeId);
    return {
      ok: true, nodeId, totalXp: events.reduce((n, e) => n + Number(e.xpDelta || 0), 0),
      acceptedProofs: events.length, protocolVersion: MOBILE_PROTOCOL_VERSION,
      xpMeaning: 'testnet participation points; not money or guaranteed token value'
    };
  }
}
