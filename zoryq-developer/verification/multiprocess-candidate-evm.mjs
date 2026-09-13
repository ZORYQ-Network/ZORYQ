#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { ContractFactory, HDNodeWallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('../../zoryq-evm-node/node_modules/ethers');
const solc = require('../../zoryq-evm-node/node_modules/solc');
const execFileAsync = promisify(execFile);

const CHAIN_ID = 5919065;
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const EXECUTORS = [
  { id:'executor-0', container:process.env.ZORYQ_EXECUTOR_0_CONTAINER || 'zoryq-fabric-executor-0', rpc:process.env.ZORYQ_EXECUTOR_0_RPC || 'http://127.0.0.1:8081/rpc', base:process.env.ZORYQ_EXECUTOR_0_BASE || 'http://127.0.0.1:8081' },
  { id:'executor-1', container:process.env.ZORYQ_EXECUTOR_1_CONTAINER || 'zoryq-fabric-executor-1', rpc:process.env.ZORYQ_EXECUTOR_1_RPC || 'http://127.0.0.1:8082/rpc', base:process.env.ZORYQ_EXECUTOR_1_BASE || 'http://127.0.0.1:8082' },
  { id:'executor-2', container:process.env.ZORYQ_EXECUTOR_2_CONTAINER || 'zoryq-fabric-executor-2', rpc:process.env.ZORYQ_EXECUTOR_2_RPC || 'http://127.0.0.1:8083/rpc', base:process.env.ZORYQ_EXECUTOR_2_BASE || 'http://127.0.0.1:8083' },
];
const SERIAL = { id:'serial-reference', container:process.env.ZORYQ_SERIAL_CONTAINER || 'zoryq-fabric-serial', rpc:process.env.ZORYQ_SERIAL_RPC || 'http://127.0.0.1:8084/rpc', base:process.env.ZORYQ_SERIAL_BASE || 'http://127.0.0.1:8084' };
const OUT = process.env.ZORYQ_MULTIPROCESS_EVM_OUT || 'multiprocess-candidate-evm.json';
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const sha256 = v => `0x${createHash('sha256').update(v).digest('hex')}`;
const norm = hex => `0x${String(hex||'').replace(/^0x/,'').padStart(64,'0').toLowerCase()}`;
const uniq = xs => [...new Set(xs.map(norm))].sort();

function provider(endpoint) { return new JsonRpcProvider(endpoint.rpc, CHAIN_ID, { staticNetwork:true }); }
function derive(index, p) { return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(p); }

async function waitReady(endpoint) {
  for (let i=0;i<120;i+=1) {
    try {
      const r=await fetch(`${endpoint.base}/health`);
      if (r.ok) {
        const j=await r.json();
        if (Number(j?.chain?.chainId ?? j?.chainId)===CHAIN_ID) return j;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error(`node not ready: ${endpoint.id}`);
}

function compile() {
  const source=`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ZoryqFabricProbe {
  mapping(bytes32=>uint256) public slots;
  event Touched(bytes32 indexed key,uint256 value);
  function setAndWork(bytes32 key,uint256 value,uint256 loops) external {
    uint256 acc=value;
    for(uint256 i=0;i<loops;i++){ unchecked { acc = uint256(keccak256(abi.encodePacked(acc,i,key))); } }
    slots[key]=value;
    emit Touched(key,value);
    if(acc==type(uint256).max){ slots[key]=acc; }
  }
}`;
  const input={language:'Solidity',sources:{'Fabric.sol':{content:source}},settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}};
  const out=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(out.errors||[]).filter(e=>e.severity==='error');
  assert.equal(errors.length,0,errors.map(e=>e.formattedMessage).join('\n'));
  return out.contracts['Fabric.sol'].ZoryqFabricProbe;
}

async function internalRpc(container, method, params) {
  const payload=JSON.stringify({jsonrpc:'2.0',id:1,method,params});
  const program=`const p=process.argv[1];fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:p}).then(async r=>{const t=await r.text();if(!r.ok)throw new Error('http_'+r.status+':'+t);process.stdout.write(t)}).catch(e=>{console.error(e);process.exit(1)})`;
  const { stdout }=await execFileAsync('docker',['exec',container,'node','-e',program,payload],{encoding:'utf8',maxBuffer:64*1024*1024});
  const body=JSON.parse(stdout);
  if(body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function opcodeAccess(trace) {
  const reads=[], writes=[];
  for(const step of trace?.structLogs||[]) {
    if(step.op!=='SLOAD' && step.op!=='SSTORE') continue;
    const stack=Array.isArray(step.stack)?step.stack:[];
    assert(stack.length>0,`${step.op} missing stack evidence`);
    const slot=norm(stack[stack.length-1]);
    if(step.op==='SLOAD') reads.push(slot); else writes.push(slot);
  }
  return {reads:uniq(reads),writes:uniq(writes)};
}

async function deployIdentically(artifact, endpoints) {
  const addresses=[];
  for(const endpoint of endpoints) {
    const p=provider(endpoint);
    const deployer=derive(0,p);
    const factory=new ContractFactory(artifact.abi,`0x${artifact.evm.bytecode.object}`,deployer);
    const contract=await factory.deploy();
    await contract.waitForDeployment();
    addresses.push((await contract.getAddress()).toLowerCase());
  }
  assert(addresses.every(a=>a===addresses[0]),'fixture contract address diverged across isolated executors');
  return addresses[0];
}

async function fixtureDigest(endpoint, contractAddress, senderAddresses, keys) {
  const p=provider(endpoint);
  const code=await p.getCode(contractAddress);
  const slots={};
  // mapping(bytes32=>uint256) at storage slot 0: keccak256(abi.encode(key,0))
  for(const key of keys) {
    const encoded=`0x${key.slice(2).padStart(64,'0')}${'0'.repeat(64)}`;
    const storageSlot=keccak256(encoded);
    slots[key]=await p.getStorage(contractAddress,storageSlot);
  }
  const senders={};
  for(const address of senderAddresses) senders[address.toLowerCase()]={balance:(await p.getBalance(address)).toString(),nonce:await p.getTransactionCount(address)};
  return sha256(JSON.stringify({codeHash:keccak256(code),slots,senders}));
}

async function main() {
  const endpoints=[...EXECUTORS,SERIAL];
  const health=await Promise.all(endpoints.map(waitReady));
  assert(health.every(h=>Number(h?.chain?.chainId ?? h?.chainId)===CHAIN_ID));
  assert(new Set(EXECUTORS.map(e=>e.container)).size===EXECUTORS.length,'candidate executors must be separate containers');

  const artifact=compile();
  const contractAddress=await deployIdentically(artifact,endpoints);
  const canonicalProvider=provider(EXECUTORS[0]);
  const serialProvider=provider(SERIAL);
  const canonicalContract=new ContractFactory(artifact.abi,`0x${artifact.evm.bytecode.object}`,derive(0,canonicalProvider)).attach(contractAddress);
  const serialContract=new ContractFactory(artifact.abi,`0x${artifact.evm.bytecode.object}`,derive(0,serialProvider)).attach(contractAddress);
  const keys=['fabric-p0','fabric-p1','fabric-p2'].map(x=>keccak256(toUtf8Bytes(x)));
  const wallets=EXECUTORS.map((_,i)=>derive(i+1,canonicalProvider));
  const gasPrice=(await canonicalProvider.getFeeData()).gasPrice || 1_000_000_000n;
  const items=[];
  for(let i=0;i<EXECUTORS.length;i+=1) {
    const wallet=wallets[i];
    const nonce=await canonicalProvider.getTransactionCount(wallet.address);
    const data=canonicalContract.interface.encodeFunctionData('setAndWork',[keys[i],1000n+BigInt(i),350n]);
    const raw=await wallet.signTransaction({chainId:CHAIN_ID,nonce,to:contractAddress,data,gasLimit:8_000_000n,gasPrice,type:0,value:0n});
    items.push({index:i,executorId:EXECUTORS[i].id,from:wallet.address,to:contractAddress,data,raw,hash:keccak256(raw),gasPriceHex:`0x${gasPrice.toString(16)}`});
  }

  const fixtureDigests=await Promise.all(endpoints.map(e=>fixtureDigest(e,contractAddress,wallets.map(w=>w.address),keys)));
  assert(fixtureDigests.every(d=>d===fixtureDigests[0]),'executor parent-state fixtures are not equivalent');

  async function traceOne(item, endpoint) {
    const started=process.hrtime.bigint();
    const trace=await internalRpc(endpoint.container,'debug_traceCall',[{from:item.from,to:item.to,data:item.data,gas:'0x7a1200',gasPrice:item.gasPriceHex,value:'0x0'},'latest',{disableMemory:true,disableStorage:true,disableStack:false,enableReturnData:true}]);
    const ended=process.hrtime.bigint();
    assert.equal(Boolean(trace?.failed),false,`${endpoint.id} candidate trace failed`);
    const access=opcodeAccess(trace);
    assert(access.writes.length>0,`${endpoint.id} must expose real SSTORE evidence`);
    return {executorId:endpoint.id,container:endpoint.container,txHash:item.hash,startedNs:started.toString(),endedNs:ended.toString(),durationNs:(ended-started).toString(),gas:Number(trace?.gas||0),access,traceCommitment:sha256(JSON.stringify({failed:Boolean(trace?.failed),gas:trace?.gas||0,access}))};
  }

  const parallelStart=process.hrtime.bigint();
  const candidateResults=await Promise.all(items.map((item,i)=>traceOne(item,EXECUTORS[i])));
  const parallelEnd=process.hrtime.bigint();
  const latestStart=candidateResults.reduce((m,r)=>BigInt(r.startedNs)>m?BigInt(r.startedNs):m,0n);
  const earliestEnd=candidateResults.reduce((m,r)=>m===0n||BigInt(r.endedNs)<m?BigInt(r.endedNs):m,0n);
  const allIntervalsOverlap=latestStart<earliestEnd;
  assert.equal(allIntervalsOverlap,true,'isolated candidate EVM execution intervals did not overlap');

  // Independent fixture keys must remain disjoint across candidate writes.
  for(let i=0;i<candidateResults.length;i+=1) for(let j=i+1;j<candidateResults.length;j+=1) {
    const right=new Set(candidateResults[j].access.writes);
    assert.equal(candidateResults[i].access.writes.some(x=>right.has(x)),false,'independent candidate write sets unexpectedly overlap');
  }

  const canonicalReceipts=[];
  for(const item of items) {
    const tx=await canonicalProvider.broadcastTransaction(item.raw);
    const receipt=await canonicalProvider.waitForTransaction(tx.hash,1,120000); assert(receipt);
    canonicalReceipts.push({hash:tx.hash,status:Number(receipt.status),gasUsed:receipt.gasUsed.toString()});
  }
  const serialReceipts=[];
  for(const item of items) {
    const tx=await serialProvider.broadcastTransaction(item.raw);
    const receipt=await serialProvider.waitForTransaction(tx.hash,1,120000); assert(receipt);
    serialReceipts.push({hash:tx.hash,status:Number(receipt.status),gasUsed:receipt.gasUsed.toString()});
  }
  const stateA=Object.fromEntries(await Promise.all(keys.map(async k=>[k,(await canonicalContract.slots(k)).toString()])));
  const stateB=Object.fromEntries(await Promise.all(keys.map(async k=>[k,(await serialContract.slots(k)).toString()])));
  const stateEqual=JSON.stringify(stateA)===JSON.stringify(stateB);
  const receiptEqual=JSON.stringify(canonicalReceipts)===JSON.stringify(serialReceipts);
  assert.equal(stateEqual,true,'canonical committed state differs from serial reference');
  assert.equal(receiptEqual,true,'canonical receipts differ from serial reference');

  const evidence={
    schemaVersion:1,
    status:'MULTIPROCESS_CONCURRENT_EVM_CANDIDATE_EXECUTION',
    canonical:false,
    chainId:CHAIN_ID,
    executorCount:EXECUTORS.length,
    separateContainers:true,
    equivalentParentFixture:true,
    parentFixtureDigest:fixtureDigests[0],
    concurrentIntervalsOverlap:allIntervalsOverlap,
    concurrentWindowNs:(parallelEnd-parallelStart).toString(),
    candidateResults,
    equality:{finalStorage:stateEqual,receiptStatusAndGas:receiptEqual},
    canonicalFinalState:stateA,
    serialFinalState:stateB,
    evidenceCommitment:sha256(JSON.stringify({fixture:fixtureDigests[0],candidateResults,stateA,stateB,canonicalReceipts,serialReceipts})),
    claimBoundary:'This gate demonstrates concurrent real-EVM candidate execution across separate isolated Reth processes/containers over equivalent deterministic parent-state fixtures, followed by canonical commit and serial-reference equivalence. It does not prove parallel EVM state transition inside a single execution client, decentralized operation, consensus integration, production distributed execution, performance superiority, or mainnet readiness.'
  };
  await writeFile(OUT,`${JSON.stringify(evidence,null,2)}\n`,'utf8');
  console.log(JSON.stringify({output:OUT,status:evidence.status,executors:evidence.executorCount,concurrentIntervalsOverlap:allIntervalsOverlap,stateEqual,receiptEqual,evidenceCommitment:evidence.evidenceCommitment},null,2));
}

main().catch(async error=>{
  await writeFile(OUT,`${JSON.stringify({schemaVersion:1,status:'FAIL',error:error?.stack||String(error)},null,2)}\n`).catch(()=>{});
  console.error(error?.stack||error); process.exit(1);
});
