import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function keyset(item) {
  const keys = new Set();
  const from = String(item.from || '').toLowerCase();
  const to = String(item.to || '').toLowerCase();
  if (from) {
    keys.add(`acct:${from}:nonce`);
    keys.add(`acct:${from}:balance`);
  }
  if (item.value !== undefined && to) keys.add(`acct:${to}:balance`);

  switch (item.workload) {
    case 'single-storage-hotspot':
    case 'mixed-revert-success':
      keys.add('contract:probe:slot:hot');
      break;
    case 'independent-storage-partitions':
      keys.add(`contract:probe:partition:${sha256(String(item.data || '')).slice(0, 16)}`);
      break;
    case 'erc20-hotspot-seed':
      keys.add(`contract:probe:token:${from}`);
      break;
    case 'erc20-hotspot-recipient':
      keys.add(`contract:probe:token:${from}`);
      keys.add('contract:probe:token:hot-recipient');
      break;
    case 'dex-like-reserve-updates':
      keys.add('contract:probe:dex:reserve-a');
      keys.add('contract:probe:dex:reserve-b');
      break;
    case 'agent-overlapping-budget': {
      const marker = sha256(String(item.data || '')).slice(0, 8);
      keys.add(`contract:probe:agent-budget:${marker}`);
      break;
    }
    default:
      break;
  }
  return [...keys].sort();
}

function conflicts(a, b) {
  const right = new Set(b.resources);
  return a.resources.some((key) => right.has(key));
}

export function buildCandidateSchedule(items) {
  const enriched = items.map((item, index) => ({ ...item, canonicalIndex: index, resources: keyset(item) }));
  const waves = [];
  const assigned = [];
  const conflictsFound = [];

  // Dependencies are directed by canonical input order. A transaction that
  // conflicts with an earlier transaction must be scheduled strictly after
  // that earlier transaction, not merely in a different wave. This matters
  // especially for same-sender nonce chains: placing nonce N+1 in an earlier
  // wave than nonce N can strand the higher-nonce transaction in the mempool.
  for (const item of enriched) {
    let earliestWave = 0;
    for (const prior of assigned) {
      if (!conflicts(item, prior)) continue;
      const shared = item.resources.filter((resource) => prior.resources.includes(resource));
      conflictsFound.push({
        earlier: prior.canonicalIndex,
        later: item.canonicalIndex,
        earlierWave: prior.schedulerWave,
        resources: shared,
      });
      earliestWave = Math.max(earliestWave, prior.schedulerWave + 1);
    }

    while (waves.length <= earliestWave) waves.push([]);
    const scheduled = { ...item, schedulerWave: earliestWave };
    waves[earliestWave].push(scheduled);
    assigned.push(scheduled);
  }

  const dependencyOrderValid = conflictsFound.every(({ earlier, later, earlierWave }) => {
    const laterWave = assigned.find((item) => item.canonicalIndex === later)?.schedulerWave;
    return earlier < later && Number.isInteger(laterWave) && earlierWave < laterWave;
  });

  const senderNonceOrder = new Map();
  let senderNonceOrderValid = true;
  for (const item of assigned) {
    const from = String(item.from || '').toLowerCase();
    if (!from || item.nonce === undefined || item.nonce === null) continue;
    const nonce = Number(item.nonce);
    const previous = senderNonceOrder.get(from);
    if (previous && (nonce <= previous.nonce || item.schedulerWave <= previous.wave)) {
      senderNonceOrderValid = false;
      break;
    }
    senderNonceOrder.set(from, { nonce, wave: item.schedulerWave });
  }

  const telemetry = {
    schemaVersion: 2,
    scheduler: 'zoryq-candidate-wave-scheduler',
    schedulerMode: 'directed-dependency-wave-scheduling',
    transactionCount: enriched.length,
    waveCount: waves.length,
    maxWaveWidth: Math.max(0, ...waves.map((wave) => wave.length)),
    conflictCount: conflictsFound.length,
    conflictPairs: conflictsFound,
    dependencyOrderValid,
    senderNonceOrderValid,
    reexecutionCount: 0,
    fallbackToSerialCount: waves.filter((wave) => wave.length === 1).length,
    fallbackReason: 'conflicting transactions are ordered into strictly later waves; no speculative state execution is claimed',
    workloadDigest: sha256(JSON.stringify(enriched.map(({ raw, ...item }) => item))),
    claimBoundary: 'This telemetry proves scheduler decisions in the ZORYQ candidate scheduling layer only. It does not prove parallel EVM state execution inside Reth.'
  };

  if (!dependencyOrderValid || !senderNonceOrderValid) {
    throw new Error('candidate scheduler produced an invalid directed dependency or sender nonce order');
  }

  return { waves, telemetry };
}

export async function executeCandidateSchedule(items, { broadcast, waitReceipt }) {
  const { waves, telemetry } = buildCandidateSchedule(items);
  const receipts = [];

  for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
    const submitted = await Promise.all(waves[waveIndex].map(async (item) => {
      const hash = await broadcast(item.raw);
      return { ...item, hash, schedulerWave: waveIndex };
    }));
    for (const item of submitted) {
      const receipt = await waitReceipt(item.hash);
      receipts.push({
        ...item,
        blockNumber: receipt.blockNumber,
        transactionIndex: receipt.index,
        status: Number(receipt.status),
        gasUsed: receipt.gasUsed.toString(),
      });
    }
  }

  receipts.sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex);
  return { receipts, telemetry };
}
