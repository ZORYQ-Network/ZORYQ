import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { getAddress, verifyMessage } from 'ethers';

const PORT = Number(process.env.PORT || 8083);
const TREASURY = getAddress(String(process.env.ZORYQ_ADMIN_TREASURY || '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33').toLowerCase());
const PROOF_FILE = process.env.ZORYQ_ADMIN_CONTROL_PROOF || '/data/admin-control-proof.json';
const TTL_MS = 10 * 60 * 1000;
const challenges = new Map();

fs.mkdirSync('/data', { recursive: true });

function cors(res) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
}
function send(res, status, body) {
  cors(res);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}
async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error('request_too_large');
  }
  return raw ? JSON.parse(raw) : {};
}
function messageFor(address, nonce, issuedAt) {
  return [
    'ZORYQ Admin Control Proof',
    `Treasury: ${TREASURY}`,
    `Signer: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    'Purpose: prove control of the configured ZORYQ Testnet administrative wallet without revealing its private key.',
    'This signature does not authorize a transaction or transfer assets.'
  ].join('\n');
}
function loadProof() {
  try { return JSON.parse(fs.readFileSync(PROOF_FILE, 'utf8')); } catch { return null; }
}
function saveProof(proof) {
  const tmp = `${PROOF_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(proof, null, 2));
  fs.renameSync(tmp, PROOF_FILE);
}
function prune() {
  const now = Date.now();
  for (const [key, value] of challenges) if (now - value.createdAt > TTL_MS) challenges.delete(key);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/admin/control/status') {
      const proof = loadProof();
      return send(res, 200, {
        ok: true,
        treasury: TREASURY,
        proven: !!proof && String(proof.address || '').toLowerCase() === TREASURY.toLowerCase(),
        proof: proof ? { address: proof.address, provenAt: proof.provenAt, proofDigest: proof.proofDigest, chainId: proof.chainId } : null,
        disclosure: 'No private key or wallet signature is stored. Only a digest and verification metadata are persisted.'
      });
    }

    if (req.method === 'GET' && url.pathname === '/admin/control/challenge') {
      prune();
      let address;
      try { address = getAddress(String(url.searchParams.get('address') || '').toLowerCase()); }
      catch { return send(res, 400, { ok: false, error: 'invalid_address' }); }
      if (address !== TREASURY) return send(res, 403, { ok: false, error: 'signer_must_equal_configured_treasury', treasury: TREASURY });
      const nonce = randomBytes(24).toString('hex');
      const issuedAt = new Date().toISOString();
      const message = messageFor(address, nonce, issuedAt);
      challenges.set(nonce, { address, issuedAt, message, createdAt: Date.now() });
      return send(res, 200, { ok: true, treasury: TREASURY, address, nonce, issuedAt, expiresInSeconds: TTL_MS / 1000, message });
    }

    if (req.method === 'POST' && url.pathname === '/admin/control/prove') {
      prune();
      const body = await readJson(req);
      const nonce = String(body.nonce || '');
      const signature = String(body.signature || '');
      const challenge = challenges.get(nonce);
      if (!challenge) return send(res, 400, { ok: false, error: 'invalid_or_expired_challenge' });
      let signer;
      try { signer = getAddress(verifyMessage(challenge.message, signature).toLowerCase()); }
      catch { return send(res, 400, { ok: false, error: 'invalid_signature' }); }
      if (signer !== TREASURY || signer !== challenge.address) return send(res, 403, { ok: false, error: 'signature_not_configured_treasury', treasury: TREASURY, signer });
      const proofDigest = '0x' + createHash('sha256').update(`${challenge.message}:${signature}`).digest('hex');
      const proof = { address: signer, chainId: 5919065, provenAt: new Date().toISOString(), proofDigest, method: 'EIP-191 personal_sign challenge' };
      saveProof(proof);
      challenges.delete(nonce);
      return send(res, 200, { ok: true, treasury: TREASURY, proven: true, proof, next: 'Administrative control is cryptographically proven. Protocol deployments should still require explicit wallet transaction confirmation and post-deployment receipt/code/ownership verification.' });
    }

    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    console.error('admin-control error', error);
    return send(res, 500, { ok: false, error: error?.message || 'internal_error' });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`ZORYQ admin control verifier listening on 127.0.0.1:${PORT}`));
