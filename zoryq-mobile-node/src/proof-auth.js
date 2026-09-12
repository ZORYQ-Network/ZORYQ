import { createPublicKey, verify as verifySignature } from 'node:crypto';
import { MOBILE_NODE_CHAIN_ID } from './registration-engine.js';

const PROOF_AUTH_VERSION = 1;

function requireWitness(witness) {
  if (!witness || !Number.isInteger(witness.bestBlock) || witness.bestBlock < 0) {
    throw new Error('Invalid proof witness block');
  }
  if (!witness.agreement || typeof witness.agreement.checkpoint !== 'string' || !Number.isInteger(witness.agreement.votes)) {
    throw new Error('Invalid proof witness agreement');
  }
}

/**
 * Canonical payload signed by the Android Node Identity key.
 *
 * This deliberately binds the signature to the exact server challenge and the
 * checkpoint being claimed. A signature from a heartbeat or an older proof
 * cannot be transplanted onto a new XP-producing proof.
 */
export function proofSigningPayload({ challenge, nodeId, witness }) {
  if (!challenge || typeof challenge !== 'string') throw new Error('Proof challenge is required');
  if (!/^[0-9a-f]{64}$/.test(nodeId || '')) throw new Error('Invalid nodeId');
  requireWitness(witness);

  return [
    'zoryq-node-proof-v1',
    PROOF_AUTH_VERSION,
    MOBILE_NODE_CHAIN_ID,
    nodeId,
    challenge,
    witness.bestBlock,
    witness.agreement.checkpoint,
    witness.agreement.votes,
  ].join('|');
}

/**
 * Verify that an XP proof was signed by the key registered for this Node ID.
 * registrationEngine.get() is the server trust source; the client never gets
 * to supply a public key during proof submission.
 */
export function verifyRegisteredNodeProof({ registrationEngine, challenge, nodeId, witness, signatureBase64 }) {
  if (!registrationEngine || typeof registrationEngine.get !== 'function') {
    throw new Error('Registration engine is required');
  }
  const registered = registrationEngine.get(nodeId);
  if (!registered) throw new Error('Node is not registered');
  if (!signatureBase64 || typeof signatureBase64 !== 'string') throw new Error('Node proof signature is required');

  const key = createPublicKey({
    key: Buffer.from(registered.publicKeyBase64, 'base64'),
    format: 'der',
    type: 'spki',
  });
  const payload = proofSigningPayload({ challenge, nodeId, witness });
  const ok = verifySignature('sha256', Buffer.from(payload), key, Buffer.from(signatureBase64, 'base64'));
  if (!ok) throw new Error('Invalid node proof signature');
  return true;
}
