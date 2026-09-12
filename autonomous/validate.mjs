import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node autonomous/validate.mjs <company.json>');
  process.exit(2);
}

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exit(1);
};

let data;
try {
  data = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  fail(`invalid JSON: ${error.message}`);
}

const address = /^0x[a-fA-F0-9]{40}$/;
const hash32 = /^0x[a-fA-F0-9]{64}$/;
const decimal = /^[0-9]+(?:\.[0-9]+)?$/;

if (data.version !== '0.1') fail('version must be 0.1');
if (data.chainId !== 5919065) fail('chainId must be ZORYQ testnet 5919065');
if (!data.companyId) fail('companyId is required');
if (!address.test(data.rootController ?? '')) fail('rootController must be an EVM address');
if (!data.goal?.description) fail('goal.description is required');
if (!Array.isArray(data.goal?.successCriteria) || data.goal.successCriteria.length === 0) fail('at least one success criterion is required');
if (!hash32.test(data.goal?.goalHash ?? '')) fail('goalHash must be 32 bytes');

for (const key of ['initial', 'committed', 'spent', 'received']) {
  if (!decimal.test(data.budget?.[key] ?? '')) fail(`budget.${key} must be a non-negative decimal string`);
}

if (!['supervised', 'balanced', 'autonomous'].includes(data.autonomy)) fail('invalid autonomy mode');
if (!data.policy?.policyId) fail('policy.policyId is required');
if (!decimal.test(data.policy?.maxTotalSpend ?? '')) fail('policy.maxTotalSpend must be a decimal string');
if (typeof data.policy?.emergencyStop !== 'boolean') fail('policy.emergencyStop must be boolean');
if (!Array.isArray(data.policy?.permissions)) fail('policy.permissions must be an array');

for (const [index, permission] of data.policy.permissions.entries()) {
  if (!permission.permissionId || !permission.agentId) fail(`permission ${index} requires permissionId and agentId`);
  if (!address.test(permission.target ?? '')) fail(`permission ${index} target must be an EVM address`);
  if (!permission.method) fail(`permission ${index} method is required`);
  if (!decimal.test(permission.maxValue ?? '')) fail(`permission ${index} maxValue must be a decimal string`);
  if (!permission.expiresAt || Number.isNaN(Date.parse(permission.expiresAt))) fail(`permission ${index} expiresAt must be an ISO date-time`);
  if (!permission.nonce || !permission.domain) fail(`permission ${index} requires nonce and replay domain`);
  if (typeof permission.revoked !== 'boolean') fail(`permission ${index} revoked must be boolean`);
}

if (!['draft', 'active', 'paused', 'completed', 'cancelled'].includes(data.status)) fail('invalid company status');

const initial = Number(data.budget.initial);
const committed = Number(data.budget.committed);
const spent = Number(data.budget.spent);
const maxTotal = Number(data.policy.maxTotalSpend);
if (committed > initial) fail('committed budget exceeds initial budget');
if (spent > initial) fail('spent budget exceeds initial budget');
if (maxTotal > initial) fail('policy maxTotalSpend exceeds initial budget');

console.log(`PASS: ${data.companyId} conforms to ZORYQ Autonomous reference invariants`);
console.log('NOTE: structural validation is not proof of onchain execution, payment, revenue, or security.');
