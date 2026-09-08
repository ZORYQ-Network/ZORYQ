import test from 'node:test';
import assert from 'node:assert/strict';
import { scanProjectRange, PROJECT_SCAN_LIMITS } from './project-rpc-scanner.mjs';

const builder='0x000000000000000000000000000000000000b01d';
const app='0x000000000000000000000000000000000000a001';
const outsider='0x0000000000000000000000000000000000009999';
const u1='0x0000000000000000000000000000000000001111';
const u2='0x0000000000000000000000000000000000002222';
const h=n=>'0x'+n.toString(16).padStart(64,'0');
const manifest={version:'1.0.0',chainId:5919065,slug:'rpc-app',name:'RPC App',builder:{address:builder},contracts:[{address:app,name:'App',kind:'app',active:true}],links:{},status:'testnet'};

function mockRpc({chainId='0x5a5159',latest='0x3'}={}){
  const calls=[];
  const blocks={
    '0x1':{number:'0x1',timestamp:'0x6553f100',transactions:[{hash:h(1),from:u1,to:app,blockNumber:'0x1'},{hash:h(91),from:u1,to:outsider,blockNumber:'0x1'}]},
    '0x2':{number:'0x2',timestamp:'0x65554280',transactions:[{hash:h(2),from:u1,to:app,blockNumber:'0x2'},{hash:h(3),from:u2,to:app,blockNumber:'0x2'}]},
    '0x3':{number:'0x3',timestamp:'0x65569400',transactions:[{hash:h(4),from:builder,to:app,blockNumber:'0x3'}]}
  };
  const receipts=new Map([[h(1),{transactionHash:h(1),status:'0x1',blockNumber:'0x1'}],[h(2),{transactionHash:h(2),status:'0x1',blockNumber:'0x2'}],[h(3),{transactionHash:h(3),status:'0x0',blockNumber:'0x2'}],[h(4),{transactionHash:h(4),status:'0x1',blockNumber:'0x3'}]]);
  async function rpc(method,params=[]){
    calls.push({method,params});
    if(method==='eth_chainId')return chainId;
    if(method==='eth_blockNumber')return latest;
    if(method==='eth_getBlockByNumber')return blocks[params[0]]||null;
    if(method==='eth_getTransactionReceipt')return receipts.get(params[0])||null;
    throw new Error('unexpected_rpc_method:'+method);
  }
  return {rpc,calls};
}

test('scans only declared-contract transactions and derives live-indexed metrics',async()=>{
  const {rpc,calls}=mockRpc();
  const out=await scanProjectRange({manifest,rpc,fromBlock:1,toBlock:3});
  assert.equal(out.status,'live-indexed');
  assert.equal(out.scan.blocksScanned,3);
  assert.equal(out.scan.matchingTransactions,4);
  assert.equal(out.scan.receiptReads,4);
  assert.equal(out.metrics.uniqueExternalWallets,1);
  assert.equal(out.metrics.returningWallets,1);
  assert.equal(out.metrics.successfulInteractions,2);
  assert.equal(out.metrics.failedInteractions,1);
  assert.equal(out.evidence.countedTransactions.includes(h(4)),false,'builder activity excluded from score evidence');
  assert.equal(calls.some(c=>c.method==='eth_getTransactionReceipt'&&c.params[0]===h(91)),false,'unrelated tx receipt is never fetched');
});

test('rejects wrong RPC chain before block scanning',async()=>{
  const {rpc,calls}=mockRpc({chainId:'0x1'});
  await assert.rejects(()=>scanProjectRange({manifest,rpc,fromBlock:1,toBlock:1}),/rpc_chain_mismatch/);
  assert.equal(calls.some(c=>c.method==='eth_getBlockByNumber'),false);
});

test('enforces safe latest when confirmations are requested',async()=>{
  const {rpc}=mockRpc({latest:'0x3'});
  await assert.rejects(()=>scanProjectRange({manifest,rpc,fromBlock:2,toBlock:3,confirmations:1}),/range_exceeds_safe_latest/);
  const out=await scanProjectRange({manifest,rpc,fromBlock:1,toBlock:2,confirmations:1});
  assert.equal(out.scan.safeLatestBlock,2);
});

test('enforces absolute block bounds',async()=>{
  const {rpc}=mockRpc({latest:'0x1000'});
  await assert.rejects(()=>scanProjectRange({manifest,rpc,fromBlock:0,toBlock:PROJECT_SCAN_LIMITS.maxBlocks}),/block_range_too_large/);
});

test('rejects invalid contract manifests before querying chain',async()=>{
  const {rpc,calls}=mockRpc();
  const bad={...manifest,contracts:[{address:'not-an-address',name:'Bad',kind:'app',active:true}]};
  await assert.rejects(()=>scanProjectRange({manifest:bad,rpc,fromBlock:1,toBlock:1}),/invalid_manifest_contract/);
  assert.equal(calls.length,0);
});
