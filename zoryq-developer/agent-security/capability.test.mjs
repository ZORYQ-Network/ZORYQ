import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeExecution, canonicalPermission, createCapabilityState, permissionHash, revokePermission } from './capability.mjs';

const OWNER='0x1111111111111111111111111111111111111111';
const AGENT='0x2222222222222222222222222222222222222222';
const TARGET='0x3333333333333333333333333333333333333333';
const ASSET='0x4444444444444444444444444444444444444444';
const OTHER='0x5555555555555555555555555555555555555555';
const NOW=1_800_000_000_000;

function permission(overrides={}) {
  return {
    chainId:5919065, owner:OWNER, agent:AGENT,
    targets:[TARGET], methods:['0xabcdef01'], assets:[ASSET],
    maxPerAction:'100', cumulativeBudget:'250', maxActions:3,
    windowStart:NOW-1000, windowEnd:NOW+60_000, minIntervalMs:1000,
    maxSlippageBps:50, sponsorshipQuota:'30', nonce:'perm-1',
    ...overrides,
  };
}
function request(overrides={}) {
  return {
    chainId:5919065, agent:AGENT, target:TARGET, method:'0xabcdef01', asset:ASSET,
    amount:'80', slippageBps:25, sponsorshipCost:'10', executionId:'exec-1',
    simulationHash:'0xaaa', executionSimulationHash:'0xaaa', ...overrides,
  };
}
function deny(code, p=permission(), r=request(), state=createCapabilityState(), now=NOW) {
  const out=authorizeExecution({permission:p,request:r,state,now});
  assert.equal(out.ok,false); assert.equal(out.code,code); return out;
}

test('permission hash is deterministic under input ordering',()=>{
  const a=permission({targets:[TARGET,OTHER],methods:['0xabcdef01','0x12345678'],assets:[ASSET,OTHER]});
  const b=permission({targets:[OTHER,TARGET],methods:['0x12345678','0xabcdef01'],assets:[OTHER,ASSET]});
  assert.equal(permissionHash(a),permissionHash(b));
});

test('valid scoped execution emits verifiable receipt',()=>{
  const state=createCapabilityState();
  const out=authorizeExecution({permission:permission(),request:request(),state,now:NOW});
  assert.equal(out.ok,true); assert.match(out.permissionHash,/^0x[0-9a-f]{64}$/);
  assert.equal(out.receipt.executionId,'exec-1'); assert.equal(out.receipt.cumulativeSpent,'80');
});

test('rejects target outside allowlist',()=>deny('target_not_allowed',permission(),request({target:OTHER})));
test('rejects method outside allowlist',()=>deny('method_not_allowed',permission(),request({method:'0xdeadbeef'})));
test('rejects asset outside allowlist',()=>deny('asset_not_allowed',permission(),request({asset:OTHER})));
test('rejects per-action budget overflow',()=>deny('per_action_budget_exceeded',permission(),request({amount:'101'})));
test('rejects expired permission',()=>deny('permission_expired',permission({windowEnd:NOW-1}),request()));
test('rejects slippage outside guard',()=>deny('slippage_exceeded',permission(),request({slippageBps:51})));
test('rejects simulation mismatch',()=>deny('simulation_mismatch',permission(),request({executionSimulationHash:'0xbbb'})));

test('rejects replay of execution id',()=>{
  const state=createCapabilityState(); const p=permission();
  assert.equal(authorizeExecution({permission:p,request:request(),state,now:NOW}).ok,true);
  deny('replay_detected',p,request(),state,NOW+1000);
});

test('rejects revoked permission',()=>{
  const state=createCapabilityState(); const p=permission(); revokePermission(state,p);
  deny('permission_revoked',p,request(),state,NOW);
});

test('rejects cumulative budget overflow',()=>{
  const state=createCapabilityState(); const p=permission({minIntervalMs:0});
  assert.equal(authorizeExecution({permission:p,request:request({amount:'100',executionId:'a'}),state,now:NOW}).ok,true);
  assert.equal(authorizeExecution({permission:p,request:request({amount:'100',executionId:'b'}),state,now:NOW+1}).ok,true);
  deny('cumulative_budget_exceeded',p,request({amount:'60',executionId:'c'}),state,NOW+2);
});

test('rejects action rate limit',()=>{
  const state=createCapabilityState(); const p=permission({minIntervalMs:5000});
  assert.equal(authorizeExecution({permission:p,request:request({executionId:'a'}),state,now:NOW}).ok,true);
  deny('rate_limit_exceeded',p,request({executionId:'b'}),state,NOW+1000);
});

test('rejects max action count',()=>{
  const state=createCapabilityState(); const p=permission({maxActions:1,minIntervalMs:0});
  assert.equal(authorizeExecution({permission:p,request:request({executionId:'a'}),state,now:NOW}).ok,true);
  deny('rate_limit_exceeded',p,request({executionId:'b'}),state,NOW+1);
});

test('rejects sponsorship quota abuse',()=>{
  const state=createCapabilityState(); const p=permission({minIntervalMs:0});
  assert.equal(authorizeExecution({permission:p,request:request({sponsorshipCost:'20',executionId:'a'}),state,now:NOW}).ok,true);
  deny('sponsorship_quota_exceeded',p,request({sponsorshipCost:'11',executionId:'b'}),state,NOW+1);
});

test('canonical permission enforces basic invariants',()=>{
  assert.throws(()=>canonicalPermission(permission({maxActions:0})),/invalid_max_actions/);
  assert.throws(()=>canonicalPermission(permission({windowEnd:NOW-2000})),/invalid_window/);
  assert.throws(()=>canonicalPermission(permission({maxSlippageBps:10001})),/invalid_slippage/);
});
