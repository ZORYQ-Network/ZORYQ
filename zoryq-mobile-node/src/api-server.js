import http from 'node:http';
import { verifyRegisteredNodeProof } from './proof-auth.js';

const DEFAULT_BODY_LIMIT = 64 * 1024;
const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;

function json(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
}

async function readJson(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('Request body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Malformed JSON'), { statusCode: 400 });
  }
}

function clientKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

function createLimiter({ now, windowMs, maxRequests }) {
  const buckets = new Map();
  return (key) => {
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket || time - bucket.startedAt >= windowMs) {
      bucket = { startedAt: time, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= maxRequests;
  };
}

function errorStatus(message) {
  if (/replay/i.test(message)) return 409;
  if (/not registered/i.test(message)) return 403;
  if (/signature|challenge|node|witness|checkpoint|chain|expired|required|invalid|malformed/i.test(message)) return 400;
  return 500;
}

/**
 * Minimal HTTP boundary for the Mobile Node protocol.
 *
 * Security properties:
 * - no XP route accepts a client-supplied public key;
 * - proof submission requires a signature from the key already registered for nodeId;
 * - server-owned ProofEngine independently verifies the witness before XP;
 * - asynchronous RPC verification is awaited before any ledger write;
 * - body limits and a conservative per-client fixed-window rate limit are fail-closed;
 * - heartbeat is intentionally absent from XP issuance.
 */
export function createMobileNodeApi({
  registrationEngine,
  proofEngine,
  now = () => Date.now(),
  bodyLimit = DEFAULT_BODY_LIMIT,
  rateWindowMs = DEFAULT_WINDOW_MS,
  maxRequestsPerWindow = DEFAULT_MAX_REQUESTS,
} = {}) {
  if (!registrationEngine || typeof registrationEngine.issueChallenge !== 'function' || typeof registrationEngine.register !== 'function') {
    throw new Error('registrationEngine is required');
  }
  if (!proofEngine || typeof proofEngine.issueChallenge !== 'function' || typeof proofEngine.verifyAndCredit !== 'function') {
    throw new Error('proofEngine is required');
  }
  const allow = createLimiter({ now, windowMs: rateWindowMs, maxRequests: maxRequestsPerWindow });

  return http.createServer(async (req, res) => {
    try {
      if (!allow(clientKey(req))) return json(res, 429, { ok: false, error: 'Rate limit exceeded' });
      const url = new URL(req.url || '/', 'http://localhost');

      if (req.method === 'GET' && url.pathname === '/health') {
        return json(res, 200, { ok: true, service: 'zoryq-mobile-node-api', protocolVersion: 1 });
      }

      if (req.method === 'POST' && url.pathname === '/v1/registration/challenge') {
        const { nodeId } = await readJson(req, bodyLimit);
        return json(res, 200, { ok: true, challenge: registrationEngine.issueChallenge({ nodeId }) });
      }

      if (req.method === 'POST' && url.pathname === '/v1/registration') {
        const body = await readJson(req, bodyLimit);
        const registered = registrationEngine.register(body);
        return json(res, 201, { ok: true, registered });
      }

      if (req.method === 'POST' && url.pathname === '/v1/proof/challenge') {
        const { nodeId } = await readJson(req, bodyLimit);
        if (!registrationEngine.get(nodeId)) throw new Error('Node is not registered');
        return json(res, 200, { ok: true, challenge: proofEngine.issueChallenge(nodeId) });
      }

      if (req.method === 'POST' && url.pathname === '/v1/proof') {
        const body = await readJson(req, bodyLimit);
        verifyRegisteredNodeProof({
          registrationEngine,
          challenge: body.challenge,
          nodeId: body.nodeId,
          witness: body.witness,
          signatureBase64: body.signatureBase64,
        });
        const result = await proofEngine.verifyAndCredit({
          challenge: body.challenge,
          nodeId: body.nodeId,
          witness: body.witness,
        });
        return json(res, 200, { ok: true, result });
      }

      if (req.method === 'GET' && url.pathname.startsWith('/v1/xp/')) {
        const nodeId = decodeURIComponent(url.pathname.slice('/v1/xp/'.length));
        if (!registrationEngine.get(nodeId)) throw new Error('Node is not registered');
        return json(res, 200, { ok: true, nodeId, xp: proofEngine.getXp(nodeId) });
      }

      return json(res, 404, { ok: false, error: 'Not found' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      const status = error?.statusCode || errorStatus(message);
      return json(res, status, { ok: false, error: status >= 500 ? 'Internal server error' : message });
    }
  });
}
