import { getAddress, verifyMessage } from 'ethers';
import { authorizeExecution, canonicalPermission, permissionHash } from './capability.mjs';

const DOMAIN = 'ZORYQ Agent Capability v1';

export function permissionSigningMessage(permission) {
  const p = canonicalPermission(permission);
  const hash = permissionHash(p);
  return [
    DOMAIN,
    `Chain ID: ${p.chainId}`,
    `Owner: ${getAddress(p.owner)}`,
    `Agent: ${getAddress(p.agent)}`,
    `Permission Hash: ${hash}`,
    `Nonce: ${p.nonce}`,
    `Valid From: ${p.windowStart}`,
    `Valid Until: ${p.windowEnd}`,
  ].join('\n');
}

export function verifyPermissionSignature(permission, signature) {
  const p = canonicalPermission(permission);
  let recovered;
  try { recovered = getAddress(verifyMessage(permissionSigningMessage(p), signature)); }
  catch { return { ok:false, code:'invalid_permission_signature' }; }
  const owner = getAddress(p.owner);
  if (recovered !== owner) return { ok:false, code:'permission_signature_not_owner', recovered, owner };
  return { ok:true, owner, recovered, permissionHash:permissionHash(p), message:permissionSigningMessage(p) };
}

export function authorizeSignedExecution({ permission, signature, request, state, now = Date.now(), expectedChainId = 5919065 }) {
  const p = canonicalPermission(permission);
  if (p.chainId !== expectedChainId) return { ok:false, code:'permission_wrong_domain_chain' };
  const sig = verifyPermissionSignature(p, signature);
  if (!sig.ok) return sig;
  const result = authorizeExecution({ permission:p, request, state, now });
  if (!result.ok) return result;
  return {
    ...result,
    signatureVerified:true,
    receipt:{
      ...result.receipt,
      signatureVerified:true,
      signer:sig.owner,
      domain:DOMAIN,
      chainId:p.chainId,
    },
  };
}
