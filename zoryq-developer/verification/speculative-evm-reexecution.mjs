#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ContractFactory, HDNodeWallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('../../zoryq-evm-node/node_modules/ethers');
const solc = require('../../zoryq-evm-node/node_modules/solc');

const CHAIN_ID = 5919065;
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const CANDIDATE_RPC = process.env.ZORYQ_SPECULATIVE_RPC || 'http://127.0.0.1:8081/rpc';
const SERIAL_RPC = process.env.ZORYQ_SERIAL_RPC || 'http://127.0.0.1:8082/rpc';
const CANDIDATE_BASE = process.env.ZORYQ_SPECULATIVE_BASE || CANDIDATE_RPC.replace(/\/rpc$/, '');
const SERIAL_BASE = process.env.ZORYQ_SERIAL_BASE || SERIAL_RPC.replace(/\/rpc$/, '');
const CONTAINER = process.env.ZORYQ_SPECULATIVE_CONTAINER || 'zoryq-speculative-candidate';
const OUT = process.env.ZORYQ_SPECULATIVE_EVM_OUT || 'speculative-evm-reexecution.json';
const providerA = new JsonRpcProvider(CANDIDATE_RPC, CHAIN_ID, { staticNetwork:true });
const providerB = new JsonRpcProvider(SERIAL_RPC, CHAIN_ID, { staticNetwork:true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = v => `0x${createHash('sha256').update(v).digest('hex')}`;
const norm = hex => `0x${String(hex || '').replace(/^0x/,'').padStart(64,'0').toLowerCase()}`;
const uniq = xs => [...new Set(xs.map(norm))].sort();

function derive(index, provider) {
  return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function waitReady(base) {
  for (let i=0;i<120;i+=1) {
    try {
      const r=await fetch(`${base}/health`);
      if (r.ok) {
        const j=await r.json();
        if (Number(j?.chain?.chainId ?? j?.chainId)===CHAIN_ID) return j;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error(`node not ready: ${base}`);
}

function internalRpc(method, params) {
  const payload=JSON.stringify({jsonrpc:'2.0',id:1,method,params});
  const program=`const p=process.argv[1];fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:p}).then(async r=>{const t=await r.text();if(!r.ok)throw new Error('http_'+r.status+':'+t);process.stdout.write(t)}).catch(e=>{console.error(e);process.exit(1)})`;
  const raw=execFileSync('docker',['exec',CONTAINER,'node','-e',program,payload],{encoding:'utf8',maxBuffer:32*1024*1024});
  const body=JSON.parse(raw);
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function opcodeAccess(trace) {
  const reads=[], writes=[];
  for (const step of trace?.structLogs || []) {
    if (step.op!=='SLOAD' && step.op!=='SSTORE') continue;
    const stack=Array.isArray(step.stack)?step.stack:[];
    assert(stack.length>0,`${step.op} missing stack evidence`);
    const slot=norm(stack[stack.length-1]);
    if (step.op==='SLOAD') reads.push(slot); else writes.push(slot);
  }
  return {reads:uniq(reads),writes:uniq(writes)};
}

const source=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ZoryqSpeculativeProbe {
  mapping(bytes32=>uint256) public slots;
  event Touched(bytes32 indexed key,uint256 value);
  function set(bytes32 key,uint256 value) external { slots[key]=value; emit Touched(key,value); }
  function increment(bytes32 key) external { slots[key]+=1; emit Touched(key,slots[key]); }
}`;

function compile() {
  const input={language:'Solidity',sources:{'Probe.sol':{content:source}},settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const out=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(out.errors||[]).filter(e=>e.severity==='error');
  assert.equal(errors.length,0,errors.map(e=>e.formattedMessage).join('\n'));
  return out.contracts['Probe.sol'].ZoryqSpeculativeProbe;
}

async function deploySame(artifact) {
  const a=derive(0,providerA), b=derive(0,providerB);
  const fa=new ContractFactory(artifact.abi,`0x${artifact.evm.bytecode.object}`,a);
  const fb=new ContractFactory(artifact.abi,`0x${artifact.evm.bytecode.object}`,b);
  const ca=await fa.deploy(), cb=await fb.deploy();
  await ca.waitForDeployment(); await cb.waitForDeployment();
  assert.equal((await ca.getAddress()).toLowerCase(),(await cb.getAddress()).toLowerCase());
  return {ca,cb};
}

function versionsFor(access, versions) {
  const out={};
  for (const key of access.reads) out[key]=versions.get(key)||0;
  return out;
}

function candidateStillValid(candidate, versions) {
  return Object.entries(candidate.readVersions).every(([key,version]) => (versions.get(key)||0)===version);
}

function bumpWrites(access, versions) {
  for (const key of access.writes) versions.set(key,(versions.get(key)||0)+1);
}

function traceCandidate(item, blockTag, versions) {
  const call={from:item.from,to:item.to,data:item.data,gas:'0x7a120',gasPrice:item.gasPriceHex,value:'0x0'};
  const trace=internalRpc('debug_traceCall',[call,blockTag,{disableMemory:true,disableStorage:true,disableStack:false,enableReturnData:true}]);
  const access=opcodeAccess(trace);
  return {
    txHash:item.hash,
    workload:item.workload,
    blockTag,
    failed:Boolean(trace?.failed),
    gas:Number(trace?.gas||0),
    access,
    readVersions:versionsFor(access,versions),
    traceCommitment:sha256(JSON.stringify({failed:Boolean(trace?.failed),gas:trace?.gas||0,access}))
  };
}

async function main() {
  const [healthA,healthB]=await Promise.all([waitReady(CANDIDATE_BASE),waitReady(SERIAL_BASE)]);
  assert.equal(Number(healthA?.chain?.chainId ?? healthA?.chainId),CHAIN_ID);
  assert.equal(Number(healthB?.chain?.chainId ?? healthB?.chainId),CHAIN_ID);
  const artifact=compile();
  const {ca,cb}=await deploySame(artifact);
  const address=await ca.getAddress();
  const keyHot=keccak256(toUtf8Bytes('hot'));
  const partitionKeys=['p0','p1','p2'].map(x=>keccak256(toUtf8Bytes(x)));
  const walletsA=Array.from({length:7},(_,i)=>derive(i+1,providerA));
  const walletsB=Array.from({length:7},(_,i)=>derive(i+1,providerB));
  for (let i=0;i<walletsA.length;i+=1) assert.equal(walletsA[i].address.toLowerCase(),walletsB[i].address.toLowerCase());
  const gasPrice=(await providerA.getFeeData()).gasPrice || 1_000_000_000n;
  const items=[];
  for (let i=0;i<walletsA.length;i+=1) {
    const w=walletsA[i];
    const nonce=await providerA.getTransactionCount(w.address);
    const isHot=i<4;
    const key=isHot?keyHot:partitionKeys[i-4];
    const fn=isHot?'increment':'set';
    const args=isHot?[key]:[key,1000n+BigInt(i)];
    const data=ca.interface.encodeFunctionData(fn,args);
    const raw=await w.signTransaction({chainId:CHAIN_ID,nonce,to:address,data,gasLimit:500000n,gasPrice,type:0,value:0n});
    const tx=await w.populateTransaction({to:address,data,gasLimit:500000n,gasPrice,type:0,value:0n,nonce,chainId:CHAIN_ID});
    items.push({workload:isHot?'hot-slot-increment':'independent-storage',from:w.address,to:address,nonce,data,raw,hash:keccak256(raw),gasPriceHex:`0x${gasPrice.toString(16)}`,call:tx});
  }

  const parentBlock=await providerA.getBlockNumber();
  const parentTag=`0x${parentBlock.toString(16)}`;
  const versions=new Map();
  const initialCandidates=items.map(item=>traceCandidate(item,parentTag,versions));
  assert(initialCandidates.slice(0,4).every(c=>c.access.reads.length>0 && c.access.writes.length>0),'hot candidates must expose real SLOAD/SSTORE evidence');

  const committed=[];
  let invalidations=0,reexecutions=0;
  for (let i=0;i<items.length;i+=1) {
    const item=items[i];
    let candidate=initialCandidates[i];
    let reexecuted=false;
    if (!candidateStillValid(candidate,versions)) {
      invalidations+=1;
      reexecutions+=1;
      candidate=traceCandidate(item,'latest',versions);
      reexecuted=true;
      assert(candidateStillValid(candidate,versions),'re-executed candidate must bind to current storage versions');
    }
    const tx=await providerA.broadcastTransaction(item.raw);
    const receipt=await providerA.waitForTransaction(tx.hash,1,120000);
    assert(receipt,`missing candidate receipt ${tx.hash}`);
    assert.equal(Number(receipt.status),1,`candidate transaction failed ${tx.hash}`);
    bumpWrites(candidate.access,versions);
    committed.push({hash:tx.hash,workload:item.workload,status:Number(receipt.status),gasUsed:receipt.gasUsed.toString(),reexecuted,access:candidate.access,readVersions:candidate.readVersions,traceCommitment:candidate.traceCommitment});
  }

  const serial=[];
  for (const item of items) {
    const tx=await providerB.broadcastTransaction(item.raw);
    const receipt=await providerB.waitForTransaction(tx.hash,1,120000);
    assert(receipt,`missing serial receipt ${tx.hash}`);
    serial.push({hash:tx.hash,status:Number(receipt.status),gasUsed:receipt.gasUsed.toString()});
  }

  const readState=async contract=>({
    hot:(await contract.slots(keyHot)).toString(),
    partitions:Object.fromEntries(await Promise.all(partitionKeys.map(async k=>[k,(await contract.slots(k)).toString()])))
  });
  const stateA=await readState(ca), stateB=await readState(cb);
  const stateEqual=JSON.stringify(stateA)===JSON.stringify(stateB);
  const receiptEqual=JSON.stringify(committed.map(x=>({hash:x.hash,status:x.status,gasUsed:x.gasUsed})))===JSON.stringify(serial);

  assert(invalidations>0,'conflicting hot-slot candidates must be invalidated');
  assert(reexecutions>0,'conflicting hot-slot candidates must be re-executed through real EVM tracing');
  assert.equal(stateEqual,true,'speculative candidate final storage differs from serial reference');
  assert.equal(receiptEqual,true,'committed receipt semantics differ from serial reference');

  const output={
    schemaVersion:1,
    status:'EXPERIMENTAL_REAL_EVM_SPECULATIVE_REEXECUTION',
    canonical:false,
    chainId:CHAIN_ID,
    executionClient:healthA?.chain?.executionClient ?? healthA?.executionClient ?? 'reth',
    contractAddress:address,
    parentBlock,
    candidateCount:items.length,
    invalidationCount:invalidations,
    reexecutionCount:reexecutions,
    serialFallbackCount:0,
    initialCandidates,
    committed,
    equality:{finalStorage:stateEqual,receiptStatusAndGas:receiptEqual},
    candidateFinalState:stateA,
    serialFinalState:stateB,
    evidenceCommitment:sha256(JSON.stringify({parentBlock,initialCandidates,committed,stateA,stateB})),
    claimBoundary:'This experiment uses Reth debug_traceCall to perform real EVM candidate executions against a fixed parent state, invalidates stale read-version candidates, re-executes invalid candidates against the updated state, commits signed transactions, and compares the final result with an isolated serial Reth reference. It does not prove production speculative execution, parallel EVM execution, consensus integration, decentralization, performance superiority, or mainnet readiness.'
  };
  await writeFile(OUT,`${JSON.stringify(output,null,2)}\n`,'utf8');
  console.log(JSON.stringify({output:OUT,status:output.status,candidates:items.length,invalidations,reexecutions,stateEqual,receiptEqual,evidenceCommitment:output.evidenceCommitment},null,2));
}

main().catch(async error=>{
  await writeFile(OUT,`${JSON.stringify({schemaVersion:1,status:'FAIL',error:error?.stack||String(error)},null,2)}\n`).catch(()=>{});
  console.error(error?.stack||error); process.exit(1);
});
