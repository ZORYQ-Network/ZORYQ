import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const DEFAULT_TTL_MS = 120_000;
const DEFAULT_XP = 10;

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

export class ProofEngine {
  constructor({ secret, ttlMs = DEFAULT_TTL_MS, xpPerProof = DEFAULT_XP, now = () => Date.now() } = {}) {
    if (!secret || String(secret).length < 32) throw new Error('ProofEngine requires a secret of at least 32 characters');
    this.secret = String(secret);
    this.ttlMs = ttlMs;
    this.xpPerProof = xpPerProof;
    this.now = now;
    this.consumed = new Set();
    this.xp = new Map();
  }

  issueChallenge(nodeId) {
    if (!nodeId) throw new Error('nodeId is required');
    const issuedAt = this.now();
    const payload = {
      v: 1,
      nodeId,
      nonce: randomBytes(24).toString('hex'),
      issuedAt,
      expiresAt: issuedAt + this.ttlMs
    };
    const body = encode(payload);
    return `${body}.${mac(this.secret, body)}`;
  }

  inspectChallenge(token) {
    if (!token || !token.includes('.')) throw new Error('Malformed challenge');
    const [body, signature] = token.split('.');
    const expected = mac(this.secret, body);
    if (!secureEqual(signature, expected)) throw new Error('Invalid challenge signature');
    const payload = decode(body);
    if (payload.v !== 1 || !payload.nodeId || !payload.nonce) throw new Error('Invalid challenge payload');
    if (this.now() > payload.expiresAt) throw new Error('Expired challenge');
    return payload;
  }

  verifyAndCredit({ challenge, nodeId, witness }) {
    const payload = this.inspectChallenge(challenge);
    if (payload.nodeId !== nodeId) throw new Error('Challenge node mismatch');
    if (this.consumed.has(payload.nonce)) throw new Error('Replay rejected');
    if (!witness?.ok) throw new Error('Witness proof is not healthy');
    if (!Number.isInteger(witness.bestBlock) || witness.bestBlock < 0) throw new Error('Invalid witness block');
    if (!witness.agreement?.checkpoint || witness.agreement.votes < 1) throw new Error('Missing witness checkpoint');

    this.consumed.add(payload.nonce);
    const previous = this.xp.get(nodeId) || 0;
    const balance = previous + this.xpPerProof;
    this.xp.set(nodeId, balance);

    return {
      accepted: true,
      replayProtected: true,
      nodeId,
      xpAwarded: this.xpPerProof,
      xpBalance: balance,
      bestBlock: witness.bestBlock,
      checkpoint: witness.agreement.checkpoint,
      consumedNonce: payload.nonce,
      verifiedAt: new Date(this.now()).toISOString()
    };
  }

  getXp(nodeId) {
    return this.xp.get(nodeId) || 0;
  }
}
