import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { executeCandidateSchedule } from './candidate-scheduler.mjs';

const require = createRequire(import.meta.url);
const { ContractFactory, HDNodeWallet, JsonRpcProvider, keccak256 } = require('../../zoryq-evm-node/node_modules/ethers');
const solc = require('../../zoryq-evm-node/node_modules/solc');

const CHAIN_ID = 5919065;
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const CANDIDATE_RPC = process.env.ZORYQ_CANDIDATE_RPC || 'http://127.0.0.1:8081/rpc';
const SERIAL_RPC = process.env.ZORYQ_SERIAL_RPC || 'http://127.0.0.1:8082/rpc';
const CANDIDATE_BASE = process.env.ZORYQ_CANDIDATE_BASE || CANDIDATE_RPC.replace(/\/rpc$/, '');
const SERIAL_BASE = process.env.ZORYQ_SERIAL_BASE || SERIAL_RPC.replace(/\/rpc$/, '');
const OUT = process.env.ZORYQ_CANDIDATE_CONTRACT_EQ_OUT || 'candidate-contract-equivalence.json';
const providerA = new JsonRpcProvider(CANDIDATE_RPC, CHAIN_ID, { staticNetwork: true });
const providerB = new JsonRpcProvider(SERIAL_RPC, CHAIN_ID, { staticNetwork: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sha256 = v => createHash('sha256').update(v).digest('hex');

function derive(index, provider) {
  return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function waitReady(base) {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(`${base}/health`);
      if (r.ok) {
        const j = await r.json();
        if (Number(j?.chain?.chainId ?? j?.chainId) === CHAIN_ID) return j;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error(`node not ready: ${base}`);
}

const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ZoryqCandidateProbe {
  mapping(bytes32 => uint256) public slots;
  mapping(bytes32 => uint256) public agentSpent;
  uint256 public reserveA = 1000000;
  uint256 public reserveB = 1000000;
  event Touched(bytes32 indexed key, uint256 value);
  function setHot(uint256 value) external { bytes32 k=keccak256("hot"); slots[k]=value; emit Touched(k,value); }
  function incrementHot() external { bytes32 k=keccak256("hot"); slots[k]+=1; emit Touched(k,slots[k]); }
  function setPartition(bytes32 key,uint256 value) external { slots[key]=value; emit Touched(key,value); }
  function dexUpdate(uint256 addA,uint256 addB) external { reserveA+=addA; reserveB+=addB; }
  function agentSpend(bytes32 agent,uint256 amount,uint256 budget) external { uint256 next=agentSpent[agent]+amount; require(next<=budget,"budget"); agentSpent[agent]=next; }
  function alwaysRevert() external pure { revert("expected"); }
}`;

function compile() {
  const input = { language:'Solidity', sources:{'Probe.sol':{content:source}}, settings:{outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}} };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter(e => e.severity === 'error');
  assert.equal(errors.length, 0, errors.map(e => e.formattedMessage).join('\n'));
  return out.contracts['Probe.sol'].ZoryqCandidateProbe;
}

async function deploySame(artifact) {
  const a = derive(0, providerA), b = derive(0, providerB);
  assert((await providerA.getBalance(a.address)) > 0n);
  assert((await providerB.getBalance(b.address)) > 0n);
  const fa = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, a);
  const fb = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, b);
  const ca = await fa.deploy(), cb = await fb.deploy();
  await ca.waitForDeployment(); await cb.waitForDeployment();
  assert.equal((await ca.getAddress()).toLowerCase(), (await cb.getAddress()).toLowerCase());
  return { ca, cb };
}

async function snapshot(contract, provider, wallets) {
  const hot = keccak256(Buffer.from('hot'));
  const parts = ['p0','p1','p2','p3'].map(x => keccak256(Buffer.from(x)));
  const agents = ['agent-a','agent-b'].map(x => keccak256(Buffer.from(x)));
  const state = {
    hot:(await contract.slots(hot)).toString(), partitions:{}, agents:{},
    reserves:[(await contract.reserveA()).toString(),(await contract.reserveB()).toString()],
    balances:{}, nonces:{}
  };
  for (const p of parts) state.partitions[p] = (await contract.slots(p)).toString();
  for (const a of agents) state.agents[a] = (await contract.agentSpent(a)).toString();
  for (const w of wallets) {
    state.balances[w.address] = (await provider.getBalance(w.address)).toString();
    state.nonces[w.address] = await provider.getTransactionCount(w.address);
  }
  return { state, digest:sha256(JSON.stringify(state)) };
}

async function main() {
  await Promise.all([waitReady(CANDIDATE_BASE), waitReady(SERIAL_BASE)]);
  const artifact = compile();
  const { ca, cb } = await deploySame(artifact);
  const address = await ca.getAddress();
  const walletsA = Array.from({length:8}, (_,i) => derive(i+1, providerA));
  const walletsB = Array.from({length:8}, (_,i) => derive(i+1, providerB));
  for (let i=0;i<8;i+=1) assert.equal(walletsA[i].address.toLowerCase(), walletsB[i].address.toLowerCase());
  const gasPrice = (await providerA.getFeeData()).gasPrice || 1_000_000_000n;
  const nextNonce = new Map();
  for (const w of walletsA) nextNonce.set(w.address, await providerA.getTransactionCount(w.address));
  const items=[];
  const add = async (workload, wallet, fn, args) => {
    const nonce = nextNonce.get(wallet.address); nextNonce.set(wallet.address, nonce+1);
    const data = ca.interface.encodeFunctionData(fn,args);
    const raw = await wallet.signTransaction({chainId:CHAIN_ID,nonce,to:address,data,gasLimit:500000n,gasPrice,type:0,value:0n});
    items.push({workload,from:wallet.address,to:address,nonce,data,raw,inputHash:keccak256(raw)});
  };

  for (let i=0;i<4;i+=1) await add('independent-storage-partitions', walletsA[i], 'setPartition', [keccak256(Buffer.from(`p${i}`)),1000n+BigInt(i)]);
  for (let i=0;i<6;i+=1) await add('single-storage-hotspot', walletsA[i], 'setHot', [100n+BigInt(i)]);
  for (let i=0;i<4;i+=1) await add('dex-like-reserve-updates', walletsA[i], 'dexUpdate', [10n+BigInt(i),20n+BigInt(i)]);
  const agentA=keccak256(Buffer.from('agent-a')), agentB=keccak256(Buffer.from('agent-b'));
  for (let i=0;i<4;i+=1) await add('agent-overlapping-budget', walletsA[i], 'agentSpend', [agentA,30n,100n]);
  for (let i=4;i<8;i+=1) await add('agent-overlapping-budget', walletsA[i], 'agentSpend', [agentB,26n,100n]);
  await add('mixed-revert-success', walletsA[0], 'incrementHot', []);
  await add('mixed-revert-success', walletsA[1], 'alwaysRevert', []);
  await add('mixed-revert-success', walletsA[2], 'incrementHot', []);
  await add('mixed-revert-success', walletsA[3], 'alwaysRevert', []);

  const candidate = await executeCandidateSchedule(items, {
    broadcast: async raw => (await providerA.broadcastTransaction(raw)).hash,
    waitReceipt: async hash => {
      const r = await providerA.waitForTransaction(hash,1,120000); assert(r,`missing candidate receipt ${hash}`); return r;
    }
  });

  const serial=[];
  for (const item of candidate.receipts) {
    const tx=await providerB.broadcastTransaction(item.raw);
    const r=await providerB.waitForTransaction(tx.hash,1,120000); assert(r,`missing serial receipt ${tx.hash}`);
    serial.push({hash:tx.hash,status:Number(r.status),gasUsed:r.gasUsed.toString(),workload:item.workload});
  }

  const sa=await snapshot(ca,providerA,walletsA), sb=await snapshot(cb,providerB,walletsB);
  const candidateReceipts=candidate.receipts.map(r=>({hash:r.hash,status:r.status,gasUsed:r.gasUsed,workload:r.workload}));
  const stateEqual=sa.digest===sb.digest;
  const receiptEqual=JSON.stringify(candidateReceipts)===JSON.stringify(serial);
  const reverted=candidate.receipts.filter(r=>r.status===0).length;

  assert(candidate.telemetry.conflictCount>0,'contract matrix must produce conflicts');
  assert(candidate.telemetry.waveCount>1,'contract matrix must produce multiple waves');
  assert(candidate.telemetry.maxWaveWidth>1,'matrix must contain independent work in the same wave');
  assert(reverted>0,'matrix must include real reverted transactions');
  assert.equal(stateEqual,true,'candidate contract final state differs from serial reference');
  assert.equal(receiptEqual,true,'candidate contract receipt semantics differ from serial reference');

  const evidence={
    schemaVersion:1,commit:process.env.GITHUB_SHA||'local',chainId:CHAIN_ID,contractAddress:address,
    workloadClasses:[...new Set(items.map(x=>x.workload))],schedulerTelemetry:candidate.telemetry,
    failedOrRevertedTransactionCount:reverted,equality:{finalState:stateEqual,receiptStatusAndGas:receiptEqual},
    candidateStateDigest:sa.digest,serialStateDigest:sb.digest,
    claimStatus:'CANDIDATE_SCHEDULER_CONTRACT_STATE_EQUIVALENCE_MATRIX',
    claimBoundary:'This demonstrates candidate-scheduler state/receipt equivalence for the published contract workload matrix executed through Reth. It does not prove parallel EVM state execution, speculative EVM re-execution, consensus safety, decentralization, finality, performance superiority, or mainnet readiness.'
  };
  evidence.evidenceSha256=sha256(JSON.stringify(evidence));
  await writeFile(OUT,`${JSON.stringify(evidence,null,2)}\n`);
  console.log(JSON.stringify({output:OUT,transactions:items.length,conflicts:candidate.telemetry.conflictCount,waves:candidate.telemetry.waveCount,maxWaveWidth:candidate.telemetry.maxWaveWidth,reverted,stateEqual,receiptEqual,evidenceSha256:evidence.evidenceSha256},null,2));
}

main().catch(async error=>{
  await writeFile(OUT,`${JSON.stringify({schemaVersion:1,claimStatus:'FAIL',error:error?.stack||String(error)},null,2)}\n`).catch(()=>{});
  console.error(error); process.exit(1);
});
