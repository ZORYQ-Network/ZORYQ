import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAndValidatePlan } from './ai-ceo.mjs';

const context = {
  treasuryBalanceUsd: 123,
  maxSyntheticRevenuePerCycleUsd: 100,
  maxOperatingCostPerCycleUsd: 25,
  agents: [
    {id:1,role:'AI_CEO',permissions:131,perCycleLimitUsd:10,active:true},
    {id:2,role:'AI_MARKETING',permissions:10,perCycleLimitUsd:5,active:true},
    {id:3,role:'AI_DESIGNER',permissions:16,perCycleLimitUsd:3,active:true},
    {id:4,role:'AI_RESEARCH',permissions:48,perCycleLimitUsd:2,active:true},
    {id:5,role:'AI_SALES',permissions:10,perCycleLimitUsd:3,active:true},
    {id:6,role:'AI_FINANCE',permissions:36,perCycleLimitUsd:15,active:true},
    {id:7,role:'AI_DEVELOPER',permissions:82,perCycleLimitUsd:5,active:true}
  ]
};

const good = {
  strategy:'Construir um prototipo vendavel, validar a demanda e registrar evidencias do ciclo.',
  leadRole:'AI_DEVELOPER',
  verifierRole:'AI_RESEARCH',
  expectedRevenueUsd:30,
  payments:[
    {role:'AI_DEVELOPER',amountUsd:5},
    {role:'AI_MARKETING',amountUsd:4},
    {role:'AI_SALES',amountUsd:3},
    {role:'AI_FINANCE',amountUsd:2}
  ],
  tasks:[
    {role:'AI_DEVELOPER',action:'Criar o prototipo.',evidence:'Hash do artefato.'},
    {role:'AI_RESEARCH',action:'Verificar os criterios.',evidence:'Relatorio de verificacao.'}
  ],
  riskNotes:'Receita e custos sao sinteticos de testnet.'
};

test('accepts a bounded plan and resolves role ids', () => {
  const plan = normalizeAndValidatePlan(good, context);
  assert.equal(plan.leadAgentId, 7);
  assert.equal(plan.verifierAgentId, 4);
  assert.equal(plan.totalCostUsd, 14);
});

test('rejects per-agent overspend', () => {
  const bad = structuredClone(good);
  bad.payments[0].amountUsd = 6;
  assert.throws(() => normalizeAndValidatePlan(bad, context), /payment exceeds AI_DEVELOPER limit/);
});

test('rejects self verification and duplicate payments', () => {
  const selfVerify = structuredClone(good);
  selfVerify.leadRole = 'AI_RESEARCH';
  selfVerify.verifierRole = 'AI_RESEARCH';
  assert.throws(() => normalizeAndValidatePlan(selfVerify, context), /lead and verifier/);

  const duplicate = structuredClone(good);
  duplicate.payments.push({role:'AI_DEVELOPER',amountUsd:1});
  assert.throws(() => normalizeAndValidatePlan(duplicate, context), /duplicate payment role/);
});
