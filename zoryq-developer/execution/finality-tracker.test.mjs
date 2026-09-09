import test from 'node:test';
import assert from 'node:assert/strict';
import { FinalityTracker } from './finality-tracker.mjs';

test('accepted before receipt',()=>{assert.equal(new FinalityTracker().classify({receipt:null,currentBlock:10}).stage,'accepted')});
test('included on first block',()=>{assert.equal(new FinalityTracker().classify({receipt:{blockNumber:'0xa'},currentBlock:10}).stage,'included')});
test('confirmed after configured depth',()=>{assert.equal(new FinalityTracker({confirmations:2,finalityDepth:6}).classify({receipt:{blockNumber:'0xa'},currentBlock:11}).stage,'confirmed')});
test('final only after declared finality depth',()=>{assert.equal(new FinalityTracker({confirmations:2,finalityDepth:6}).classify({receipt:{blockNumber:'0xa'},currentBlock:15}).stage,'final')});
test('rejects incoherent finality policy',()=>{assert.throws(()=>new FinalityTracker({confirmations:4,finalityDepth:2}),/invalid_finality_policy/)})
