import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBuilderReputation } from './project-intelligence.mjs';

test('empty evidence produces zero score', () => {
  const r = computeBuilderReputation({});
  assert.equal(r.score, 0);
});

test('score is bounded and deterministic', () => {
  const metrics = {
    uniqueExternalWallets: 100000,
    returningWallets: 100000,
    successfulInteractions: 1000000,
    attemptedInteractions: 1000000,
    activeDays: 365,
    verifiedPrimitiveIntegrations: ['dex', 'stake', 'lending']
  };
  const a = computeBuilderReputation(metrics);
  const b = computeBuilderReputation(metrics);
  assert.deepEqual(a, b);
  assert.equal(a.score, 100);
});

test('failed interactions reduce quality and reliability', () => {
  const clean = computeBuilderReputation({
    uniqueExternalWallets: 50,
    returningWallets: 20,
    successfulInteractions: 200,
    attemptedInteractions: 200,
    activeDays: 30
  });
  const noisy = computeBuilderReputation({
    uniqueExternalWallets: 50,
    returningWallets: 20,
    successfulInteractions: 200,
    attemptedInteractions: 400,
    activeDays: 30
  });
  assert.ok(clean.score > noisy.score);
});

test('duplicate or unknown primitive labels do not inflate ecosystem score', () => {
  const r = computeBuilderReputation({
    uniqueExternalWallets: 10,
    returningWallets: 1,
    successfulInteractions: 20,
    attemptedInteractions: 20,
    activeDays: 5,
    verifiedPrimitiveIntegrations: ['dex', 'dex', 'stake', 'twitter', 'unknown']
  });
  assert.equal(r.components.ecosystemIntegration, 10);
});

test('integrity flags cannot increase score', () => {
  const base = {
    uniqueExternalWallets: 30,
    returningWallets: 10,
    successfulInteractions: 100,
    attemptedInteractions: 100,
    activeDays: 30
  };
  const clean = computeBuilderReputation(base);
  const flagged = computeBuilderReputation({...base, integrityFlags: [{severity: 'critical'}]});
  assert.ok(flagged.components.reliability < clean.components.reliability);
  assert.ok(flagged.score < clean.score);
});

test('returning wallets are capped by unique external wallets', () => {
  const r = computeBuilderReputation({
    uniqueExternalWallets: 4,
    returningWallets: 400,
    successfulInteractions: 20,
    attemptedInteractions: 20,
    activeDays: 30
  });
  assert.equal(r.evidence.returningWallets, 4);
  assert.equal(r.components.retention, 25);
});
