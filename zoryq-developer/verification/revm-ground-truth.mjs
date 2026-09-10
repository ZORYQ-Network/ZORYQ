#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { AbiCoder, ContractFactory, HDNodeWallet, JsonRpcProvider, keccak256, toUtf8Bytes } = require('../../zoryq-evm-node/node_modules/ethers');
const solc = require('../../zoryq-evm-node/node_modules/solc');

const CHAIN_ID = 5919065;
const RPC = process.env.ZORYQ_REVM_PROBE_RPC || 'http://127.0.0.1:8081/rpc';
const BASE = process.env.ZORYQ_REVM_PROBE_BASE || RPC.replace(/\/rpc$/, '');
const CONTAINER = process.env.ZORYQ_REVM_PROBE_CONTAINER || 'zoryq-revm-ground-truth';
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const OUT = process.env.ZORYQ_REVM_GROUND_TRUTH_OUT || 'revm-ground-truth-results.json';
const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const coder = AbiCoder.defaultAbiCoder();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (value) => `0x${createHash('sha256').update(value).digest('hex')}`;
const norm = (hex) => `0x${String(hex || '').replace(/^0x/, '').padStart(64, '0').toLowerCase()}`;
const uniq = (xs) => [...new Set(xs.map(norm))].sort();

function derive(index) {
  return HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);
}

async function waitReady() {
  for (let i = 0; i < 120; i += 1) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) {
        const j = await r.json();
        if (Number(j?.chain?.chainId ?? j?.chainId) === CHAIN_ID) return j;
      }
    } catch {}
    await sleep(1000);
  }
  throw new Error('isolated ZORYQ node did not become ready');
}

function compile() {
  const source = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract ZoryqAccessProbe {
  mapping(bytes32 => uint256) public slots;
  event Access(bytes32 indexed key, uint256 value);
  function set(bytes32 key, uint256 value) external { slots[key] = value; emit Access(key, value); }
  function copyPlus(bytes32 readKey, bytes32 writeKey, uint256 delta) external { uint256 next = slots[readKey] + delta; slots[writeKey] = next; emit Access(writeKey, next); }
  function increment(bytes32 key) external { slots[key] += 1; emit Access(key, slots[key]); }
  function readOnly(bytes32 key) external view returns (uint256) { return slots[key]; }
}`;
  const input = { language:'Solidity', sources:{'ZoryqAccessProbe.sol':{content:source}}, settings:{optimizer:{enabled:false},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}} };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors || []).filter((e) => e.severity === 'error');
  assert.equal(errors.length, 0, errors.map((e) => e.formattedMessage).join('\n'));
  return out.contracts['ZoryqAccessProbe.sol'].ZoryqAccessProbe;
}

function internalRpc(method, params) {
  const payload = JSON.stringify({ jsonrpc:'2.0', id:1, method, params });
  const program = `const p=process.argv[1];fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:p}).then(async r=>{const t=await r.text();if(!r.ok)throw new Error('http_'+r.status+':'+t);process.stdout.write(t)}).catch(e=>{console.error(e);process.exit(1)})`;
  const raw = execFileSync('docker', ['exec', CONTAINER, 'node', '-e', program, payload], { encoding:'utf8', maxBuffer:32*1024*1024 });
  const body = JSON.parse(raw);
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

function mappingSlot(key) {
  return norm(keccak256(coder.encode(['bytes32','uint256'], [key, 0n])));
}

function opcodeAccess(structTrace) {
  const reads = [];
  const writes = [];
  for (const step of structTrace?.structLogs || []) {
    if (step.op !== 'SLOAD' && step.op !== 'SSTORE') continue;
    const stack = Array.isArray(step.stack) ? step.stack : [];
    assert(stack.length > 0, `${step.op} missing stack evidence`);
    const slot = norm(stack[stack.length - 1]);
    if (step.op === 'SLOAD') reads.push(slot);
    else writes.push(slot);
  }
  return { reads: uniq(reads), writes: uniq(writes) };
}

function storageKeys(account) {
  return Object.keys(account?.storage || {}).map(norm).sort();
}

function diffWrites(diff, address) {
  const lower = address.toLowerCase();
  const pre = diff?.pre || {};
  const post = diff?.post || {};
  const preAccount = Object.entries(pre).find(([a]) => a.toLowerCase() === lower)?.[1];
  const postAccount = Object.entries(post).find(([a]) => a.toLowerCase() === lower)?.[1];
  return uniq([...storageKeys(preAccount), ...storageKeys(postAccount)]);
}

function prediction(name, args) {
  if (name === 'set') return { mode:'bounded', reads:[], writes:[mappingSlot(args[0])] };
  if (name === 'copyPlus') return { mode:'bounded', reads:[mappingSlot(args[0])], writes:[mappingSlot(args[1])] };
  // increment reads and writes one calldata-derived key, but treat it as dynamic/serial
  // in this first classifier so uncertainty is explicitly fail-closed.
  if (name === 'increment') return { mode:'serial-fallback', reads:[], writes:[] };
  return { mode:'serial-fallback', reads:[], writes:[] };
}

function coverage(predicted, actual) {
  const p = new Set([...predicted.reads, ...predicted.writes]);
  const a = new Set([...actual.reads, ...actual.writes]);
  const tp = [...a].filter((x) => p.has(x)).length;
  const fp = [...p].filter((x) => !a.has(x)).length;
  const fn = [...a].filter((x) => !p.has(x)).length;
  const precision = p.size ? tp / p.size : (a.size ? 0 : 1);
  const recall = a.size ? tp / a.size : 1;
  return { truePositiveSlots:tp, falsePositiveSlots:fp, falseNegativeSlots:fn, precision, recall };
}

async function send(contract, signer, name, args) {
  const tx = await contract.connect(signer)[name](...args);
  const receipt = await tx.wait();
  assert.equal(Number(receipt.status), 1);
  return { name, args, hash:tx.hash, blockNumber:receipt.blockNumber };
}

async function main() {
  const health = await waitReady();
  const wallet = derive(0);
  assert((await provider.getBalance(wallet.address)) > 0n, 'probe wallet not prefunded');
  const artifact = compile();
  const factory = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const kA = keccak256(toUtf8Bytes('A'));
  const kB = keccak256(toUtf8Bytes('B'));
  const kC = keccak256(toUtf8Bytes('C'));
  const txs = [];
  txs.push(await send(contract, wallet, 'set', [kA, 7n]));
  txs.push(await send(contract, wallet, 'copyPlus', [kA, kB, 5n]));
  txs.push(await send(contract, wallet, 'increment', [kB]));
  txs.push(await send(contract, wallet, 'set', [kC, 99n]));

  const evidence = [];
  for (const tx of txs) {
    const structTrace = internalRpc('debug_traceTransaction', [tx.hash, { disableMemory:true, disableStorage:true, disableStack:false, enableReturnData:false }]);
    const diff = internalRpc('debug_traceTransaction', [tx.hash, { tracer:'prestateTracer', tracerConfig:{ diffMode:true } }]);
    const actual = opcodeAccess(structTrace);
    const changedSlots = diffWrites(diff, address);
    const predicted = prediction(tx.name, tx.args);
    const bounded = predicted.mode === 'bounded';
    const metrics = bounded ? coverage(predicted, actual) : null;
    if (bounded) {
      assert.equal(metrics.falseNegativeSlots, 0, `${tx.name}: bounded prediction missed actual slot`);
      assert(actual.writes.every((slot) => changedSlots.includes(slot)), `${tx.name}: SSTORE missing from prestate diff evidence`);
    }
    evidence.push({
      txHash:tx.hash,
      blockNumber:tx.blockNumber,
      method:tx.name,
      predicted,
      actualOpcodeAccess:actual,
      stateDiffChangedSlots:changedSlots,
      boundedMetrics:metrics,
    });
  }

  const boundedRows = evidence.filter((x) => x.predicted.mode === 'bounded');
  const totalTp = boundedRows.reduce((n,x) => n + x.boundedMetrics.truePositiveSlots, 0);
  const totalFp = boundedRows.reduce((n,x) => n + x.boundedMetrics.falsePositiveSlots, 0);
  const totalFn = boundedRows.reduce((n,x) => n + x.boundedMetrics.falseNegativeSlots, 0);
  const output = {
    ok:true,
    status:'PROTOTYPE',
    canonical:false,
    evidenceClass:'isolated-reth-revm-trace',
    chainId:CHAIN_ID,
    executionClient:health?.chain?.executionClient ?? health?.executionClient ?? 'reth',
    contractAddress:address,
    tracerEvidence:{
      opcodeTrace:'debug_traceTransaction default struct logger; SLOAD/SSTORE stack keys',
      stateDiff:'debug_traceTransaction prestateTracer diffMode',
      caveat:'Tracer output is version-sensitive and is evidence for this isolated prototype, not a consensus oracle.'
    },
    summary:{
      transactions: evidence.length,
      boundedPredictions: boundedRows.length,
      serialFallbacks: evidence.length - boundedRows.length,
      truePositiveSlots:totalTp,
      falsePositiveSlots:totalFp,
      falseNegativeSlots:totalFn,
      precision: totalTp + totalFp ? totalTp/(totalTp+totalFp) : 1,
      recall: totalTp + totalFn ? totalTp/(totalTp+totalFn) : 1,
      allBoundedPredictionsCovered: totalFn === 0,
    },
    evidence,
    resultCommitment:sha256(JSON.stringify(evidence)),
    limitations:[
      'Runs on an isolated disposable ZORYQ/Reth node, not the public testnet state.',
      'This does not execute transactions in parallel.',
      'This does not prove AEM throughput or novelty.',
      'Opcode/storage tracing is not part of consensus correctness.',
      'Nested call/delegatecall address attribution is not covered by v0.1 and therefore remains a required follow-up.',
    ],
  };
  await writeFile(OUT, `${JSON.stringify(output,null,2)}\n`, 'utf8');
  console.log(JSON.stringify(output,null,2));
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
