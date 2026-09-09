import test from 'node:test';
import assert from 'node:assert/strict';
import { Wallet } from 'ethers';
import { createCapabilityState } from './capability.mjs';
import { authorizeSignedExecution, permissionSigningMessage, verifyPermissionSignature } from './signed-capability.mjs';

const owner=new Wallet('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a841f4603b6b78690d');
const agent=new Wallet('0x8b3a350cf5c34c9194ca3a545d7a2f6b2049f7f85c243a18ccec5f7f5ee55b2c');
const target='0x1000000000000000000000000000000000000001';
const asset='0x2000000000000000000000000000000000000002';
const now=1_800_000_000_000;
function permission(chainId=5919065){return {chainId,owner:owner.address,agent:agent.address,targets:[target],methods:['0x12345678'],assets:[asset],maxPerAction:'100',cumulativeBudget:'250',maxActions:3,windowStart:now-1000,windowEnd:now+100000,minIntervalMs:0,maxSlippageBps:50,sponsorshipQuota:'1000',nonce:'owner-nonce-1'}}
function request(chainId=5919065){return {chainId,agent:agent.address,target,method:'0x12345678',asset,amount:'10',slippageBps:25,executionId:'exec-1',simulationHash:'0xabc',executionSimulationHash:'0xabc',sponsorshipCost:'1'}}

test('owner signature authorizes chain-bound permission',async()=>{const p=permission();const sig=await owner.signMessage(permissionSigningMessage(p));const r=authorizeSignedExecution({permission:p,signature:sig,request:request(),state:createCapabilityState(),now});assert.equal(r.ok,true);assert.equal(r.signatureVerified,true);assert.equal(r.receipt.signer,owner.address)});
test('signature by non-owner is rejected',async()=>{const p=permission();const sig=await agent.signMessage(permissionSigningMessage(p));assert.equal(verifyPermissionSignature(p,sig).code,'permission_signature_not_owner')});
test('signature cannot be replayed onto another chain domain',async()=>{const p=permission();const sig=await owner.signMessage(permissionSigningMessage(p));const altered={...p,chainId:1};assert.equal(verifyPermissionSignature(altered,sig).ok,false)});
test('expected ZORYQ chain gate rejects foreign-chain permission before execution',async()=>{const p=permission(1);const sig=await owner.signMessage(permissionSigningMessage(p));const r=authorizeSignedExecution({permission:p,signature:sig,request:request(1),state:createCapabilityState(),now,expectedChainId:5919065});assert.equal(r.code,'permission_wrong_domain_chain')});
