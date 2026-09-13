import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanyPlan,
  createSimulationIntent,
  evaluateIntent,
  simulateCompany,
  verifyProofPack,
  parseAmount,
  formatAmount
} from '../lib/core.mjs';

const INPUT = {
  goal: 'Ship a verifiable ZORYQ developer demo',
  budget: '10',
  controller: '0x1111111111111111111111111111111111111111',
  autonomy: 'supervised',
  now: '2026-09-13T18:00:00.000Z'
};

test('amount codec is exact for reference precision', () => {
  assert.equal(formatAmount(parseAmount('10')), '10');
  assert.equal(formatAmount(parseAmount('1.250000')), '1.25');
  assert.equal(formatAmount(parseAmount('0.000001')), '0.000001');
  assert.throws(() => parseAmount('1.0000001'), /at most 6 decimal places/);
});

test('goal and budget create a deterministic bounded company', () => {
  const first = createCompanyPlan(INPUT);
  const second = createCompanyPlan(INPUT);
  assert.deepEqual(first, second);
  assert.equal(first.company.chainId, 5919065);
  assert.equal(first.company.budget.initial, '10');
  assert.equal(first.company.budget.committed, '7.5');
  assert.equal(first.executionPlan.agents.length, 4);
  assert.equal(first.executionPlan.tasks.length, 4);
  assert.equal(first.executionPlan.hires.length, 2);
  assert.equal(first.executionPlan.hires[0].settlement, 'not-executed');
  assert.equal(first.company.policy.emergencyStop, false);
});

test('scoped simulation intent is allowed but overspend and wrong domain are denied', () => {
  const bundle = createCompanyPlan(INPUT);
  const planner = bundle.executionPlan.agents[0];
  const intent = createSimulationIntent(bundle.company, planner.agentId);
  const allowed = evaluateIntent(bundle.company, intent, INPUT.now);
  assert.equal(allowed.allowed, true);

  const overspend = evaluateIntent(bundle.company, { ...intent, value: '1' }, INPUT.now);
  assert.equal(overspend.allowed, false);
  assert.match(overspend.reason, /maxValue/);

  const wrongDomain = evaluateIntent(bundle.company, { ...intent, domain: 'other-domain' }, INPUT.now);
  assert.equal(wrongDomain.allowed, false);
  assert.match(wrongDomain.reason, /no matching scoped permission/);
});

test('emergency stop blocks delegated activity', () => {
  const bundle = createCompanyPlan(INPUT);
  const planner = bundle.executionPlan.agents[0];
  const intent = createSimulationIntent(bundle.company, planner.agentId);
  const stopped = structuredClone(bundle.company);
  stopped.policy.emergencyStop = true;
  const decision = evaluateIntent(stopped, intent, INPUT.now);
  assert.equal(decision.allowed, false);
  assert.match(decision.reason, /emergency stop/);
});

test('simulation produces a self-verifying Proof Pack without fake chain receipts', () => {
  const bundle = createCompanyPlan(INPUT);
  const simulation = simulateCompany(bundle, INPUT.now);
  assert.equal(simulation.authorizations.length, 4);
  assert.ok(simulation.authorizations.every((item) => item.decision.allowed));
  assert.equal(simulation.proofPack.receipts.length, 0);
  assert.equal(simulation.proofPack.goalProgress.percent, 0);
  assert.equal(simulation.proofPack.treasury.reconciled, true);
  assert.equal(simulation.proofPack.simulation.noTransactionSubmitted, true);
  const verified = verifyProofPack(simulation.proofPack);
  assert.deepEqual(verified, { valid: true, errors: [] });
});

test('tampering with a Proof Pack is detected', () => {
  const bundle = createCompanyPlan(INPUT);
  const { proofPack } = simulateCompany(bundle, INPUT.now);
  const tampered = structuredClone(proofPack);
  tampered.goalProgress.percent = 100;
  const verification = verifyProofPack(tampered);
  assert.equal(verification.valid, false);
  assert.ok(verification.errors.some((message) => message.includes('evidenceRoot')));
});
