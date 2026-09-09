import { createHash } from 'node:crypto';

function lowerHex(value, bytes) {
  const v = String(value || '').toLowerCase();
  const re = new RegExp(`^0x[0-9a-f]{${bytes * 2}}$`);
  if (!re.test(v)) throw new Error(`invalid_hex_${bytes}`);
  return v;
}

function uniqSorted(values = []) {
  return [...new Set(values.map(v => String(v).toLowerCase()))].sort();
}

export function canonicalPermission(input) {
  const p = {
    version: 1,
    chainId: Number(input.chainId),
    owner: lowerHex(input.owner, 20),
    agent: lowerHex(input.agent, 20),
    targets: uniqSorted(input.targets).map(v => lowerHex(v, 20)),
    methods: uniqSorted(input.methods),
    assets: uniqSorted(input.assets).map(v => lowerHex(v, 20)),
    maxPerAction: String(BigInt(input.maxPerAction ?? 0)),
    cumulativeBudget: String(BigInt(input.cumulativeBudget ?? 0)),
    maxActions: Number(input.maxActions ?? 0),
    windowStart: Number(input.windowStart ?? 0),
    windowEnd: Number(input.windowEnd ?? 0),
    minIntervalMs: Number(input.minIntervalMs ?? 0),
    maxSlippageBps: Number(input.maxSlippageBps ?? 0),
    sponsorshipQuota: String(BigInt(input.sponsorshipQuota ?? 0)),
    nonce: String(input.nonce ?? ''),
  };
  if (!Number.isInteger(p.chainId) || p.chainId <= 0) throw new Error('invalid_chain_id');
  if (!p.targets.length) throw new Error('targets_required');
  if (!p.methods.length) throw new Error('methods_required');
  if (!p.assets.length) throw new Error('assets_required');
  if (!p.nonce || p.nonce.length > 128) throw new Error('invalid_nonce');
  if (!Number.isFinite(p.windowStart) || !Number.isFinite(p.windowEnd) || p.windowEnd <= p.windowStart) throw new Error('invalid_window');
  if (!Number.isInteger(p.maxActions) || p.maxActions <= 0) throw new Error('invalid_max_actions');
  if (!Number.isInteger(p.maxSlippageBps) || p.maxSlippageBps < 0 || p.maxSlippageBps > 10000) throw new Error('invalid_slippage');
  return p;
}

export function permissionHash(input) {
  const p = canonicalPermission(input);
  return '0x' + createHash('sha256').update(JSON.stringify(p)).digest('hex');
}

export function createCapabilityState() {
  return { revoked: new Set(), usedExecutionIds: new Set(), usage: new Map() };
}

export function revokePermission(state, permission) {
  state.revoked.add(permissionHash(permission));
}

function fail(code, detail = null) { return { ok: false, code, detail }; }

export function authorizeExecution({ permission, request, state, now = Date.now() }) {
  const p = canonicalPermission(permission);
  const hash = permissionHash(p);
  if (state.revoked.has(hash)) return fail('permission_revoked');
  if (Number(request.chainId) !== p.chainId) return fail('wrong_chain');
  if (String(request.agent || '').toLowerCase() !== p.agent) return fail('wrong_agent');
  const target = String(request.target || '').toLowerCase();
  const method = String(request.method || '').toLowerCase();
  const asset = String(request.asset || '').toLowerCase();
  if (!p.targets.includes(target)) return fail('target_not_allowed');
  if (!p.methods.includes(method)) return fail('method_not_allowed');
  if (!p.assets.includes(asset)) return fail('asset_not_allowed');
  if (now < p.windowStart || now > p.windowEnd) return fail('permission_expired');

  const amount = BigInt(request.amount ?? 0);
  if (amount < 0n) return fail('invalid_amount');
  if (amount > BigInt(p.maxPerAction)) return fail('per_action_budget_exceeded');
  const slippage = Number(request.slippageBps ?? 0);
  if (!Number.isInteger(slippage) || slippage < 0 || slippage > p.maxSlippageBps) return fail('slippage_exceeded');

  const executionId = String(request.executionId || '');
  if (!executionId) return fail('execution_id_required');
  if (state.usedExecutionIds.has(executionId)) return fail('replay_detected');

  const usage = state.usage.get(hash) || { spent: 0n, actions: 0, sponsorshipSpent: 0n, lastActionAt: 0 };
  if (usage.actions >= p.maxActions) return fail('rate_limit_exceeded');
  if (p.minIntervalMs > 0 && usage.lastActionAt && now - usage.lastActionAt < p.minIntervalMs) return fail('rate_limit_exceeded');
  if (usage.spent + amount > BigInt(p.cumulativeBudget)) return fail('cumulative_budget_exceeded');

  const sponsorshipCost = BigInt(request.sponsorshipCost ?? 0);
  if (sponsorshipCost < 0n) return fail('invalid_sponsorship_cost');
  if (usage.sponsorshipSpent + sponsorshipCost > BigInt(p.sponsorshipQuota)) return fail('sponsorship_quota_exceeded');

  const simulationHash = String(request.simulationHash || '').toLowerCase();
  const executionSimulationHash = String(request.executionSimulationHash || '').toLowerCase();
  if (!simulationHash || simulationHash !== executionSimulationHash) return fail('simulation_mismatch');

  const next = {
    spent: usage.spent + amount,
    actions: usage.actions + 1,
    sponsorshipSpent: usage.sponsorshipSpent + sponsorshipCost,
    lastActionAt: now,
  };
  state.usage.set(hash, next);
  state.usedExecutionIds.add(executionId);

  return {
    ok: true,
    permissionHash: hash,
    receipt: {
      version: 1,
      permissionHash: hash,
      executionId,
      authorizedAt: now,
      owner: p.owner,
      agent: p.agent,
      target,
      method,
      asset,
      amount: amount.toString(),
      cumulativeSpent: next.spent.toString(),
      actionNumber: next.actions,
      sponsorshipCost: sponsorshipCost.toString(),
      sponsorshipSpent: next.sponsorshipSpent.toString(),
      simulationHash,
      revokedAtAuthorization: false,
    },
  };
}
