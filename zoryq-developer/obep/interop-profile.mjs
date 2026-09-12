import { hashObject, verifyProofPack } from './obep.mjs';

export const OBEP_INTEROP_VERSION = '0.2.0';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeAddress(value, field) {
  const address = String(value ?? '').toLowerCase();
  assert(/^0x[0-9a-f]{40}$/.test(address), `${field} invalid`);
  return address;
}

export function createExternalReference({ standard, chainId, contract = null, id, evidence = null, evidenceHash = null, uri = null }) {
  assert(standard, 'standard required');
  assert(Number.isInteger(Number(chainId)) && Number(chainId) > 0, 'chainId invalid');
  assert(id !== undefined && id !== null && String(id).length > 0, 'external id required');
  const normalizedContract = contract === null ? null : normalizeAddress(contract, 'contract');
  const resolvedEvidenceHash = evidenceHash ?? (evidence === null ? null : hashObject(evidence));
  assert(resolvedEvidenceHash === null || /^0x[0-9a-f]{64}$/i.test(resolvedEvidenceHash), 'evidenceHash invalid');
  const core = {
    standard: String(standard).toUpperCase(),
    chainId: Number(chainId),
    contract: normalizedContract,
    id: String(id),
    evidenceHash: resolvedEvidenceHash?.toLowerCase() ?? null,
    uri: uri ?? null,
  };
  return Object.freeze({ ...core, referenceHash: hashObject(core) });
}

export function verifyExternalReference(reference, evidence = null) {
  const { referenceHash, ...core } = reference;
  assert(hashObject(core) === referenceHash, 'external reference tampered');
  if (evidence !== null) {
    assert(reference.evidenceHash === hashObject(evidence), 'external evidence hash mismatch');
  }
  return true;
}

export function createErc8183JobReference({ chainId, contract, job }) {
  assert(job && typeof job === 'object', 'ERC-8183 job required');
  const snapshot = {
    jobId: String(job.jobId),
    client: normalizeAddress(job.client, 'ERC-8183 client'),
    provider: normalizeAddress(job.provider, 'ERC-8183 provider'),
    evaluator: normalizeAddress(job.evaluator, 'ERC-8183 evaluator'),
    budget: String(job.budget),
    status: String(job.status).toUpperCase(),
    deliverable: String(job.deliverable ?? '').toLowerCase(),
    descriptionHash: job.descriptionHash ?? null,
    paymentToken: job.paymentToken ? normalizeAddress(job.paymentToken, 'ERC-8183 paymentToken') : null,
  };
  assert(snapshot.jobId.length > 0, 'ERC-8183 jobId required');
  assert(snapshot.status === 'COMPLETED', 'ERC-8183 job must be completed');
  assert(/^0x[0-9a-f]{64}$/.test(snapshot.deliverable), 'ERC-8183 deliverable must be bytes32');
  return {
    snapshot: Object.freeze(snapshot),
    reference: createExternalReference({
      standard: 'ERC-8183',
      chainId,
      contract,
      id: snapshot.jobId,
      evidence: snapshot,
    }),
  };
}

export function createErc8004AgentReference({ chainId, contract, agentId, role, address, registryEvidence = null }) {
  const evidence = {
    agentId: String(agentId),
    role: String(role).toUpperCase(),
    address: normalizeAddress(address, 'ERC-8004 agent address'),
    registryEvidenceHash: registryEvidence === null ? null : hashObject(registryEvidence),
  };
  return {
    evidence: Object.freeze(evidence),
    reference: createExternalReference({
      standard: 'ERC-8004',
      chainId,
      contract,
      id: `${evidence.role}:${evidence.agentId}`,
      evidence,
    }),
  };
}

export function createPolicyReference({ standard = 'ERC-8196', chainId, wallet, policyId, policy }) {
  const evidence = {
    wallet: normalizeAddress(wallet, 'policy wallet'),
    policyId: String(policyId),
    policyHash: hashObject(policy),
  };
  return {
    evidence: Object.freeze(evidence),
    reference: createExternalReference({
      standard,
      chainId,
      contract: wallet,
      id: evidence.policyId,
      evidence,
    }),
  };
}

export function createX402SettlementReference({ chainId, paymentId, payer, payee, amount, asset, txHash, network = null, responseHash = null }) {
  const evidence = {
    paymentId: String(paymentId),
    payer: normalizeAddress(payer, 'x402 payer'),
    payee: normalizeAddress(payee, 'x402 payee'),
    amount: String(amount),
    asset: String(asset),
    txHash: String(txHash).toLowerCase(),
    network,
    responseHash,
  };
  assert(/^0x[0-9a-f]{64}$/.test(evidence.txHash), 'x402 txHash invalid');
  return {
    evidence: Object.freeze(evidence),
    reference: createExternalReference({
      standard: 'X402',
      chainId,
      id: evidence.paymentId,
      evidence,
    }),
  };
}

export function buildInteropEvidence({ proofPack, erc8183, executorIdentity = null, verifierIdentity = null, policy = null, paymentTransport = null }) {
  const proofResult = verifyProofPack(proofPack);
  assert(erc8183?.reference && erc8183?.snapshot, 'ERC-8183 reference required');
  verifyExternalReference(erc8183.reference, erc8183.snapshot);

  const { intent, execution, outcome, receipt } = proofPack;
  const job = erc8183.snapshot;

  assert(Number(erc8183.reference.chainId) === Number(intent.chainId), 'ERC-8183 chain mismatch');
  assert(job.provider === intent.executor, 'ERC-8183 provider / OBEP executor mismatch');
  assert(job.evaluator === intent.verifier, 'ERC-8183 evaluator / OBEP verifier mismatch');
  assert(job.deliverable === execution.outputHash.toLowerCase(), 'ERC-8183 deliverable / OBEP output mismatch');
  assert(job.budget === receipt.amount, 'ERC-8183 budget / OBEP settlement mismatch');
  assert(receipt.to === job.provider, 'OBEP settlement beneficiary mismatch');
  assert(outcome.accepted === true, 'OBEP outcome must be accepted');

  if (executorIdentity) {
    verifyExternalReference(executorIdentity.reference, executorIdentity.evidence);
    assert(executorIdentity.evidence.address === intent.executor, 'executor identity address mismatch');
    assert(executorIdentity.evidence.role === 'EXECUTOR', 'executor identity role mismatch');
  }

  if (verifierIdentity) {
    verifyExternalReference(verifierIdentity.reference, verifierIdentity.evidence);
    assert(verifierIdentity.evidence.address === intent.verifier, 'verifier identity address mismatch');
    assert(verifierIdentity.evidence.role === 'VERIFIER', 'verifier identity role mismatch');
  }

  if (policy) {
    verifyExternalReference(policy.reference, policy.evidence);
    assert(policy.evidence.wallet === intent.treasury, 'policy wallet / OBEP treasury mismatch');
  }

  if (paymentTransport) {
    verifyExternalReference(paymentTransport.reference, paymentTransport.evidence);
    assert(Number(paymentTransport.reference.chainId) === Number(intent.chainId), 'payment transport chain mismatch');
    assert(paymentTransport.evidence.payee === intent.executor, 'payment transport payee mismatch');
    assert(paymentTransport.evidence.amount === receipt.amount, 'payment transport amount mismatch');
    assert(paymentTransport.evidence.txHash === receipt.txHash.toLowerCase(), 'payment transport tx mismatch');
  }

  const evidence = {
    profile: 'ZORYQ_OBEP_INTEROP',
    version: OBEP_INTEROP_VERSION,
    obep: {
      proofPackHash: proofResult.proofPackHash,
      intentId: intent.intentId,
      executionId: execution.executionId,
      outcomeId: outcome.outcomeId,
      receiptId: receipt.receiptId,
    },
    erc8183: erc8183.reference,
    executorIdentity: executorIdentity?.reference ?? null,
    verifierIdentity: verifierIdentity?.reference ?? null,
    policy: policy?.reference ?? null,
    paymentTransport: paymentTransport?.reference ?? null,
  };

  return Object.freeze({ ...evidence, interopHash: hashObject(evidence) });
}

export function verifyInteropEvidence(interoperability, inputs) {
  const { interopHash, ...core } = interoperability;
  assert(hashObject(core) === interopHash, 'interop evidence tampered');
  const rebuilt = buildInteropEvidence(inputs);
  assert(rebuilt.interopHash === interoperability.interopHash, 'interop reconstruction mismatch');
  return { ok: true, interopHash, profile: interoperability.profile, version: interoperability.version };
}
