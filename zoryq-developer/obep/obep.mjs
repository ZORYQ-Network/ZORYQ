import { createHash } from 'node:crypto';

export const OBEP_VERSION = '0.1.0';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

export function hashObject(value) {
  return `0x${createHash('sha256').update(canonicalize(value)).digest('hex')}`;
}

export function createIntentEnvelope({ companyId, goal, task, executor, verifier, treasury, budget, chainId, nonce, validFrom, validUntil, policy = {} }) {
  const envelope = {
    version: OBEP_VERSION,
    companyId,
    goal,
    task,
    executor: executor.toLowerCase(),
    verifier: verifier.toLowerCase(),
    treasury: treasury.toLowerCase(),
    budget: String(budget),
    chainId: Number(chainId),
    nonce: String(nonce),
    validFrom: Number(validFrom),
    validUntil: Number(validUntil),
    policy: {
      maxPayment: String(policy.maxPayment ?? budget),
      asset: policy.asset ?? 'NATIVE',
      capability: policy.capability ?? 'TASK_EXECUTION',
      revocable: policy.revocable !== false,
      ...policy,
    },
  };
  assert(envelope.companyId, 'companyId required');
  assert(envelope.goal, 'goal required');
  assert(envelope.task, 'task required');
  assert(envelope.executor, 'executor required');
  assert(envelope.verifier, 'verifier required');
  assert(envelope.treasury, 'treasury required');
  assert(Number.isFinite(envelope.chainId), 'chainId invalid');
  assert(envelope.validUntil > envelope.validFrom, 'invalid validity window');
  return Object.freeze({ ...envelope, intentId: hashObject(envelope) });
}

export function authorizeIntent(intent, { authorizer, issuedAt, revoked = false }) {
  assert(intent?.intentId, 'intent required');
  const evidence = {
    type: 'OBEP_AUTHORIZATION',
    version: OBEP_VERSION,
    intentId: intent.intentId,
    authorizer: authorizer.toLowerCase(),
    nonce: intent.nonce,
    issuedAt: Number(issuedAt),
    validUntil: intent.validUntil,
    revoked: Boolean(revoked),
  };
  return Object.freeze({ ...evidence, authorizationId: hashObject(evidence) });
}

export function recordExecution(intent, authorization, { executor, output, startedAt, completedAt }) {
  assert(authorization.intentId === intent.intentId, 'authorization intent mismatch');
  assert(!authorization.revoked, 'authorization revoked');
  assert(executor.toLowerCase() === intent.executor, 'wrong executor');
  assert(Number(startedAt) >= intent.validFrom, 'execution before validity window');
  assert(Number(completedAt) <= intent.validUntil, 'execution after validity window');
  assert(Number(completedAt) >= Number(startedAt), 'invalid execution interval');
  const outputHash = hashObject(output);
  const evidence = {
    type: 'OBEP_EXECUTION',
    version: OBEP_VERSION,
    intentId: intent.intentId,
    authorizationId: authorization.authorizationId,
    executor: intent.executor,
    taskHash: hashObject(intent.task),
    outputHash,
    startedAt: Number(startedAt),
    completedAt: Number(completedAt),
  };
  return Object.freeze({ ...evidence, executionId: hashObject(evidence), output });
}

export function verifyOutcome(intent, execution, { verifier, accepted, reason = '', verifiedAt }) {
  assert(execution.intentId === intent.intentId, 'execution intent mismatch');
  assert(verifier.toLowerCase() === intent.verifier, 'wrong verifier');
  assert(execution.taskHash === hashObject(intent.task), 'task substitution detected');
  const evidence = {
    type: 'OBEP_OUTCOME',
    version: OBEP_VERSION,
    intentId: intent.intentId,
    executionId: execution.executionId,
    verifier: intent.verifier,
    outputHash: execution.outputHash,
    accepted: Boolean(accepted),
    reason,
    verifiedAt: Number(verifiedAt),
  };
  return Object.freeze({ ...evidence, outcomeId: hashObject(evidence) });
}

export class ObepLedger {
  constructor() {
    this.usedIntentNonces = new Set();
    this.settledIntents = new Set();
    this.receipts = new Map();
    this.reputation = new Map();
  }

  register(intent) {
    const key = `${intent.chainId}:${intent.companyId}:${intent.nonce}`;
    assert(!this.usedIntentNonces.has(key), 'replayed intent nonce');
    this.usedIntentNonces.add(key);
    return key;
  }

  settle(intent, authorization, execution, outcome, payment) {
    assert(authorization.intentId === intent.intentId, 'authorization mismatch');
    assert(execution.intentId === intent.intentId, 'execution mismatch');
    assert(outcome.intentId === intent.intentId, 'outcome mismatch');
    assert(outcome.executionId === execution.executionId, 'outcome execution mismatch');
    assert(outcome.outputHash === execution.outputHash, 'wrong outcome hash');
    assert(outcome.accepted === true, 'payment blocked: outcome not accepted');
    assert(!authorization.revoked, 'payment blocked: authorization revoked');
    assert(!this.settledIntents.has(intent.intentId), 'duplicate settlement');
    assert(String(payment.amount) === String(intent.policy.maxPayment), 'payment amount mismatch');
    assert(payment.from.toLowerCase() === intent.treasury, 'wrong treasury');
    assert(payment.to.toLowerCase() === intent.executor, 'wrong payment recipient');
    assert(Number(payment.chainId) === intent.chainId, 'wrong payment chain');
    assert(payment.status === 'SUCCESS', 'payment receipt not successful');

    const receiptCore = {
      type: 'OBEP_SETTLEMENT',
      version: OBEP_VERSION,
      intentId: intent.intentId,
      outcomeId: outcome.outcomeId,
      outputHash: outcome.outputHash,
      chainId: intent.chainId,
      txHash: payment.txHash,
      from: intent.treasury,
      to: intent.executor,
      amount: String(payment.amount),
      asset: intent.policy.asset,
      status: 'VERIFIED',
    };
    const receipt = Object.freeze({ ...receiptCore, receiptId: hashObject(receiptCore) });
    this.settledIntents.add(intent.intentId);
    this.receipts.set(receipt.receiptId, receipt);
    const current = this.reputation.get(intent.executor) ?? { acceptedOutcomes: 0, totalSettled: 0n };
    this.reputation.set(intent.executor, {
      acceptedOutcomes: current.acceptedOutcomes + 1,
      totalSettled: current.totalSettled + BigInt(payment.amount),
    });
    return receipt;
  }

  reconcile(intent, receipt) {
    assert(this.receipts.has(receipt.receiptId), 'receipt unknown');
    assert(receipt.intentId === intent.intentId, 'accounting intent mismatch');
    assert(receipt.from === intent.treasury, 'accounting treasury mismatch');
    return Object.freeze({
      intentId: intent.intentId,
      debit: receipt.amount,
      asset: receipt.asset,
      txHash: receipt.txHash,
      reconciled: true,
    });
  }
}

export function exportProofPack({ intent, authorization, execution, outcome, receipt, accounting }) {
  const pack = {
    protocol: 'ZORYQ_OBEP',
    version: OBEP_VERSION,
    intent,
    authorization,
    execution: { ...execution, output: execution.output },
    outcome,
    receipt,
    accounting,
  };
  return Object.freeze({ ...pack, proofPackHash: hashObject(pack) });
}

export function verifyProofPack(pack) {
  assert(pack.protocol === 'ZORYQ_OBEP', 'wrong protocol');
  assert(pack.version === OBEP_VERSION, 'unsupported version');
  const { proofPackHash, ...unsignedPack } = pack;
  assert(hashObject(unsignedPack) === proofPackHash, 'proof pack tampered');
  const { intent, authorization, execution, outcome, receipt, accounting } = pack;
  const intentCore = { ...intent };
  delete intentCore.intentId;
  assert(hashObject(intentCore) === intent.intentId, 'intent tampered');
  assert(authorization.intentId === intent.intentId, 'authorization binding broken');
  assert(execution.intentId === intent.intentId, 'execution binding broken');
  assert(execution.authorizationId === authorization.authorizationId, 'authorization/execution binding broken');
  assert(execution.taskHash === hashObject(intent.task), 'task binding broken');
  assert(execution.outputHash === hashObject(execution.output), 'output binding broken');
  assert(outcome.executionId === execution.executionId, 'outcome binding broken');
  assert(outcome.outputHash === execution.outputHash, 'outcome/output binding broken');
  assert(outcome.accepted === true, 'outcome rejected');
  assert(receipt.intentId === intent.intentId, 'receipt intent binding broken');
  assert(receipt.outcomeId === outcome.outcomeId, 'receipt outcome binding broken');
  assert(receipt.outputHash === outcome.outputHash, 'receipt output binding broken');
  assert(receipt.status === 'VERIFIED', 'receipt not verified');
  assert(accounting.intentId === intent.intentId && accounting.reconciled === true, 'accounting not reconciled');
  return { ok: true, intentId: intent.intentId, proofPackHash };
}
