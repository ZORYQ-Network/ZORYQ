import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const OUT = process.env.ZORYQ_AEM_OUT || 'aem-research-results.json';
const VERSION = '0.1-research';

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

class VersionedState {
  constructor(initial = {}) {
    this.entries = new Map();
    for (const [key, value] of Object.entries(initial)) this.entries.set(key, { value, version: 0 });
  }
  clone() {
    const next = new VersionedState();
    for (const [key, entry] of this.entries) next.entries.set(key, { ...entry });
    return next;
  }
  read(key) {
    const entry = this.entries.get(key) || { value: 0, version: 0 };
    return { ...entry };
  }
  write(key, value) {
    const current = this.read(key);
    this.entries.set(key, { value, version: current.version + 1 });
  }
  applyWrites(writes) {
    for (const [key, value] of Object.entries(writes)) this.write(key, value);
  }
  values() {
    return Object.fromEntries([...this.entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, entry.value]));
  }
  versions() {
    return Object.fromEntries([...this.entries.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, entry.version]));
  }
}

function execute(tx, state) {
  const reads = {};
  const writes = {};
  const read = (key) => {
    const entry = state.read(key);
    reads[key] = entry.version;
    return entry.value;
  };
  const write = (key, value) => { writes[key] = value; };

  let status = 1;
  let reason = null;

  switch (tx.op) {
    case 'set': {
      write(tx.key, tx.value);
      break;
    }
    case 'increment': {
      write(tx.key, Number(read(tx.key)) + Number(tx.delta ?? 1));
      break;
    }
    case 'transfer': {
      const from = `balance:${tx.from}`;
      const to = `balance:${tx.to}`;
      const fromBalance = Number(read(from));
      const toBalance = Number(read(to));
      if (fromBalance < tx.amount) {
        status = 0;
        reason = 'insufficient_balance';
      } else {
        write(from, fromBalance - tx.amount);
        write(to, toBalance + tx.amount);
      }
      break;
    }
    case 'agentSpend': {
      const key = `agent:${tx.agent}:spent`;
      const spent = Number(read(key));
      const next = spent + tx.amount;
      if (next > tx.budget) {
        status = 0;
        reason = 'budget_exceeded';
      } else {
        write(key, next);
      }
      break;
    }
    case 'reserveUpdate': {
      const a = Number(read(`pool:${tx.pool}:a`));
      const b = Number(read(`pool:${tx.pool}:b`));
      write(`pool:${tx.pool}:a`, a + tx.addA);
      write(`pool:${tx.pool}:b`, b + tx.addB);
      break;
    }
    case 'revert': {
      status = 0;
      reason = tx.reason || 'expected_revert';
      break;
    }
    default:
      throw new Error(`unsupported op ${tx.op}`);
  }

  return { status, reason, reads, writes: status === 1 ? writes : {} };
}

function overlaps(a, b) {
  const set = new Set(a);
  return b.some((value) => set.has(value));
}

function potentialConflict(a, b) {
  if (a.sender && b.sender && a.sender === b.sender) return true;
  const ar = a.declaredReads || [];
  const aw = a.declaredWrites || [];
  const br = b.declaredReads || [];
  const bw = b.declaredWrites || [];
  return overlaps(aw, br) || overlaps(aw, bw) || overlaps(bw, ar) || overlaps(bw, aw);
}

function classifyBatch(transactions) {
  const n = transactions.length;
  const conflictDegree = new Array(n).fill(0);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (potentialConflict(transactions[i], transactions[j])) {
        conflictDegree[i] += 1;
        conflictDegree[j] += 1;
      }
    }
  }

  const lanes = transactions.map((tx, index) => {
    const readsKnown = Array.isArray(tx.declaredReads);
    const writesKnown = Array.isArray(tx.declaredWrites);
    const ratio = n <= 1 ? 0 : conflictDegree[index] / (n - 1);
    let lane;
    let reason;

    if (!readsKnown || !writesKnown || tx.dynamicAccess === true) {
      lane = 'serial';
      reason = 'unknown_or_dynamic_access';
    } else if (ratio >= 0.35 || tx.forceSerial === true) {
      lane = 'serial';
      reason = 'high_contention';
    } else if (conflictDegree[index] === 0) {
      lane = 'fast';
      reason = 'known_disjoint';
    } else {
      lane = 'speculative';
      reason = 'bounded_conflict_risk';
    }

    return {
      index,
      id: tx.id,
      lane,
      reason,
      conflictDegree: conflictDegree[index],
      conflictRatio: Number(ratio.toFixed(4)),
      proofRequired: tx.proofRequired === true,
    };
  });

  return {
    version: VERSION,
    lanes,
    commitment: digest(lanes.map(({ index, id, lane, reason, conflictDegree, proofRequired }) => ({ index, id, lane, reason, conflictDegree, proofRequired }))),
  };
}

function serialReference(initial, transactions) {
  const state = new VersionedState(initial);
  const receipts = [];
  for (const tx of transactions) {
    const result = execute(tx, state);
    if (result.status === 1) state.applyWrites(result.writes);
    receipts.push({ id: tx.id, status: result.status, reason: result.reason });
  }
  return { state: state.values(), versions: state.versions(), receipts, stateDigest: digest(state.values()), receiptDigest: digest(receipts) };
}

function validCandidate(candidate, canonical) {
  return Object.entries(candidate.reads).every(([key, version]) => canonical.read(key).version === version);
}

function adaptiveRun(initial, transactions, mode = 'aem') {
  const canonical = new VersionedState(initial);
  const snapshot = canonical.clone();
  const schedule = classifyBatch(transactions);
  const candidates = new Map();
  const laneCounts = { fast: 0, speculative: 0, serial: 0, proof: 0 };

  for (const decision of schedule.lanes) {
    laneCounts[decision.lane] += 1;
    if (decision.proofRequired) laneCounts.proof += 1;
    const shouldSpeculate = mode === 'always-speculative' ? true : decision.lane !== 'serial';
    if (shouldSpeculate) candidates.set(decision.index, execute(transactions[decision.index], snapshot));
  }

  let invalidations = 0;
  let reexecutions = 0;
  let serialFallbacks = 0;
  const receipts = [];

  for (let index = 0; index < transactions.length; index += 1) {
    const tx = transactions[index];
    const decision = schedule.lanes[index];
    let result;

    if (mode === 'aem' && decision.lane === 'serial') {
      serialFallbacks += 1;
      result = execute(tx, canonical);
    } else {
      const candidate = candidates.get(index);
      assert(candidate, `missing speculative candidate for ${tx.id}`);
      if (validCandidate(candidate, canonical)) {
        result = candidate;
      } else {
        invalidations += 1;
        reexecutions += 1;
        result = execute(tx, canonical);
      }
    }

    if (result.status === 1) canonical.applyWrites(result.writes);
    receipts.push({ id: tx.id, status: result.status, reason: result.reason });
  }

  return {
    mode,
    scheduleCommitment: schedule.commitment,
    laneCounts,
    invalidations,
    reexecutions,
    serialFallbacks,
    state: canonical.values(),
    receipts,
    stateDigest: digest(canonical.values()),
    receiptDigest: digest(receipts),
  };
}

function transferTx(id, sender, to, amount = 10) {
  return {
    id,
    op: 'transfer',
    sender,
    from: sender,
    to,
    amount,
    declaredReads: [`balance:${sender}`, `balance:${to}`],
    declaredWrites: [`balance:${sender}`, `balance:${to}`],
  };
}

function buildWorkloads() {
  const initial = {
    'balance:a': 1000, 'balance:b': 1000, 'balance:c': 1000, 'balance:d': 1000,
    'balance:e': 1000, 'balance:f': 1000, 'balance:g': 1000, 'balance:h': 1000,
    hot: 0,
    'slot:p0': 0, 'slot:p1': 0, 'slot:p2': 0, 'slot:p3': 0,
    'agent:alpha:spent': 0, 'agent:beta:spent': 0,
    'pool:x:a': 1000000, 'pool:x:b': 1000000,
    'pool:y:a': 1000000, 'pool:y:b': 1000000,
  };

  const independentTransfers = [
    transferTx('it-0', 'a', 'e'), transferTx('it-1', 'b', 'f'), transferTx('it-2', 'c', 'g'), transferTx('it-3', 'd', 'h'),
  ];

  const storagePartitions = [0, 1, 2, 3].map((i) => ({
    id: `partition-${i}`,
    op: 'set',
    sender: `p${i}`,
    key: `slot:p${i}`,
    value: 100 + i,
    declaredReads: [],
    declaredWrites: [`slot:p${i}`],
  }));

  const hotspot = Array.from({ length: 8 }, (_, i) => ({
    id: `hot-${i}`,
    op: 'increment',
    sender: `hot-sender-${i}`,
    key: 'hot',
    delta: 1,
    declaredReads: ['hot'],
    declaredWrites: ['hot'],
  }));

  const agentBudget = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `alpha-${i}`, op: 'agentSpend', sender: `agent-a-${i}`, agent: 'alpha', amount: 30, budget: 100, declaredReads: ['agent:alpha:spent'], declaredWrites: ['agent:alpha:spent'] })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `beta-${i}`, op: 'agentSpend', sender: `agent-b-${i}`, agent: 'beta', amount: 26, budget: 100, declaredReads: ['agent:beta:spent'], declaredWrites: ['agent:beta:spent'] })),
  ];

  const pools = [
    { id: 'pool-x-0', op: 'reserveUpdate', sender: 'px0', pool: 'x', addA: 10, addB: 20, declaredReads: ['pool:x:a', 'pool:x:b'], declaredWrites: ['pool:x:a', 'pool:x:b'] },
    { id: 'pool-y-0', op: 'reserveUpdate', sender: 'py0', pool: 'y', addA: 11, addB: 21, declaredReads: ['pool:y:a', 'pool:y:b'], declaredWrites: ['pool:y:a', 'pool:y:b'] },
    { id: 'pool-x-1', op: 'reserveUpdate', sender: 'px1', pool: 'x', addA: 12, addB: 22, declaredReads: ['pool:x:a', 'pool:x:b'], declaredWrites: ['pool:x:a', 'pool:x:b'] },
    { id: 'pool-y-1', op: 'reserveUpdate', sender: 'py1', pool: 'y', addA: 13, addB: 23, declaredReads: ['pool:y:a', 'pool:y:b'], declaredWrites: ['pool:y:a', 'pool:y:b'] },
  ];

  const mixedReverts = [
    { id: 'mr-0', op: 'increment', sender: 'mr0', key: 'hot', delta: 2, declaredReads: ['hot'], declaredWrites: ['hot'] },
    { id: 'mr-1', op: 'revert', sender: 'mr1', reason: 'expected', declaredReads: [], declaredWrites: [] },
    { id: 'mr-2', op: 'increment', sender: 'mr2', key: 'hot', delta: 3, declaredReads: ['hot'], declaredWrites: ['hot'] },
    { id: 'mr-3', op: 'revert', sender: 'mr3', reason: 'expected', declaredReads: [], declaredWrites: [] },
  ];

  const dynamicSafety = [
    { id: 'dynamic-0', op: 'increment', sender: 'dyn0', key: 'hot', delta: 5, dynamicAccess: true },
    { id: 'dynamic-1', op: 'set', sender: 'dyn1', key: 'slot:p0', value: 999, declaredReads: [], declaredWrites: ['slot:p0'] },
  ];

  const combined = [
    ...independentTransfers,
    ...storagePartitions,
    ...hotspot,
    ...agentBudget,
    ...pools,
    ...mixedReverts,
    ...dynamicSafety,
  ];

  return { initial, workloads: { independentTransfers, storagePartitions, hotspot, agentBudget, pools, mixedReverts, dynamicSafety, combined } };
}

function verifyWorkload(name, initial, transactions) {
  const scheduleA = classifyBatch(transactions);
  const scheduleB = classifyBatch(transactions);
  assert.equal(scheduleA.commitment, scheduleB.commitment, `${name}: scheduler is not deterministic`);

  const serial = serialReference(initial, transactions);
  const aem = adaptiveRun(initial, transactions, 'aem');
  const always = adaptiveRun(initial, transactions, 'always-speculative');

  assert.equal(aem.stateDigest, serial.stateDigest, `${name}: AEM final state differs from serial reference`);
  assert.equal(aem.receiptDigest, serial.receiptDigest, `${name}: AEM receipt semantics differ from serial reference`);
  assert.equal(always.stateDigest, serial.stateDigest, `${name}: always-speculative baseline final state differs from serial reference`);
  assert.equal(always.receiptDigest, serial.receiptDigest, `${name}: always-speculative baseline receipt semantics differ from serial reference`);

  return {
    name,
    txCount: transactions.length,
    scheduleCommitment: scheduleA.commitment,
    laneCounts: aem.laneCounts,
    aem: { invalidations: aem.invalidations, reexecutions: aem.reexecutions, serialFallbacks: aem.serialFallbacks },
    alwaysSpeculative: { invalidations: always.invalidations, reexecutions: always.reexecutions },
    equality: { finalState: true, receiptSemantics: true, deterministicSchedule: true },
    serialStateDigest: serial.stateDigest,
    aemStateDigest: aem.stateDigest,
  };
}

async function main() {
  const { initial, workloads } = buildWorkloads();
  const results = Object.entries(workloads).map(([name, transactions]) => verifyWorkload(name, initial, transactions));
  const combined = results.find((r) => r.name === 'combined');
  assert(combined, 'combined workload missing');
  assert(combined.aem.reexecutions <= combined.alwaysSpeculative.reexecutions, 'AEM must not increase re-execution in the research mixed workload');

  const report = {
    schemaVersion: 1,
    aemVersion: VERSION,
    generatedAt: new Date().toISOString(),
    chainIdTarget: 5919065,
    status: 'RESEARCH_SIMULATOR_ONLY',
    claimPolicy: 'This simulator validates deterministic scheduling and serial-equivalent abstract state transitions only. It is not evidence that the public ZORYQ testnet currently executes EVM transactions in parallel.',
    baselines: ['serial-reference', 'always-speculative'],
    results,
    summary: {
      workloads: results.length,
      allSerialEquivalent: results.every((r) => r.equality.finalState && r.equality.receiptSemantics),
      allSchedulesDeterministic: results.every((r) => r.equality.deterministicSchedule),
      combinedAemReexecutions: combined.aem.reexecutions,
      combinedAlwaysSpeculativeReexecutions: combined.alwaysSpeculative.reexecutions,
      reducedOrEqualReexecutionInMixedWorkload: combined.aem.reexecutions <= combined.alwaysSpeculative.reexecutions,
    },
  };

  await writeFile(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
}

main().catch(async (error) => {
  const failure = {
    schemaVersion: 1,
    aemVersion: VERSION,
    generatedAt: new Date().toISOString(),
    status: 'FAIL',
    error: error?.stack || String(error),
  };
  await writeFile(OUT, `${JSON.stringify(failure, null, 2)}\n`).catch(() => {});
  console.error(error);
  process.exit(1);
});
