import fs from 'node:fs';
import { Contract, decodeBytes32String, formatUnits, keccak256, toUtf8Bytes } from 'ethers';

const CHAIN_ID = 5919065;
const STATE_FILE = process.env.ZORYQ_AUTONOMOUS_COMPANY_V3_STATE || '/data/zoryq-autonomous-company-v3.json';
const OPENAI_API_KEY = String(process.env.OPENAI_API_KEY || '').trim();
const AI_MODEL = String(process.env.ZORYQ_AI_MODEL || 'gpt-5.6-terra').trim();
const AI_API_URL = String(process.env.ZORYQ_AI_API_URL || 'https://api.openai.com/v1/responses').trim();
const USD6 = 1_000_000n;
const ALL_ROLES = ['AI_CEO','AI_MARKETING','AI_DESIGNER','AI_RESEARCH','AI_SALES','AI_FINANCE','AI_DEVELOPER'];
const EXECUTOR_ROLES = ['AI_DESIGNER','AI_RESEARCH','AI_DEVELOPER'];
const VERIFIER_ROLES = ['AI_RESEARCH','AI_FINANCE'];
const POLICY_PROVIDER = 'zoryq-deterministic-policy-v1';

const COMPANY_ABI = [
  'function companySnapshot(uint256 companyId) view returns(string name,string objective,address owner,address treasury,address token,uint256 treasuryBalance,uint256 initialBudget,uint256 revenue,uint256 expenses,uint256 profitAfterOperatingCosts,uint32 cycleCount,uint32 aiApprovedCycles,uint256 teamSize,bytes32 constitutionHash,bool active,bool emergencyStopEnabled,uint32 humanInterventions)',
  'function companyAgentIds(uint256 companyId) view returns(uint256[])',
  'function agents(uint256) view returns(uint256 id,uint256 companyId,address vault,bytes32 role,uint32 permissions,uint32 reputationBps,uint32 jobsCompleted,uint256 perCycleLimit,uint256 earned,bool active)',
  'function MAX_AI_REVENUE_PER_CYCLE() view returns(uint256)',
  'function MAX_AI_OPERATING_COST_PER_CYCLE() view returns(uint256)'
];

function readJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function roleText(role) { try { return decodeBytes32String(role); } catch { return String(role); } }
function usdNumber(value) { return Number(formatUnits(value, 6)); }
function safeText(value, max) { return String(value || '').trim().slice(0, max); }
function assert(condition, message) { if (!condition) { const e = new Error(message); e.code = 'AI_PLAN_POLICY'; throw e; } }

export function aiCeoStatus() {
  const state = readJson(STATE_FILE);
  const companyReady = state?.schema === 3 && !!state.contractAddress && !!state.canonicalCompanyId;
  const llmConfigured = OPENAI_API_KEY.length > 20;
  return {
    ok: true,
    provider: llmConfigured ? 'openai-responses' : POLICY_PROVIDER,
    configured: companyReady,
    planningAvailable: companyReady,
    llmConfigured,
    planningMode: llmConfigured ? 'llm-with-onchain-policy' : 'deterministic-policy-fallback',
    model: llmConfigured ? AI_MODEL : null,
    chainId: CHAIN_ID,
    contractAddress: state?.schema === 3 ? state.contractAddress || null : null,
    canonicalCompanyId: state?.schema === 3 ? state.canonicalCompanyId || null : null,
    safety: 'Planner proposes; owner wallet approves; contract revalidates role, spend, verifier separation and replay rules onchain',
    syntheticEconomy: true,
    note: llmConfigured
      ? 'LLM planning is enabled and remains bounded by onchain policy.'
      : 'No external LLM secret is configured. Testnet uses a deterministic policy planner so bounded planning remains testable without weakening custody or contract rules.'
  };
}

export async function loadAiCompanyContext(provider, companyIdInput) {
  const state = readJson(STATE_FILE);
  if (!state?.contractAddress || state.schema !== 3) {
    const e = new Error('autonomous_company_v3_not_deployed'); e.code = 'AI_NOT_READY'; throw e;
  }
  const companyId = BigInt(companyIdInput || state.canonicalCompanyId || 0);
  if (companyId <= 0n) { const e = new Error('invalid_company_id'); e.code = 'AI_BAD_INPUT'; throw e; }
  const contract = new Contract(state.contractAddress, COMPANY_ABI, provider);
  const [s, ids, maxRevenue, maxCost] = await Promise.all([
    contract.companySnapshot(companyId),
    contract.companyAgentIds(companyId),
    contract.MAX_AI_REVENUE_PER_CYCLE(),
    contract.MAX_AI_OPERATING_COST_PER_CYCLE()
  ]);
  if (!s.owner || /^0x0{40}$/i.test(s.owner)) { const e = new Error('company_not_found'); e.code = 'AI_BAD_INPUT'; throw e; }
  const agents = [];
  for (const id of ids) {
    const a = await contract.agents(id);
    agents.push({
      id: Number(a.id),
      role: roleText(a.role),
      permissions: Number(a.permissions),
      reputationBps: Number(a.reputationBps),
      jobsCompleted: Number(a.jobsCompleted),
      perCycleLimitUsd: usdNumber(a.perCycleLimit),
      earnedUsd: usdNumber(a.earned),
      active: Boolean(a.active)
    });
  }
  return {
    contractAddress: state.contractAddress,
    companyId: Number(companyId),
    name: s.name,
    objective: s.objective,
    owner: s.owner,
    treasury: s.treasury,
    treasuryBalanceUsd: usdNumber(s.treasuryBalance),
    initialBudgetUsd: usdNumber(s.initialBudget),
    revenueUsd: usdNumber(s.revenue),
    expensesUsd: usdNumber(s.expenses),
    cycleCount: Number(s.cycleCount),
    aiApprovedCycles: Number(s.aiApprovedCycles),
    active: Boolean(s.active),
    constitutionHash: s.constitutionHash,
    maxSyntheticRevenuePerCycleUsd: usdNumber(maxRevenue),
    maxOperatingCostPerCycleUsd: usdNumber(maxCost),
    agents
  };
}

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    strategy: { type: 'string' },
    leadRole: { type: 'string', enum: EXECUTOR_ROLES },
    verifierRole: { type: 'string', enum: VERIFIER_ROLES },
    expectedRevenueUsd: { type: 'integer', minimum: 1, maximum: 100 },
    payments: {
      type: 'array', minItems: 1, maxItems: 7,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          role: { type: 'string', enum: ALL_ROLES },
          amountUsd: { type: 'integer', minimum: 1, maximum: 15 }
        },
        required: ['role','amountUsd']
      }
    },
    tasks: {
      type: 'array', minItems: 2, maxItems: 7,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          role: { type: 'string', enum: ALL_ROLES },
          action: { type: 'string' },
          evidence: { type: 'string' }
        },
        required: ['role','action','evidence']
      }
    },
    riskNotes: { type: 'string' }
  },
  required: ['strategy','leadRole','verifierRole','expectedRevenueUsd','payments','tasks','riskNotes']
};

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text;
  for (const item of data?.output || []) {
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') return part.text;
    }
  }
  throw new Error('ai_response_missing_output_text');
}

export function normalizeAndValidatePlan(raw, context) {
  assert(raw && typeof raw === 'object', 'AI plan must be an object');
  const strategy = safeText(raw.strategy, 1200);
  const leadRole = safeText(raw.leadRole, 40);
  const verifierRole = safeText(raw.verifierRole, 40);
  const expectedRevenueUsd = Number(raw.expectedRevenueUsd);
  assert(strategy.length >= 10, 'strategy too short');
  assert(EXECUTOR_ROLES.includes(leadRole), 'lead role is not executable');
  assert(VERIFIER_ROLES.includes(verifierRole), 'verifier role is invalid');
  assert(leadRole !== verifierRole, 'lead and verifier must be different');
  assert(Number.isInteger(expectedRevenueUsd) && expectedRevenueUsd > 0 && expectedRevenueUsd <= context.maxSyntheticRevenuePerCycleUsd, 'revenue exceeds onchain bound');

  const byRole = new Map(context.agents.filter(a => a.active).map(a => [a.role, a]));
  const lead = byRole.get(leadRole);
  const verifier = byRole.get(verifierRole);
  assert(lead && (lead.permissions & 16) !== 0, 'selected lead lacks execute permission');
  assert(verifier && (verifier.permissions & 32) !== 0, 'selected verifier lacks verify permission');

  const seen = new Set();
  const payments = [];
  let totalCostUsd = 0;
  for (const p of Array.isArray(raw.payments) ? raw.payments : []) {
    const role = safeText(p?.role, 40);
    const amountUsd = Number(p?.amountUsd);
    const agent = byRole.get(role);
    assert(agent, `inactive or unknown payment role: ${role}`);
    assert(!seen.has(role), `duplicate payment role: ${role}`);
    assert(Number.isInteger(amountUsd) && amountUsd > 0 && amountUsd <= agent.perCycleLimitUsd, `payment exceeds ${role} limit`);
    seen.add(role);
    totalCostUsd += amountUsd;
    payments.push({ role, agentId: agent.id, amountUsd });
  }
  assert(payments.length > 0 && payments.length <= 7, 'invalid payment count');
  assert(seen.has(leadRole), 'lead role must receive a payment');
  assert(totalCostUsd <= context.maxOperatingCostPerCycleUsd, 'total cost exceeds onchain cycle bound');
  assert(expectedRevenueUsd >= totalCostUsd, 'plan must not create a negative synthetic margin');
  assert(context.treasuryBalanceUsd >= totalCostUsd, 'treasury cannot fund plan');

  const tasks = (Array.isArray(raw.tasks) ? raw.tasks : []).slice(0, 7).map(t => {
    const role = safeText(t?.role, 40);
    assert(byRole.has(role), `task role unavailable: ${role}`);
    const action = safeText(t?.action, 500);
    const evidence = safeText(t?.evidence, 500);
    assert(action.length >= 3 && evidence.length >= 3, 'task action/evidence too short');
    return { role, action, evidence };
  });
  assert(tasks.length >= 2, 'AI CEO must decompose the mission into at least two tasks');

  return {
    strategy,
    leadRole,
    leadAgentId: lead.id,
    verifierRole,
    verifierAgentId: verifier.id,
    expectedRevenueUsd,
    totalCostUsd,
    payments,
    tasks,
    riskNotes: safeText(raw.riskNotes, 800)
  };
}

function requestDeterministicPolicyPlan(context, directive) {
  const active = context.agents.filter(a => a.active);
  const lead = ['AI_DEVELOPER','AI_DESIGNER','AI_RESEARCH']
    .map(role => active.find(a => a.role === role && (a.permissions & 16) !== 0))
    .find(Boolean);
  const verifier = ['AI_FINANCE','AI_RESEARCH']
    .map(role => active.find(a => a.role === role && a.role !== lead?.role && (a.permissions & 32) !== 0))
    .find(Boolean);
  assert(lead, 'no active executor satisfies policy');
  assert(verifier, 'no independent active verifier satisfies policy');
  const paymentCap = Math.floor(Math.min(
    3,
    Number(lead.perCycleLimitUsd),
    Number(context.maxOperatingCostPerCycleUsd),
    Number(context.treasuryBalanceUsd),
    Number(context.maxSyntheticRevenuePerCycleUsd),
    100
  ));
  assert(Number.isInteger(paymentCap) && paymentCap >= 1, 'policy planner cannot fund a minimum bounded cycle');
  const mission = safeText(directive, 700) || safeText(context.objective, 700) || 'Advance the company objective with one measurable low-risk testnet step.';
  return {
    strategy: `Execute one bounded testnet cycle for this directive: ${mission}`,
    leadRole: lead.role,
    verifierRole: verifier.role,
    expectedRevenueUsd: paymentCap,
    payments: [{ role: lead.role, amountUsd: paymentCap }],
    tasks: [
      {
        role: lead.role,
        action: `Produce one concrete testnet deliverable for: ${mission}`,
        evidence: 'Return an artifact hash, transaction hash, or deterministic result identifier that can be independently checked.'
      },
      {
        role: verifier.role,
        action: 'Independently verify the executor result against the directive, budget and onchain policy before acceptance.',
        evidence: 'Return a verifier verdict linked to the plan hash and execution evidence identifier.'
      }
    ],
    riskNotes: 'Deterministic policy fallback: no external LLM was used. This is synthetic testnet planning only; owner signature and smart-contract validation remain mandatory.'
  };
}

async function requestOpenAiPlan(context, directive) {
  if (OPENAI_API_KEY.length <= 20) return requestDeterministicPolicyPlan(context, directive);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35_000);
  const system = [
    'You are the ZORYQ AI CEO planning engine for a public blockchain testnet.',
    'Create a concrete next-cycle plan from the company objective and current onchain state.',
    'You may only use the seven listed roles and their actual spending limits.',
    'Choose a lead that can execute and a different verifier that can verify.',
    'Payments must be whole synthetic dUSD amounts, unique by role, include the lead, remain under each role limit and under the total cycle-cost limit.',
    'Expected revenue is synthetic testnet accounting only; never describe it as real revenue, a guarantee, profit promise or investment return.',
    'Do not request private keys, seed phrases, hidden credentials or unrestricted custody.',
    'Tasks should be specific, measurable and tied to evidence that could later be verified by adapters.',
    'Return only the structured object required by the schema.'
  ].join(' ');
  const user = JSON.stringify({
    company: context,
    ownerDirective: directive || 'Advance the company objective with the best bounded next-cycle plan.',
    constraintReminder: 'The owner will review and sign. The smart contract will reject any plan outside policy.'
  });
  try {
    const response = await fetch(AI_API_URL, {
      method: 'POST',
      headers: { 'authorization': `Bearer ${OPENAI_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model: AI_MODEL,
        input: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ],
        text: { format: { type: 'json_schema', name: 'zoryq_ai_ceo_plan', strict: true, schema: PLAN_SCHEMA } },
        max_output_tokens: 2400
      }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const e = new Error(`ai_provider_error:${data?.error?.message || response.status}`); e.code = 'AI_PROVIDER'; throw e;
    }
    return JSON.parse(extractOutputText(data));
  } finally {
    clearTimeout(timer);
  }
}

export async function createAiCeoPlan(provider, input = {}) {
  const context = await loadAiCompanyContext(provider, input.companyId);
  if (!context.active) { const e = new Error('company_is_emergency_stopped'); e.code = 'AI_BAD_INPUT'; throw e; }
  const directive = safeText(input.directive, 1000);
  const llmConfigured = OPENAI_API_KEY.length > 20;
  const raw = await requestOpenAiPlan(context, directive);
  const plan = normalizeAndValidatePlan(raw, context);

  const canonical = {
    schema: 'zoryq-ai-ceo-plan/1',
    chainId: CHAIN_ID,
    contractAddress: context.contractAddress,
    companyId: context.companyId,
    nextCycle: context.cycleCount + 1,
    objective: context.objective,
    directive,
    strategy: plan.strategy,
    leadRole: plan.leadRole,
    verifierRole: plan.verifierRole,
    expectedRevenueUsd: plan.expectedRevenueUsd,
    totalCostUsd: plan.totalCostUsd,
    payments: plan.payments.map(({role,amountUsd}) => ({role,amountUsd})),
    tasks: plan.tasks,
    riskNotes: plan.riskNotes
  };
  const planHash = keccak256(toUtf8Bytes(JSON.stringify(canonical)));
  const specHash = keccak256(toUtf8Bytes(JSON.stringify({ objective: context.objective, strategy: plan.strategy, tasks: plan.tasks })));
  const executionEvidenceHash = keccak256(toUtf8Bytes(JSON.stringify({
    kind: 'SYNTHETIC_TESTNET_AI_PLAN_EXECUTION_INTENT_V1',
    chainId: CHAIN_ID,
    contractAddress: context.contractAddress,
    companyId: context.companyId,
    cycle: context.cycleCount + 1,
    planHash,
    leadRole: plan.leadRole,
    verifierRole: plan.verifierRole
  })));

  const paymentAgentIds = plan.payments.map(p => String(p.agentId));
  const paymentAmounts = plan.payments.map(p => String(BigInt(p.amountUsd) * USD6));
  return {
    ok: true,
    provider: llmConfigured ? 'openai-responses' : POLICY_PROVIDER,
    planningMode: llmConfigured ? 'llm-with-onchain-policy' : 'deterministic-policy-fallback',
    model: llmConfigured ? AI_MODEL : null,
    generatedAt: new Date().toISOString(),
    company: context,
    plan,
    onchainApproval: {
      contractAddress: context.contractAddress,
      method: 'runAiApprovedCycle',
      companyId: String(context.companyId),
      input: {
        planHash,
        specHash,
        executionEvidenceHash,
        leadAgentId: String(plan.leadAgentId),
        verifierAgentId: String(plan.verifierAgentId),
        expectedRevenue: String(BigInt(plan.expectedRevenueUsd) * USD6),
        paymentAgentIds,
        paymentAmounts
      }
    },
    disclaimer: llmConfigured
      ? 'AI generated this strategy offchain. The owner must approve it with a wallet transaction. All dUSD revenue/cost values are synthetic public-testnet accounting and have no monetary value.'
      : 'A deterministic bounded policy planner generated this testnet proposal without an external LLM. The owner must approve it with a wallet transaction. All dUSD values are synthetic and have no monetary value.'
  };
}
