import http from 'node:http';
import fs from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { Contract, JsonRpcProvider, getAddress, verifyMessage } from 'ethers';

const PORT = Number(process.env.PORT || 8083);
const TREASURY = getAddress(String(process.env.ZORYQ_ADMIN_TREASURY || '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33').toLowerCase());
const ZUSD = getAddress(String(process.env.ZORYQ_ZUSD || '0xd2121e96c6af936c0496fdb499c1d0613d26c2b9').toLowerCase());
const PROOF_FILE = process.env.ZORYQ_ADMIN_CONTROL_PROOF || '/data/admin-control-proof.json';
const DEPLOYMENT_FILE = process.env.ZORYQ_PROTOCOL_DEPLOYMENTS || '/data/protocol-deployments.json';
const RPC = process.env.PUBLIC_RPC_URL || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const provider = new JsonRpcProvider(RPC, 5919065, { staticNetwork: true });
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
function readFile(file, fallback = null) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function writeFile(file, value) { const tmp = `${file}.tmp`; fs.writeFileSync(tmp, JSON.stringify(value, null, 2)); fs.renameSync(tmp, file); }
function loadProof() { return readFile(PROOF_FILE, null); }
function proofIsValid() { const proof = loadProof(); return !!proof && String(proof.address || '').toLowerCase() === TREASURY.toLowerCase(); }
function prune() { const now = Date.now(); for (const [key, value] of challenges) if (now - value.createdAt > TTL_MS) challenges.delete(key); }
async function requireReceipt(txHash, address) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ''))) throw new Error('invalid_tx_hash');
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) throw new Error('deployment_receipt_not_successful');
  if (!receipt.contractAddress || getAddress(receipt.contractAddress) !== address) throw new Error('receipt_contract_address_mismatch');
  return receipt;
}
async function codeBytes(address) { const code = await provider.getCode(address); if (code === '0x') throw new Error('deployed_bytecode_missing'); return (code.length - 2) / 2; }
async function verifyDeployment(kind, address, txHash) {
  const bytes = await codeBytes(address);
  const receipt = await requireReceipt(txHash, address);
  const base = { kind, address, txHash, blockNumber: receipt.blockNumber, bytecodeBytes: bytes, verifiedAt: new Date().toISOString() };
  if (kind === 'dexV1') {
    const c = new Contract(address, [
      'function owner() view returns(address)','function feeRecipient() view returns(address)','function token() view returns(address)',
      'function TOTAL_FEE_BPS() view returns(uint256)','function LP_FEE_BPS() view returns(uint256)','function PROTOCOL_FEE_BPS() view returns(uint256)'
    ], provider);
    const [owner, feeRecipient, token, totalFee, lpFee, protocolFee] = await Promise.all([c.owner(), c.feeRecipient(), c.token(), c.TOTAL_FEE_BPS(), c.LP_FEE_BPS(), c.PROTOCOL_FEE_BPS()]);
    if (getAddress(owner) !== TREASURY) throw new Error('dex_owner_mismatch');
    if (getAddress(feeRecipient) !== TREASURY) throw new Error('dex_fee_recipient_mismatch');
    if (getAddress(token) !== ZUSD) throw new Error('dex_token_mismatch');
    if (totalFee !== 30n || lpFee !== 20n || protocolFee !== 10n) throw new Error('dex_fee_constants_mismatch');
    return { ...base, owner: getAddress(owner), feeRecipient: getAddress(feeRecipient), token: getAddress(token), totalFeeBps: 30, lpFeeBps: 20, protocolFeeBps: 10 };
  }
  if (kind === 'lending') {
    const c = new Contract(address, ['function owner() view returns(address)','function debtToken() view returns(address)','function maxLtvBps() view returns(uint256)','function liquidationThresholdBps() view returns(uint256)','function aprBps() view returns(uint256)'], provider);
    const [owner, token, maxLtv, threshold, apr] = await Promise.all([c.owner(), c.debtToken(), c.maxLtvBps(), c.liquidationThresholdBps(), c.aprBps()]);
    if (getAddress(owner) !== TREASURY) throw new Error('lending_owner_mismatch');
    if (getAddress(token) !== ZUSD) throw new Error('lending_token_mismatch');
    return { ...base, owner: getAddress(owner), debtToken: getAddress(token), maxLtvBps: Number(maxLtv), liquidationThresholdBps: Number(threshold), aprBps: Number(apr) };
  }
  if (kind === 'projectRegistry') {
    const c = new Contract(address, ['function projectCount() view returns(uint256)'], provider);
    const projectCount = await c.projectCount();
    return { ...base, projectCount: projectCount.toString() };
  }
  throw new Error('unsupported_protocol_kind');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url || '/', 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/admin/control/status') {
      const proof = loadProof();
      return send(res, 200, {
        ok: true, treasury: TREASURY, zUSD: ZUSD,
        proven: proofIsValid(),
        proof: proof ? { address: proof.address, provenAt: proof.provenAt, proofDigest: proof.proofDigest, chainId: proof.chainId } : null,
        disclosure: 'No private key or wallet signature is stored. Only a digest and verification metadata are persisted.'
      });
    }

    if (req.method === 'GET' && url.pathname === '/admin/control/deployments') {
      return send(res, 200, { ok: true, treasury: TREASURY, zUSD: ZUSD, controlProven: proofIsValid(), deployments: readFile(DEPLOYMENT_FILE, {}) || {} });
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
      writeFile(PROOF_FILE, proof);
      challenges.delete(nonce);
      return send(res, 200, { ok: true, treasury: TREASURY, proven: true, proof, next: 'Administrative control is cryptographically proven. Protocol deployments still require explicit wallet confirmation and post-deployment verification.' });
    }

    if (req.method === 'POST' && url.pathname === '/admin/control/verify-deployment') {
      if (!proofIsValid()) return send(res, 403, { ok: false, error: 'treasury_control_proof_required' });
      const body = await readJson(req);
      let address;
      try { address = getAddress(String(body.address || '').toLowerCase()); } catch { return send(res, 400, { ok: false, error: 'invalid_contract_address' }); }
      const kind = String(body.kind || '');
      const txHash = String(body.txHash || '');
      const verified = await verifyDeployment(kind, address, txHash);
      const deployments = readFile(DEPLOYMENT_FILE, {}) || {};
      deployments[kind] = verified;
      writeFile(DEPLOYMENT_FILE, deployments);
      return send(res, 200, { ok: true, verified, canonicalCandidate: true, notice: 'This deployment passed receipt, bytecode and protocol configuration checks. Frontend publication should use this verified record as its source.' });
    }

    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    console.error('admin-control error', error);
    return send(res, 500, { ok: false, error: error?.message || 'internal_error' });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`ZORYQ admin control verifier listening on 127.0.0.1:${PORT}`));
