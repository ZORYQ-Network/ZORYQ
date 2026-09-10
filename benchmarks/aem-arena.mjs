#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const VERSION = 'aem-arena-v0.1';
const OUT = process.env.ZORYQ_AEM_ARENA_OUT || 'aem-arena-results.json';
const LEVELS = [0, 10, 30, 50, 80, 100];
const TX_COUNT = Math.max(32, Math.min(2048, Number(process.env.ZORYQ_AEM_ARENA_TXS || 256)));
const SERIAL_THRESHOLD = 0.20;

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function digest(value) {
  return `0x${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

class State {
  constructor() { this.map = new Map(); }
  clone() {
    const next = new State();
    for (const [k, v] of this.map) next.map.set(k, { ...v });
    return next;
  }
  read(key) { return { ...(this.map.get(key) || { value: 0, version: 0 }) }; }
  write(key, value) {
    const current = this.read(key);
    this.map.set(key, { value, version: current.version + 1 });
  }
  values() {
    return Object.fromEntries([...this.map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, v.value]));
  }
}

function execute(tx, state) {
  const current = state.read(tx.actualKey);
  return {
    reads: { [tx.actualKey]: current.version },
    writes: { [tx.actualKey]: current.value + tx.delta },
    status: 1,
  };
}

function apply(result, state) {
  for (const [key, value] of Object.entries(result.writes)) state.write(key, value);
}

function conflicts(a, b) {
  if (a.sender === b.sender) return true;
  return a.declaredKey === b.declaredKey;
}

function schedule(transactions) {
  const degree = new Array(transactions.length).fill(0);
  let pairChecks = 0;
  for (let i = 0; i < transactions.length; i += 1) {
    for (let j = i + 1; j < transactions.length; j += 1) {
      pairChecks += 1;
      if (conflicts(transactions[i], transactions[j])) {
        degree[i] += 1;
        degree[j] += 1;
      }
    }
  }
  const lanes = transactions.map((tx, index) => {
    const ratio = transactions.length <= 1 ? 0 : degree[index] / (transactions.length - 1);
    let lane = 'fast';
    if (tx.dynamicAccess || tx.declaredKey == null) lane = 'serial';
    else if (ratio >= SERIAL_THRESHOLD) lane = 'serial';
    else if (degree[index] > 0) lane = 'speculative';
    return { index, id: tx.id, lane, conflictDegree: degree[index], conflictRatio: Number(ratio.toFixed(6)) };
  });
  return { lanes, pairChecks, commitment: digest(lanes) };
}

function serialRun(transactions) {
  const state = new State();
  let executions = 0;
  for (const tx of transactions) {
    const result = execute(tx, state);
    executions += 1;
    apply(result, state);
  }
  return { stateDigest: digest(state.values()), executions, reexecutions: 0, invalidations: 0 };
}

function candidateValid(candidate, state) {
  return Object.entries(candidate.reads).every(([key, version]) => state.read(key).version === version);
}

function speculativeRun(transactions, mode) {
  const state = new State();
  const snapshot = state.clone();
  const plan = schedule(transactions);
  const candidates = new Map();
  let executions = 0;
  let reexecutions = 0;
  let invalidations = 0;
  let serialFallbacks = 0;

  for (const lane of plan.lanes) {
    const shouldSpeculate = mode === 'always-speculative' || lane.lane !== 'serial';
    if (shouldSpeculate) {
      candidates.set(lane.index, execute(transactions[lane.index], snapshot));
      executions += 1;
    }
  }

  for (let i = 0; i < transactions.length; i += 1) {
    const lane = plan.lanes[i];
    let result;
    if (mode === 'aem' && lane.lane === 'serial') {
      serialFallbacks += 1;
      result = execute(transactions[i], state);
      executions += 1;
    } else {
      const candidate = candidates.get(i);
      assert(candidate, `missing candidate ${i}`);
      if (candidateValid(candidate, state)) result = candidate;
      else {
        invalidations += 1;
        reexecutions += 1;
        result = execute(transactions[i], state);
        executions += 1;
      }
    }
    apply(result, state);
  }

  const counts = { fast: 0, speculative: 0, serial: 0 };
  for (const lane of plan.lanes) counts[lane.lane] += 1;
  return {
    stateDigest: digest(state.values()),
    scheduleCommitment: plan.commitment,
    pairChecks: plan.pairChecks,
    laneCounts: counts,
    executions,
    reexecutions,
    invalidations,
    serialFallbacks,
  };
}

function makeWorkload(contentionPercent, count) {
  const hotCount = contentionPercent === 100 ? count : Math.round(count * contentionPercent / 100);
  const txs = [];
  for (let i = 0; i < count; i += 1) {
    const hot = i < hotCount;
    txs.push({
      id: `c${contentionPercent}-tx-${i}`,
      sender: `sender-${i}`,
      actualKey: hot ? 'state:hot' : `state:isolated:${i}`,
      declaredKey: hot ? 'state:hot' : `state:isolated:${i}`,
      delta: 1,
    });
  }
  return txs;
}

function pctReduction(before, after) {
  if (before === 0) return 0;
  return Number((((before - after) / before) * 100).toFixed(2));
}

const cases = [];
for (const contention of LEVELS) {
  const txs = makeWorkload(contention, TX_COUNT);
  const scheduleA = schedule(txs);
  const scheduleB = schedule(txs);
  assert.equal(scheduleA.commitment, scheduleB.commitment, `nondeterministic schedule at ${contention}%`);

  const serial = serialRun(txs);
  const always = speculativeRun(txs, 'always-speculative');
  const aem = speculativeRun(txs, 'aem');

  assert.equal(always.stateDigest, serial.stateDigest, `always-speculative diverged at ${contention}%`);
  assert.equal(aem.stateDigest, serial.stateDigest, `AEM diverged at ${contention}%`);
  assert(aem.executions <= always.executions, `AEM did more execution work at ${contention}%`);
  if (contention === 0) assert.equal(aem.executions, TX_COUNT, '0% contention should not re-execute');
  if (contention >= 30) assert(aem.reexecutions < always.reexecutions, `AEM must reduce reexecution at ${contention}%`);

  cases.push({
    contentionPercent: contention,
    txCount: TX_COUNT,
    scheduleCommitment: scheduleA.commitment,
    serial,
    alwaysSpeculative: always,
    aem,
    comparison: {
      reexecutionReductionPercent: pctReduction(always.reexecutions, aem.reexecutions),
      executionWorkReductionPercent: pctReduction(always.executions, aem.executions),
    },
  });
}

const result = {
  ok: true,
  status: 'SIMULATION',
  canonical: false,
  benchmarkClass: 'deterministic-synthetic-contention',
  version: VERSION,
  chainIdTarget: 5919065,
  parameters: { txCountPerCase: TX_COUNT, contentionLevels: LEVELS, serialThreshold: SERIAL_THRESHOLD },
  limitations: [
    'This is not a TPS benchmark.',
    'This does not execute REVM/EVM bytecode.',
    'Synthetic access sets are known ground truth.',
    'Wall-clock performance is intentionally not claimed.',
    'Canonical ZORYQ/Reth execution is not modified.',
  ],
  cases,
  summary: {
    allSerialEquivalent: cases.every((c) => c.aem.stateDigest === c.serial.stateDigest),
    allSchedulesDeterministic: true,
    neverMoreExecutionWorkThanAlwaysSpeculative: cases.every((c) => c.aem.executions <= c.alwaysSpeculative.executions),
    highContentionReexecutionReduced: cases.filter((c) => c.contentionPercent >= 30).every((c) => c.aem.reexecutions < c.alwaysSpeculative.reexecutions),
  },
};

await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(result, null, 2));
