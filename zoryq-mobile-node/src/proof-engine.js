import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { xpCreditEvent } from './xp-ledger.js';

const DEFAULT_TTL_MS = 120_000;
const DEFAULT_XP = 10;
const PROTOCOL_VERSION = 1;

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function mac(secret, payload) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function secureEqual(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function validateWitnessShape(witness) {
  if (!witness?.ok) throw new Error('Witness proof is not healthy');
  if (!Number.isInteger(witness.bestBlock) || witness.bestBlock < 0) throw new Error('Invalid witness block');
  if (!witness.agreement?.checkpoint || !Number.isInteger(witness.agreement.votes)) throw new Error('Missing witness checkpoint');
  if (witness.agreement.votes < 2) throw new Error('Independent RPC agreement required');

  const separator = witness.agreement.checkpoint.indexOf(':');
  if (separator <= 0) throw new Error('Malformed witness checkpoint');
  const checkpointBlock = Number(witness.agreement.checkpoint.slice(0, separator));
  const checkpointHash = witness.agreement.checkpoint.slice(separator + 1);
  if (checkpointBlock !== witness.bestBlock || !checkpointHash.startsWith('0x') || checkpointHash.length < 4) {
    throw new Error('Witness checkpoint mismatch');
  }
}

function validateLedger(ledger) {
  if (!ledger || typeof ledger.hasEvent !== 'function' || typeof ledger.appendCredit !== 'function' || typeof ledger.getXp !== 'function') {
    throw new Error('ProofEngine requires an idempotent XP ledger');
  }
}

/** Challenge -> server verification -> append-only XP event. */
export class ProofEngine {
  constructor({ secret, ttlMs = DEFAULT_TTL_MS, xpPerProof = DEFAULT_XP, now = () => Date.now(), verifyWitness, ledger } = {}) {
    if (!secret || String(secret).length < 32) throw new Error('ProofEngine requires a secret of at least 32 characters');
    if (typeof verifyWitness !== 'function') throw new Error('ProofEngine requires a server-owned verifyWitness function');
    validateLedger(ledger);
    this.secret = String(secret);
    this.ttlMs = ttlMs;
    this.xpPerProof = xpPerProof;
    this.now = now;
    this.verifyWitness = verifyWitness;
    this.ledger = ledger;
  }

  issueChallenge(nodeId) {
    if (!nodeId) throw new Error('nodeId is required');
    const issuedAt = this.now();
    const payload = { v: PROTOCOL_VERSION, nodeId, nonce: randomBytes(24).toString('hex'), issuedAt, expiresAt: issuedAt + this.ttlMs };
    const body = encode(payload);
    return `${body}.${mac(this.secret, body)}`;
  }

  inspectChallenge(token) {
    if (!token || !token.includes('.')) throw new Error('Malformed challenge');
    const parts = token.split('.');
    if (parts.length !== 2) throw new Error('Malformed challenge');
    const [body, signature] = parts;
    const expected = mac(this.secret, body);
    if (!secureEqual(signature, expected)) throw new Error('Invalid challenge signature');
    const payload = decode(body);
    if (payload.v !== PROTOCOL_VERSION || !payload.nodeId || !payload.nonce) throw new Error('Invalid challenge payload');
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= payload.issuedAt) throw new Error('Invalid challenge time window');
    if (this.now() > payload.expiresAt) throw new Error('Expired challenge');
    return payload;
  }

  async verifyAndCredit({ challenge, nodeId, witness }) {
    const payload = this.inspectChallenge(challenge);
    if (payload.nodeId !== nodeId) throw new Error('Challenge node mismatch');
    if (this.ledger.hasEvent(payload.nonce)) throw new Error('Replay rejected');

    validateWitnessShape(witness);
    const verified = await this.verifyWitness({ nodeId, challenge: payload, witness });
    if (verified !== true) throw new Error('Server witness verification failed');

    // Re-check after async verification so a concurrent replay cannot pass the
    // pre-verification check and mint a duplicate event in this process.
    if (this.ledger.hasEvent(payload.nonce)) throw new Error('Replay rejected');

    const verifiedAt = new Date(this.now()).toISOString();
    const event = xpCreditEvent({
      eventId: payload.nonce,
      nodeId,
      xp: this.xpPerProof,
      bestBlock: witness.bestBlock,
      checkpoint: witness.agreement.checkpoint,
      at: verifiedAt,
    });
    if (!this.ledger.appendCredit(event)) throw new Error('Replay rejected');

    return {
      accepted: true,
      protocolVersion: PROTOCOL_VERSION,
      replayProtected: true,
      serverVerified: true,
      nodeId,
      xpAwarded: this.xpPerProof,
      xpBalance: this.ledger.getXp(nodeId),
      bestBlock: witness.bestBlock,
      checkpoint: witness.agreement.checkpoint,
      consumedNonce: payload.nonce,
      verifiedAt,
    };
  }

  getXp(nodeId) {
    return this.ledger.getXp(nodeId);
  }
}
