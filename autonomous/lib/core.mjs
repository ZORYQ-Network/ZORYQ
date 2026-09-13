import { createHash } from 'node:crypto';

export const ZORYQ_CHAIN_ID = 5919065;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const AUTONOMY_MODES = new Set(['supervised', 'balanced', 'autonomous']);

const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const DECIMAL = /^[0-9]+(?:\.[0-9]+)?$/;
const HASH32 = /^0x[a-fA-F0-9]{64}$/;
const SCALE = 1_000_000n;

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashHex(value) {
  const input = typeof value === 'string' ? value : canonicalize(value);
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}

export function parseAmount(value) {
  const text = String(value ?? '');
  if (!DECIMAL.test(text)) throw new Error(`invalid non-negative decimal amount: ${text}`);
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > 6) throw new Error('reference planner supports at most 6 decimal places');
  return BigInt(whole) * SCALE + BigInt((fraction + '000000').slice(0, 6));
}

export function formatAmount(units) {
  if (typeof units !== 'bigint' || units < 0n) throw new Error('amount units must be a non-negative bigint');
  const whole = units / SCALE;
  const fraction = String(units % SCALE).padStart(6, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

function percentage(amount, basisPoints) {
  return (amount * BigInt(basisPoints)) / 10_000n;
}

function requireAddress(address, name = 'address') {
  if (!ADDRESS.test(address ?? '')) throw new Error(`${name} must be a 20-byte EVM address`);
  return address;
}

function requireDate(value, name = 'date') {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) throw new Error(`${name} must be a valid ISO date-time`);
  return new Date(time);
}

function deriveSuccessCriteria(goal, successCriteria) {
  if (Array.isArray(successCriteria) && successCriteria.length) {
    return successCriteria.map((item) => String(item).trim()).filter(Boolean);
  }
  return [
    `A concrete deliverable exists for: ${goal}`,
    'The deliverable has independent verification evidence.',
    'Budget and authorization evidence reconcile without exceeding policy limits.'
  ];
}

function agent(companyId, suffix, role, capabilities) {
  return {
    agentId: `${companyId}:${suffix}`,
    role,
    capabilities,
    authority: 'bounded',
    status: 'ready'
  };
}

function task(companyId, suffix, title, assignedAgentId, allocation, acceptance) {
  return {
    taskId: `${companyId}:task:${suffix}`,
    title,
    assignedAgentId,
    budgetAllocation: formatAmount(allocation),
    status: 'assigned',
    acceptance,
    evidenceRequired: true
  };
}

/**
 * Deterministic reference planner. It does not call a model and does not claim
 * that the generated work was executed. Its purpose is to prove bounded company
 * creation, delegation, budgeting and evidence envelopes from one input.
 */
export function createCompanyPlan({
  goal,
  budget,
  controller,
  autonomy = 'supervised',
  successCriteria,
  now = new Date().toISOString()
}) {
  const normalizedGoal = String(goal ?? '').trim();
  if (!normalizedGoal) throw new Error('goal is required');
  requireAddress(controller, 'controller');
  if (!AUTONOMY_MODES.has(autonomy)) throw new Error(`invalid autonomy mode: ${autonomy}`);

  const initial = parseAmount(budget);
  if (initial <= 0n) throw new Error('budget must be greater than zero');
  const startedAt = requireDate(now, 'now');
  const criteria = deriveSuccessCriteria(normalizedGoal, successCriteria);
  if (!criteria.length) throw new Error('at least one success criterion is required');

  const identitySeed = { goal: normalizedGoal, budget: formatAmount(initial), controller: controller.toLowerCase(), autonomy, criteria };
  const companyHash = hashHex(identitySeed);
  const companyId = `zoryq-company-${companyHash.slice(2, 14)}`;
  const policyId = `policy-${companyHash.slice(14, 26)}`;
  const expiresAt = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const researchBudget = percentage(initial, 1_000); // 10%
  const buildBudget = percentage(initial, 5_500); // 55%
  const verifyBudget = percentage(initial, 2_000); // 20%
  const accountBudget = initial - researchBudget - buildBudget - verifyBudget; // remainder (15%)
  const committed = buildBudget + verifyBudget;

  const planner = agent(companyId, 'planner', 'Planner', ['decompose-goal', 'coordinate', 'propose-hire']);
  const builder = agent(companyId, 'builder', 'Builder', ['produce-deliverable', 'execute-bounded-task']);
  const verifier = agent(companyId, 'verifier', 'Verifier', ['validate-evidence', 'challenge-output']);
  const accountant = agent(companyId, 'accountant', 'Accountant', ['reconcile-budget', 'assemble-proof-pack']);
  const agents = [planner, builder, verifier, accountant];

  const tasks = [
    task(companyId, 'plan', 'Define constraints, work plan and evidence requirements', planner.agentId, researchBudget, ['Plan maps directly to the declared goal and success criteria.']),
    task(companyId, 'build', 'Produce the goal deliverable', builder.agentId, buildBudget, ['Deliverable evidence is content-addressed and linked to the goal.']),
    task(companyId, 'verify', 'Independently verify the deliverable and evidence', verifier.agentId, verifyBudget, ['Verification is separate from the builder and records pass/fail evidence.']),
    task(companyId, 'account', 'Reconcile budget, authority and Proof Pack', accountant.agentId, accountBudget, ['Treasury totals and evidence root reconcile deterministically.'])
  ];

  const hires = [
    {
      hireId: `${companyId}:hire:builder`,
      taskId: tasks[1].taskId,
      requestedBy: planner.agentId,
      agentId: builder.agentId,
      compensation: formatAmount(buildBudget),
      status: 'accepted',
      settlement: 'not-executed'
    },
    {
      hireId: `${companyId}:hire:verifier`,
      taskId: tasks[2].taskId,
      requestedBy: planner.agentId,
      agentId: verifier.agentId,
      compensation: formatAmount(verifyBudget),
      status: 'accepted',
      settlement: 'not-executed'
    }
  ];

  const simulationPermissions = agents.map((item, index) => ({
    permissionId: `${companyId}:permission:${index + 1}`,
    agentId: item.agentId,
    target: ZERO_ADDRESS,
    method: 'simulate',
    maxValue: '0',
    expiresAt,
    nonce: hashHex(`${companyId}:${item.agentId}:${startedAt.toISOString()}`).slice(2, 18),
    domain: `zoryq-autonomous-simulation:${companyId}`,
    revoked: false
  }));

  const company = {
    version: '0.1',
    companyId,
    chainId: ZORYQ_CHAIN_ID,
    rootController: controller,
    goal: {
      description: normalizedGoal,
      successCriteria: criteria,
      goalHash: hashHex({ description: normalizedGoal, successCriteria: criteria })
    },
    budget: {
      asset: 'ZQ_TESTNET',
      initial: formatAmount(initial),
      committed: formatAmount(committed),
      spent: '0',
      received: '0'
    },
    autonomy,
    policy: {
      policyId,
      maxTotalSpend: formatAmount(initial),
      emergencyStop: false,
      permissions: simulationPermissions
    },
    status: 'active'
  };

  const executionPlan = {
    version: '0.1',
    companyId,
    chainId: ZORYQ_CHAIN_ID,
    generatedAt: startedAt.toISOString(),
    mode: 'reference-plan',
    goalHash: company.goal.goalHash,
    agents,
    tasks,
    hires,
    budgetAllocations: {
      planning: formatAmount(researchBudget),
      build: formatAmount(buildBudget),
      verification: formatAmount(verifyBudget),
      accounting: formatAmount(accountBudget)
    },
    claimBoundary: 'Plan creation is proven; task execution, payment, revenue and outcome success require separate evidence.'
  };

  return { company, executionPlan };
}

export function evaluateIntent(company, intent, now = new Date().toISOString()) {
  if (!company || !intent) return { allowed: false, reason: 'company and intent are required' };
  if (company.policy?.emergencyStop) return { allowed: false, reason: 'emergency stop is active' };
  if (company.status !== 'active') return { allowed: false, reason: `company is not active: ${company.status}` };

  const at = requireDate(now, 'now').getTime();
  let value;
  try {
    value = parseAmount(intent.value ?? '0');
  } catch (error) {
    return { allowed: false, reason: error.message };
  }

  const permission = company.policy?.permissions?.find((item) =>
    item.agentId === intent.agentId &&
    item.target.toLowerCase() === String(intent.target ?? '').toLowerCase() &&
    item.method === intent.method &&
    item.domain === intent.domain &&
    item.nonce === intent.nonce
  );
  if (!permission) return { allowed: false, reason: 'no matching scoped permission' };
  if (permission.revoked) return { allowed: false, reason: 'permission is revoked' };
  if (Date.parse(permission.expiresAt) <= at) return { allowed: false, reason: 'permission is expired' };
  if (value > parseAmount(permission.maxValue)) return { allowed: false, reason: 'intent value exceeds permission maxValue' };

  const spent = parseAmount(company.budget?.spent ?? '0');
  const maxTotal = parseAmount(company.policy?.maxTotalSpend ?? '0');
  if (spent + value > maxTotal) return { allowed: false, reason: 'intent would exceed company maxTotalSpend' };

  return { allowed: true, reason: 'intent is within scoped policy' };
}

export function createSimulationIntent(company, agentId) {
  const permission = company.policy.permissions.find((item) => item.agentId === agentId && item.method === 'simulate' && !item.revoked);
  if (!permission) throw new Error(`no simulation permission for agent ${agentId}`);
  return {
    companyId: company.companyId,
    chainId: company.chainId,
    agentId,
    target: permission.target,
    method: permission.method,
    value: '0',
    domain: permission.domain,
    nonce: permission.nonce,
    mode: 'simulation-only'
  };
}

export function simulateCompany(bundle, now = new Date().toISOString()) {
  const generatedAt = requireDate(now, 'now').toISOString();
  const { company, executionPlan } = bundle;
  const simulationIntents = executionPlan.agents.map((item) => createSimulationIntent(company, item.agentId));
  const authorizations = simulationIntents.map((intent) => ({ intent, decision: evaluateIntent(company, intent, generatedAt) }));
  if (authorizations.some((item) => !item.decision.allowed)) {
    throw new Error(`simulation policy denied an intent: ${authorizations.find((item) => !item.decision.allowed).decision.reason}`);
  }

  const simulatedTasks = executionPlan.tasks.map((item) => ({
    taskId: item.taskId,
    status: 'completed',
    evidenceMode: 'simulation',
    evidence: [hashHex({ companyId: company.companyId, taskId: item.taskId, acceptance: item.acceptance, mode: 'simulation' })]
  }));

  const proofWithoutRoot = {
    version: '0.1',
    companyId: company.companyId,
    chainId: company.chainId,
    generatedAt,
    tasks: simulatedTasks,
    hires: executionPlan.hires.map((item) => ({
      hireId: item.hireId,
      taskId: item.taskId,
      agentId: item.agentId,
      compensation: item.compensation,
      status: item.status,
      settlement: item.settlement
    })),
    receipts: [],
    treasury: {
      asset: company.budget.asset,
      initial: company.budget.initial,
      spent: '0',
      received: '0',
      remaining: company.budget.initial,
      reconciled: true
    },
    goalProgress: {
      percent: 0,
      basis: [
        'Reference workflow completed in simulation mode only.',
        'No verified execution/payment/revenue receipt exists, so outcome progress remains 0%.'
      ]
    },
    simulation: {
      authorizedIntents: authorizations.length,
      allPolicyChecksPassed: true,
      noTransactionSubmitted: true
    }
  };

  const proofPack = { ...proofWithoutRoot, evidenceRoot: hashHex(proofWithoutRoot) };
  return { simulationIntents, authorizations, proofPack };
}

export function verifyProofPack(pack) {
  const errors = [];
  if (pack?.version !== '0.1') errors.push('version must be 0.1');
  if (pack?.chainId !== ZORYQ_CHAIN_ID) errors.push(`chainId must be ${ZORYQ_CHAIN_ID}`);
  if (!pack?.companyId) errors.push('companyId is required');
  if (!Number.isFinite(Date.parse(pack?.generatedAt ?? ''))) errors.push('generatedAt must be an ISO date-time');
  if (!Array.isArray(pack?.tasks)) errors.push('tasks must be an array');
  if (!Array.isArray(pack?.hires)) errors.push('hires must be an array');
  if (!Array.isArray(pack?.receipts)) errors.push('receipts must be an array');
  if (!HASH32.test(pack?.evidenceRoot ?? '')) errors.push('evidenceRoot must be a 32-byte hash');

  for (const [index, receipt] of (pack?.receipts ?? []).entries()) {
    if (!HASH32.test(receipt?.txHash ?? '')) errors.push(`receipt ${index} has invalid txHash`);
    if (!/^[0-9]+$/.test(receipt?.blockNumber ?? '')) errors.push(`receipt ${index} has invalid blockNumber`);
    if (!['success', 'reverted', 'failed'].includes(receipt?.status)) errors.push(`receipt ${index} has invalid status`);
    if (typeof receipt?.verified !== 'boolean') errors.push(`receipt ${index} verified must be boolean`);
    if (receipt?.status !== 'success' && receipt?.verified === true) errors.push(`receipt ${index} cannot be verified true when status is not success`);
  }

  try {
    const initial = parseAmount(pack?.treasury?.initial ?? '');
    const spent = parseAmount(pack?.treasury?.spent ?? '');
    const received = parseAmount(pack?.treasury?.received ?? '');
    const remaining = parseAmount(pack?.treasury?.remaining ?? '');
    if (initial - spent + received !== remaining) errors.push('treasury does not reconcile');
  } catch (error) {
    errors.push(`invalid treasury amount: ${error.message}`);
  }

  const { evidenceRoot, ...body } = pack ?? {};
  if (HASH32.test(evidenceRoot ?? '') && hashHex(body) !== evidenceRoot) errors.push('evidenceRoot does not match canonical proof contents');

  return { valid: errors.length === 0, errors };
}
