import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createIntentEnvelope,
  authorizeIntent,
  recordExecution,
  verifyOutcome,
  ObepLedger,
  exportProofPack,
} from './obep.mjs';
import {
  buildInteropEvidence,
  createErc8004AgentReference,
  createErc8183JobReference,
  createPolicyReference,
  createX402SettlementReference,
  verifyInteropEvidence,
} from './interop-profile.mjs';

const addresses = {
  treasury: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  executor: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  verifier: '0xcccccccccccccccccccccccccccccccccccccccc',
  commerce: '0xdddddddddddddddddddddddddddddddddddddddd',
  identity: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
};

function fixture() {
  const intent = createIntentEnvelope({
    companyId: 'company:interop:001',
    goal: 'Normalize a deterministic dataset summary',
    task: { type: 'DATASET_SUMMARY', inputHash: '0x' + '11'.repeat(32) },
    executor: addresses.executor,
    verifier: addresses.verifier,
    treasury: addresses.treasury,
    budget: '2500000',
    chainId: 5919065,
    nonce: 'interop-1',
    validFrom: 100,
    validUntil: 1000,
    policy: { maxPayment: '2500000', asset: 'USDC_TEST', capability: 'DATASET_SUMMARY' },
  });
  const authorization = authorizeIntent(intent, { authorizer: addresses.treasury, issuedAt: 110 });
  const execution = recordExecution(intent, authorization, {
    executor: addresses.executor,
    output: { count: 3, aggregate: 42, digest: '0x' + '22'.repeat(32) },
    startedAt: 120,
    completedAt: 130,
  });
  const outcome = verifyOutcome(intent, execution, {
    verifier: addresses.verifier,
    accepted: true,
    reason: 'deterministic recomputation matched',
    verifiedAt: 140,
  });
  const ledger = new ObepLedger();
  ledger.register(intent);
  const payment = {
    txHash: '0x' + '33'.repeat(32),
    from: addresses.treasury,
    to: addresses.executor,
    amount: '2500000',
    chainId: 5919065,
    status: 'SUCCESS',
  };
  const receipt = ledger.settle(intent, authorization, execution, outcome, payment);
  const accounting = ledger.reconcile(intent, receipt);
  const proofPack = exportProofPack({ intent, authorization, execution, outcome, receipt, accounting });

  const erc8183 = createErc8183JobReference({
    chainId: 5919065,
    contract: addresses.commerce,
    job: {
      jobId: '42',
      client: addresses.treasury,
      provider: addresses.executor,
      evaluator: addresses.verifier,
      budget: '2500000',
      status: 'Completed',
      deliverable: execution.outputHash,
      descriptionHash: '0x' + '44'.repeat(32),
      paymentToken: '0x9999999999999999999999999999999999999999',
    },
  });

  const executorIdentity = createErc8004AgentReference({
    chainId: 5919065,
    contract: addresses.identity,
    agentId: '7',
    role: 'EXECUTOR',
    address: addresses.executor,
    registryEvidence: { ownerVerified: true },
  });
  const verifierIdentity = createErc8004AgentReference({
    chainId: 5919065,
    contract: addresses.identity,
    agentId: '8',
    role: 'VERIFIER',
    address: addresses.verifier,
    registryEvidence: { ownerVerified: true },
  });
  const policy = createPolicyReference({
    chainId: 5919065,
    wallet: addresses.treasury,
    policyId: 'policy:bounded:1',
    policy: { maxPayment: '2500000', capability: 'DATASET_SUMMARY', revocable: true },
  });
  const paymentTransport = createX402SettlementReference({
    chainId: 5919065,
    paymentId: 'pay:42',
    payer: addresses.treasury,
    payee: addresses.executor,
    amount: '2500000',
    asset: 'USDC_TEST',
    txHash: payment.txHash,
    network: 'eip155:5919065',
  });

  return { proofPack, erc8183, executorIdentity, verifierIdentity, policy, paymentTransport };
}

test('OBEP interop profile binds ERC-8183 + ERC-8004 + wallet policy + x402 evidence', () => {
  const inputs = fixture();
  const evidence = buildInteropEvidence(inputs);
  const verified = verifyInteropEvidence(evidence, inputs);
  assert.equal(verified.ok, true);
  assert.equal(evidence.profile, 'ZORYQ_OBEP_INTEROP');
});

test('rejects ERC-8183 provider that is not the OBEP executor', () => {
  const inputs = fixture();
  const bad = createErc8183JobReference({
    chainId: 5919065,
    contract: addresses.commerce,
    job: { ...inputs.erc8183.snapshot, provider: '0x1212121212121212121212121212121212121212' },
  });
  assert.throws(() => buildInteropEvidence({ ...inputs, erc8183: bad }), /provider \/ OBEP executor mismatch/);
});

test('rejects ERC-8183 evaluator that is not the OBEP verifier', () => {
  const inputs = fixture();
  const bad = createErc8183JobReference({
    chainId: 5919065,
    contract: addresses.commerce,
    job: { ...inputs.erc8183.snapshot, evaluator: '0x1313131313131313131313131313131313131313' },
  });
  assert.throws(() => buildInteropEvidence({ ...inputs, erc8183: bad }), /evaluator \/ OBEP verifier mismatch/);
});

test('rejects substituted ERC-8183 deliverable', () => {
  const inputs = fixture();
  const bad = createErc8183JobReference({
    chainId: 5919065,
    contract: addresses.commerce,
    job: { ...inputs.erc8183.snapshot, deliverable: '0x' + '99'.repeat(32) },
  });
  assert.throws(() => buildInteropEvidence({ ...inputs, erc8183: bad }), /deliverable \/ OBEP output mismatch/);
});

test('rejects settlement amount inconsistent with ERC-8183 budget', () => {
  const inputs = fixture();
  const bad = createErc8183JobReference({
    chainId: 5919065,
    contract: addresses.commerce,
    job: { ...inputs.erc8183.snapshot, budget: '2499999' },
  });
  assert.throws(() => buildInteropEvidence({ ...inputs, erc8183: bad }), /budget \/ OBEP settlement mismatch/);
});

test('rejects x402 payment metadata inconsistent with OBEP settlement', () => {
  const inputs = fixture();
  const badTransport = createX402SettlementReference({
    chainId: 5919065,
    paymentId: 'pay:bad',
    payer: addresses.treasury,
    payee: addresses.executor,
    amount: '1',
    asset: 'USDC_TEST',
    txHash: inputs.proofPack.receipt.txHash,
  });
  assert.throws(() => buildInteropEvidence({ ...inputs, paymentTransport: badTransport }), /payment transport amount mismatch/);
});

test('detects tampering of the normalized interoperability graph', () => {
  const inputs = fixture();
  const evidence = buildInteropEvidence(inputs);
  const tampered = { ...evidence, erc8183: { ...evidence.erc8183, id: '999' } };
  assert.throws(() => verifyInteropEvidence(tampered, inputs), /interop evidence tampered/);
});
