import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEquivalent, compareExecutions } from './serial-equivalence-oracle.mjs';

const base={receipts:[{status:'0x1',gasUsed:'0x5208',logs:[]}],postState:{alice:'9',bob:'1'}};

test('equivalent executions pass',()=>{assert.equal(assertEquivalent(base,structuredClone(base)).equal,true)});
test('state divergence fails',()=>{const c=structuredClone(base);c.postState.bob='2';assert.equal(compareExecutions(base,c).equal,false);assert.throws(()=>assertEquivalent(base,c),/serial_equivalence_failed/)});
test('receipt divergence fails',()=>{const c=structuredClone(base);c.receipts[0].status='0x0';assert.equal(compareExecutions(base,c).equal,false)});
test('object key order does not change digest',()=>{const c={receipts:structuredClone(base.receipts),postState:{bob:'1',alice:'9'}};assert.equal(compareExecutions(base,c).equal,true)});
