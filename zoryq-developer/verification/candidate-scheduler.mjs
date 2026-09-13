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
  const conflictsFound = [];

  for (const item of enriched) {
    let placed = false;
    for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
      const wave = waves[waveIndex];
      const blockers = wave.filter((other) => conflicts(item, other));
      if (blockers.length === 0) {
        wave.push(item);
        placed = true;
        break;
      }
      for (const blocker of blockers) {
        conflictsFound.push({ earlier: blocker.canonicalIndex, later: item.canonicalIndex, resources: item.resources.filter((r) => blocker.resources.includes(r)) });
      }
    }
    if (!placed) waves.push([item]);
  }

  const telemetry = {
    schemaVersion: 1,
    scheduler: 'zoryq-candidate-wave-scheduler',
    schedulerMode: 'dependency-aware-wave-scheduling',
    transactionCount: enriched.length,
    waveCount: waves.length,
    maxWaveWidth: Math.max(0, ...waves.map((wave) => wave.length)),
    conflictCount: conflictsFound.length,
    conflictPairs: conflictsFound,
    reexecutionCount: 0,
    fallbackToSerialCount: waves.filter((wave) => wave.length === 1).length,
    fallbackReason: 'conflicting transactions are isolated into later waves; no speculative state execution is claimed',
    workloadDigest: sha256(JSON.stringify(enriched.map(({ raw, ...item }) => item))),
    claimBoundary: 'This telemetry proves scheduler decisions in the ZORYQ candidate scheduling layer only. It does not prove parallel EVM state execution inside Reth.'
  };

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
