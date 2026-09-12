import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntentEnvelope,
  authorizeIntent,
  recordExecution,
  verifyOutcome,
  ObepLedger,
  exportProofPack,
  verifyProofPack,
} from './obep.mjs';

const ADDR = {
  executor: '0x1111111111111111111111111111111111111111',
  verifier: '0x2222222222222222222222222222222222222222',
  treasury: '0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33',
  other: '0x3333333333333333333333333333333333333333',
};

function fixture() {
  const intent = createIntentEnvelope({
    companyId: 'company:test:001',
    goal: 'Produce a verifiable JSON market brief',
    task: { type: 'ANALYSIS', schema: 'market-brief-v1', inputHash: '0xabc' },
    executor: ADDR.executor,
    verifier: ADDR.verifier,
    treasury: ADDR.treasury,
    budget: '1990000',
    chainId: 5919065,
    nonce: '1',
    validFrom: 100,
    validUntil: 1000,
    policy: { maxPayment: '1990000', asset: 'USDC_TEST', capability: 'ANALYSIS' },
  });
  const authorization = authorizeIntent(intent, { authorizer: ADDR.treasury, issuedAt: 110 });
  const execution = recordExecution(intent, authorization, {
    executor: ADDR.executor,
    output: { schema: 'market-brief-v1', result: 'verified fixture', score: 91 },
    startedAt: 120,
    completedAt: 150,
  });
  const outcome = verifyOutcome(intent, execution, {
    verifier: ADDR.verifier,
    accepted: true,
    reason: 'schema and deterministic fixture satisfied',
    verifiedAt: 160,
  });
  return { intent, authorization, execution, outcome };
}

function payment(overrides = {}) {
  return {
    txHash: '0x' + 'ab'.repeat(32),
    from: ADDR.treasury,
    to: ADDR.executor,
    amount: '1990000',
    chainId: 5919065,
    status: 'SUCCESS',
    ...overrides,
  };
}

test('OBEP happy path binds intent -> outcome -> settlement -> accounting -> proof pack', () => {
  const { intent, authorization, execution, outcome } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  const receipt = ledger.settle(intent, authorization, execution, outcome, payment());
  const accounting = ledger.reconcile(intent, receipt);
  const pack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });
  const verification = verifyProofPack(pack);
  assert.equal(verification.ok, true);
  assert.equal(receipt.intentId, intent.intentId);
  assert.equal(receipt.outcomeId, outcome.outcomeId);
  assert.equal(receipt.outputHash, execution.outputHash);
  assert.equal(accounting.reconciled, true);
  assert.deepEqual(ledger.reputation.get(ADDR.executor), { acceptedOutcomes: 1, totalSettled: 1990000n });
});

test('deterministic intentId is stable across object key ordering', () => {
  const a = fixture().intent;
  const b = createIntentEnvelope({
    nonce: '1', chainId: 5919065, budget: '1990000', treasury: ADDR.treasury,
    verifier: ADDR.verifier, executor: ADDR.executor,
    task: { inputHash: '0xabc', schema: 'market-brief-v1', type: 'ANALYSIS' },
    goal: 'Produce a verifiable JSON market brief', companyId: 'company:test:001',
    validUntil: 1000, validFrom: 100,
    policy: { capability: 'ANALYSIS', asset: 'USDC_TEST', maxPayment: '1990000' },
  });
  assert.equal(a.intentId, b.intentId);
});

test('rejects replayed nonce', () => {
  const { intent } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  assert.throws(() => ledger.register(intent), /replayed intent nonce/);
});

test('rejects wrong executor', () => {
  const { intent, authorization } = fixture();
  assert.throws(() => recordExecution(intent, authorization, {
    executor: ADDR.other,
    output: { ok: true },
    startedAt: 120,
    completedAt: 150,
  }), /wrong executor/);
});

test('rejects revoked authorization', () => {
  const { intent } = fixture();
  const revoked = authorizeIntent(intent, { authorizer: ADDR.treasury, issuedAt: 110, revoked: true });
  assert.throws(() => recordExecution(intent, revoked, {
    executor: ADDR.executor,
    output: { ok: true },
    startedAt: 120,
    completedAt: 150,
  }), /authorization revoked/);
});

test('blocks payment without accepted outcome', () => {
  const { intent, authorization, execution } = fixture();
  const rejected = verifyOutcome(intent, execution, {
    verifier: ADDR.verifier,
    accepted: false,
    reason: 'fixture rejected',
    verifiedAt: 160,
  });
  const ledger = new ObepLedger();
  ledger.register(intent);
  assert.throws(() => ledger.settle(intent, authorization, execution, rejected, payment()), /outcome not accepted/);
});

test('rejects wrong verifier', () => {
  const { intent, execution } = fixture();
  assert.throws(() => verifyOutcome(intent, execution, {
    verifier: ADDR.other,
    accepted: true,
    verifiedAt: 160,
  }), /wrong verifier/);
});

test('rejects wrong treasury, recipient, chain and amount', () => {
  for (const [overrides, pattern] of [
    [{ from: ADDR.other }, /wrong treasury/],
    [{ to: ADDR.other }, /wrong payment recipient/],
    [{ chainId: 1 }, /wrong payment chain/],
    [{ amount: '1989999' }, /payment amount mismatch/],
  ]) {
    const { intent, authorization, execution, outcome } = fixture();
    const ledger = new ObepLedger();
    ledger.register(intent);
    assert.throws(() => ledger.settle(intent, authorization, execution, outcome, payment(overrides)), pattern);
  }
});

test('rejects failed receipt', () => {
  const { intent, authorization, execution, outcome } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  assert.throws(() => ledger.settle(intent, authorization, execution, outcome, payment({ status: 'REVERTED' })), /receipt not successful/);
});

test('rejects duplicate settlement', () => {
  const { intent, authorization, execution, outcome } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  ledger.settle(intent, authorization, execution, outcome, payment());
  assert.throws(() => ledger.settle(intent, authorization, execution, outcome, payment({ txHash: '0x' + 'cd'.repeat(32) })), /duplicate settlement/);
});

test('proof pack verifier detects substituted output', () => {
  const { intent, authorization, execution, outcome } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  const receipt = ledger.settle(intent, authorization, execution, outcome, payment());
  const accounting = ledger.reconcile(intent, receipt);
  const pack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });
  const tampered = structuredClone(pack);
  tampered.execution.output.result = 'substituted';
  assert.throws(() => verifyProofPack(tampered), /proof pack tampered|output binding broken/);
});

test('proof pack verifier detects accounting mismatch', () => {
  const { intent, authorization, execution, outcome } = fixture();
  const ledger = new ObepLedger();
  ledger.register(intent);
  const receipt = ledger.settle(intent, authorization, execution, outcome, payment());
  const accounting = ledger.reconcile(intent, receipt);
  const pack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });
  const tampered = structuredClone(pack);
  tampered.accounting.reconciled = false;
  assert.throws(() => verifyProofPack(tampered), /proof pack tampered|accounting not reconciled/);
});
