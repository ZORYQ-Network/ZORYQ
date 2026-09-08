import test from 'node:test';
import assert from 'node:assert/strict';
import { indexProjectEvidence } from './project-indexer.mjs';

const builder='0x000000000000000000000000000000000000b01d';
const app='0x000000000000000000000000000000000000a001';
const dex='0x000000000000000000000000000000000000d001';
const u1='0x0000000000000000000000000000000000001111';
const u2='0x0000000000000000000000000000000000002222';
const h=n=>'0x'+n.toString(16).padStart(64,'0');
const manifest={version:'1.0.0',chainId:5919065,slug:'hello-zoryq',name:'Hello ZORYQ',builder:{address:builder},contracts:[{address:app,name:'App',kind:'app',active:true},{address:dex,name:'DEX integration',kind:'dex',active:true}],links:{},status:'testnet'};

function evidence(){
  const day=1_700_000_000;
  return {
    manifest,
    transactions:[
      {hash:h(1),from:u1,to:app,blockNumber:'0x1'},
      {hash:h(2),from:u1,to:app,blockNumber:'0x2'},
      {hash:h(3),from:u2,to:dex,blockNumber:'0x2'},
      {hash:h(4),from:builder,to:app,blockNumber:'0x2'},
      {hash:h(5),from:u2,to:app,blockNumber:'0x3'},
      {hash:h(5),from:u2,to:app,blockNumber:'0x3'}
    ],
    receipts:[
      {transactionHash:h(1),status:'0x1',blockNumber:'0x1'},
      {transactionHash:h(2),status:'0x1',blockNumber:'0x2'},
      {transactionHash:h(3),status:'0x1',blockNumber:'0x2'},
      {transactionHash:h(4),status:'0x1',blockNumber:'0x2'},
      {transactionHash:h(5),status:'0x0',blockNumber:'0x3'}
    ],
    blocks:[
      {number:'0x1',timestamp:day},
      {number:'0x2',timestamp:day+86400},
      {number:'0x3',timestamp:day+172800}
    ],
    approvedPrimitives:{dex}
  };
}

test('attributes only successful external project interactions',()=>{
  const out=indexProjectEvidence(evidence());
  assert.equal(out.metrics.uniqueExternalWallets,2);
  assert.equal(out.metrics.returningWallets,1);
  assert.equal(out.metrics.successfulInteractions,3);
  assert.equal(out.metrics.attemptedInteractions,5);
  assert.equal(out.metrics.failedInteractions,1);
  assert.deepEqual(out.metrics.verifiedPrimitiveIntegrations,['dex']);
  assert.equal(out.evidence.countedTransactions.includes(h(4)),false,'builder self-activity excluded');
  assert.equal(out.evidence.uniqueTransactions,5,'duplicate tx ignored');
  assert.ok(out.reputation.score>0&&out.reputation.score<=100);
});

test('is deterministic for same evidence',()=>{
  assert.deepEqual(indexProjectEvidence(evidence()),indexProjectEvidence(evidence()));
});

test('rejects wrong chain and duplicate contract attribution',()=>{
  assert.throws(()=>indexProjectEvidence({...evidence(),manifest:{...manifest,chainId:1}}),/invalid_manifest_chain/);
  const bad={...manifest,contracts:[...manifest.contracts,{address:app,name:'Duplicate',kind:'app',active:true}]};
  assert.throws(()=>indexProjectEvidence({...evidence(),manifest:bad}),/duplicate_manifest_contract/);
});

test('does not count failed or builder-only activity as adoption',()=>{
  const onlyBuilder={...evidence(),transactions:[{hash:h(9),from:builder,to:app,blockNumber:'0x1'}],receipts:[{transactionHash:h(9),status:'0x1',blockNumber:'0x1'}]};
  const out=indexProjectEvidence(onlyBuilder);
  assert.equal(out.metrics.uniqueExternalWallets,0);
  assert.equal(out.metrics.successfulInteractions,0);
});
