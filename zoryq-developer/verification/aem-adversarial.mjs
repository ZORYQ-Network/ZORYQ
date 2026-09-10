#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const OUT = process.env.ZORYQ_AEM_REDTEAM_OUT || 'aem-red-team-results.json';
const VERSION = 'aem-redteam-v0.1';

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  return v;
}
function digest(v) { return `0x${createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')}`; }

class State {
  constructor(initial = {}) { this.map = new Map(Object.entries(initial).map(([k, value]) => [k, { value, version: 0 }])); }
  clone() { const n = new State(); for (const [k, v] of this.map) n.map.set(k, { ...v }); return n; }
  read(k) { return { ...(this.map.get(k) || { value: 0, version: 0 }) }; }
  write(k, value) { const x = this.read(k); this.map.set(k, { value, version: x.version + 1 }); }
  values() { return Object.fromEntries([...this.map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,v.value])); }
}

function overlaps(a = [], b = []) { const s = new Set(a); return b.some((x) => s.has(x)); }
function predictedConflict(a, b) {
  if (a.sender && b.sender && a.sender === b.sender) return true;
  return overlaps(a.declaredWrites, b.declaredReads) || overlaps(a.declaredWrites, b.declaredWrites) || overlaps(b.declaredWrites, a.declaredReads) || overlaps(b.declaredWrites, a.declaredWrites);
}

function schedule(txs, workerCount = 4) {
  const degree = new Array(txs.length).fill(0);
  for (let i = 0; i < txs.length; i += 1) for (let j = i + 1; j < txs.length; j += 1) if (predictedConflict(txs[i], txs[j])) { degree[i]++; degree[j]++; }
  const lanes = txs.map((tx, i) => {
    const ratio = txs.length <= 1 ? 0 : degree[i] / (txs.length - 1);
    let lane = 'fast';
    if (tx.dynamicAccess || !Array.isArray(tx.declaredReads) || !Array.isArray(tx.declaredWrites)) lane = 'serial';
    else if (tx.forceSerial || ratio >= 0.20) lane = 'serial';
    else if (degree[i] > 0) lane = 'speculative';
    return { i, id: tx.id, lane, degree: degree[i], ratio: Number(ratio.toFixed(6)) };
  });
  // workerCount intentionally excluded from consensus-visible classification.
  return { workerCountLocalOnly: workerCount, lanes, commitment: digest(lanes) };
}

function execute(tx, state) {
  const reads = {};
  const writes = {};
  const read = (k) => { const e = state.read(k); reads[k] = e.version; return e.value; };
  const write = (k, v) => { writes[k] = v; };
  if (tx.op === 'increment') write(tx.actualKey, Number(read(tx.actualKey)) + Number(tx.delta ?? 1));
  else if (tx.op === 'copy-plus') write(tx.actualWrite, Number(read(tx.actualRead)) + Number(tx.delta ?? 0));
  else if (tx.op === 'set') write(tx.actualKey, tx.value);
  else throw new Error(`unsupported op ${tx.op}`);
  return { reads, writes, status: 1 };
}
function apply(result, state) { for (const [k,v] of Object.entries(result.writes)) state.write(k,v); }
function valid(candidate, state) { return Object.entries(candidate.reads).every(([k,ver]) => state.read(k).version === ver); }

function serial(initial, txs) {
  const state = new State(initial);
  for (const tx of txs) apply(execute(tx, state), state);
  return digest(state.values());
}

function adaptive(initial, txs) {
  const state = new State(initial);
  const snapshot = state.clone();
  const plan = schedule(txs);
  const candidates = new Map();
  let invalidations = 0;
  let reexecutions = 0;
  for (const lane of plan.lanes) if (lane.lane !== 'serial') candidates.set(lane.i, execute(txs[lane.i], snapshot));
  for (let i = 0; i < txs.length; i += 1) {
    const lane = plan.lanes[i];
    let result;
    if (lane.lane === 'serial') result = execute(txs[i], state);
    else {
      result = candidates.get(i);
      if (!valid(result, state)) {
        invalidations++;
        reexecutions++;
        result = execute(txs[i], state);
      }
    }
    apply(result, state);
  }
  return { digest: digest(state.values()), plan, invalidations, reexecutions };
}

const results = [];
function record(name, fn) {
  try { const detail = fn(); results.push({ name, ok: true, detail }); }
  catch (error) { results.push({ name, ok: false, error: String(error?.stack || error) }); }
}

record('dynamic access fails closed to serial', () => {
  const txs = [{ id:'dyn', op:'increment', actualKey:'hot', delta:1, dynamicAccess:true }];
  const p = schedule(txs);
  assert.equal(p.lanes[0].lane, 'serial');
  return p.lanes[0];
});

record('unknown access metadata fails closed to serial', () => {
  const txs = [{ id:'unknown', op:'set', actualKey:'x', value:1 }];
  const p = schedule(txs);
  assert.equal(p.lanes[0].lane, 'serial');
  return p.lanes[0];
});

record('same sender creates dependency edge', () => {
  const txs = [
    { id:'n0', sender:'alice', op:'set', actualKey:'a', value:1, declaredReads:[], declaredWrites:['a'] },
    { id:'n1', sender:'alice', op:'set', actualKey:'b', value:1, declaredReads:[], declaredWrites:['b'] },
  ];
  const p = schedule(txs);
  assert(p.lanes.every((x) => x.lane !== 'fast'));
  return p.lanes;
});

record('misleading declaration cannot bypass runtime read-version validation', () => {
  const initial = { hot:0, sink:0 };
  const txs = [
    { id:'writer', sender:'w', op:'increment', actualKey:'hot', delta:1, declaredReads:['hot'], declaredWrites:['hot'] },
    // Declares a disjoint read but actually reads hot. Prediction is wrong on purpose.
    { id:'liar', sender:'l', op:'copy-plus', actualRead:'hot', actualWrite:'sink', delta:10, declaredReads:['fake'], declaredWrites:['sink'] },
  ];
  const ref = serial(initial, txs);
  const run = adaptive(initial, txs);
  assert.equal(run.digest, ref);
  assert.equal(run.invalidations, 1);
  assert.equal(run.reexecutions, 1);
  return { serialDigest: ref, adaptiveDigest: run.digest, invalidations: run.invalidations };
});

record('conflict bomb degrades to serial-safe lane', () => {
  const txs = Array.from({length:128}, (_,i) => ({ id:`bomb-${i}`, sender:`s-${i}`, op:'increment', actualKey:'hot', delta:1, declaredReads:['hot'], declaredWrites:['hot'] }));
  const p = schedule(txs);
  const serialCount = p.lanes.filter((x) => x.lane === 'serial').length;
  assert.equal(serialCount, txs.length);
  const run = adaptive({hot:0}, txs);
  assert.equal(run.digest, serial({hot:0}, txs));
  assert.equal(run.reexecutions, 0);
  return { serialCount, txCount:txs.length, reexecutions:run.reexecutions };
});

record('local worker count cannot change deterministic schedule', () => {
  const txs = Array.from({length:16}, (_,i) => ({ id:`w-${i}`, sender:`s-${i}`, op:'increment', actualKey:i<4?'hot':`k${i}`, delta:1, declaredReads:[i<4?'hot':`k${i}`], declaredWrites:[i<4?'hot':`k${i}`] }));
  const commitments = [1,2,4,8,32].map((workers) => schedule(txs, workers).commitment);
  assert.equal(new Set(commitments).size, 1);
  return { commitments };
});

record('proof hint cannot change canonical state', () => {
  const initial = {x:0};
  const base = { id:'p', sender:'p', op:'increment', actualKey:'x', delta:3, declaredReads:['x'], declaredWrites:['x'] };
  const a = adaptive(initial, [base]);
  const b = adaptive(initial, [{...base, proofRequired:true}]);
  assert.equal(a.digest, b.digest);
  return { stateDigest:a.digest };
});

const failed = results.filter((r) => !r.ok);
const output = {
  ok: failed.length === 0,
  status: 'ADVERSARIAL_SIMULATION',
  canonical: false,
  version: VERSION,
  chainIdTarget: 5919065,
  scenarios: results,
  summary: { passed: results.length - failed.length, failed: failed.length },
  limitations: [
    'This harness is not real REVM instrumentation.',
    'It validates research invariants in a deterministic model only.',
    'Canonical Reth state, ordering and consensus are untouched.',
  ],
};
await writeFile(OUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (!output.ok) process.exitCode = 1;
