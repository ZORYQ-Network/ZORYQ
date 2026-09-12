import { createHash, createHmac, randomBytes, timingSafeEqual, verify as verifySignature, createPublicKey } from 'node:crypto';

export const MOBILE_NODE_CHAIN_ID = 5919065;
export const MOBILE_NODE_PROTOCOL_VERSION = 1;
const DEFAULT_TTL_MS = 120_000;

function encode(value) { return Buffer.from(JSON.stringify(value)).toString('base64url'); }
function decode(value) { return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')); }
function mac(secret, body) { return createHmac('sha256', secret).update(body).digest('base64url'); }
function equal(a,b){ const l=Buffer.from(a); const r=Buffer.from(b); return l.length===r.length && timingSafeEqual(l,r); }

export function nodeIdFromPublicKeyBase64(publicKeyBase64) {
  const der = Buffer.from(publicKeyBase64, 'base64');
  if (der.length < 32) throw new Error('Invalid node public key');
  createPublicKey({ key: der, format: 'der', type: 'spki' });
  return createHash('sha256').update(der).digest('hex');
}

export function registrationSigningPayload(challengePayload) {
  return [
    'zoryq-node-registration-v1',
    challengePayload.v,
    challengePayload.chainId,
    challengePayload.nodeId,
    challengePayload.nonce,
    challengePayload.issuedAt,
    challengePayload.expiresAt,
  ].join('|');
}

export class RegistrationEngine {
  constructor({ secret, ttlMs = DEFAULT_TTL_MS, now = () => Date.now() } = {}) {
    if (!secret || String(secret).length < 32) throw new Error('RegistrationEngine requires a server secret');
    this.secret = String(secret);
    this.ttlMs = ttlMs;
    this.now = now;
    this.consumed = new Set();
    this.registered = new Map();
  }

  issueChallenge({ nodeId }) {
    if (!/^[0-9a-f]{64}$/.test(nodeId || '')) throw new Error('Invalid nodeId');
    const issuedAt = this.now();
    const payload = {
      v: MOBILE_NODE_PROTOCOL_VERSION,
      chainId: MOBILE_NODE_CHAIN_ID,
      nodeId,
      nonce: randomBytes(24).toString('hex'),
      issuedAt,
      expiresAt: issuedAt + this.ttlMs,
    };
    const body = encode(payload);
    return `${body}.${mac(this.secret, body)}`;
  }

  inspectChallenge(token) {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) throw new Error('Malformed registration challenge');
    const [body, signature] = parts;
    if (!equal(signature, mac(this.secret, body))) throw new Error('Invalid registration challenge signature');
    const payload = decode(body);
    if (payload.v !== MOBILE_NODE_PROTOCOL_VERSION) throw new Error('Unsupported protocol version');
    if (payload.chainId !== MOBILE_NODE_CHAIN_ID) throw new Error('Wrong chain');
    if (!/^[0-9a-f]{64}$/.test(payload.nodeId || '')) throw new Error('Invalid challenge nodeId');
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= payload.issuedAt) throw new Error('Invalid registration time window');
    if (this.now() > payload.expiresAt) throw new Error('Expired registration challenge');
    return payload;
  }

  register({ challenge, nodeId, publicKeyBase64, signatureBase64 }) {
    const payload = this.inspectChallenge(challenge);
    if (payload.nodeId !== nodeId) throw new Error('Registration node mismatch');
    if (this.consumed.has(payload.nonce)) throw new Error('Registration replay rejected');
    const derivedNodeId = nodeIdFromPublicKeyBase64(publicKeyBase64);
    if (derivedNodeId !== nodeId) throw new Error('Public key does not match nodeId');
    const key = createPublicKey({ key: Buffer.from(publicKeyBase64, 'base64'), format: 'der', type: 'spki' });
    const ok = verifySignature('sha256', Buffer.from(registrationSigningPayload(payload)), key, Buffer.from(signatureBase64, 'base64'));
    if (!ok) throw new Error('Invalid node registration signature');
    this.consumed.add(payload.nonce);
    const record = Object.freeze({
      nodeId,
      publicKeyBase64,
      chainId: MOBILE_NODE_CHAIN_ID,
      protocolVersion: MOBILE_NODE_PROTOCOL_VERSION,
      registeredAt: new Date(this.now()).toISOString(),
    });
    this.registered.set(nodeId, record);
    return record;
  }

  get(nodeId) { return this.registered.get(nodeId) || null; }
}
