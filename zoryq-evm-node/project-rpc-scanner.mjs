import { indexProjectEvidence } from './project-indexer.mjs';

const CHAIN_ID = 5919065;
const CHAIN_HEX = '0x5a5159';
const ABSOLUTE_MAX_BLOCKS = 250;
const ABSOLUTE_MAX_MATCHING_TX = 5000;
const ABSOLUTE_MAX_CONCURRENCY = 8;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

const toHex = n => '0x' + BigInt(n).toString(16);
const toNumber = v => typeof v === 'string' && v.startsWith('0x') ? Number(BigInt(v)) : Number(v);
const normAddress = v => ADDRESS_RE.test(String(v || '')) ? String(v).toLowerCase() : null;

async function mapLimit(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  async function run() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return out;
}

function manifestContractSet(manifest) {
  const set = new Set();
  for (const c of Array.isArray(manifest?.contracts) ? manifest.contracts : []) {
    if (c?.active === false) continue;
    const address = normAddress(c?.address);
    if (!address) throw new Error('invalid_manifest_contract');
    set.add(address);
  }
  if (!set.size) throw new Error('no_active_project_contracts');
  if (set.size > 64) throw new Error('too_many_project_contracts');
  return set;
}

/**
 * Bounded canonical project scan over the ZORYQ RPC surface.
 *
 * Safety properties:
 * - validates Chain ID before indexing;
 * - scans at most 250 blocks per invocation;
 * - only requests receipts for transactions whose `to` matches a manifest-declared contract;
 * - caps matching transactions at 5,000;
 * - limits concurrent receipt reads;
 * - accepts an RPC function, not arbitrary URLs, preventing SSRF in this module;
 * - does not persist or mutate project state.
 */
export async function scanProjectRange({
  manifest,
  rpc,
  fromBlock,
  toBlock,
  confirmations = 0,
  maxBlocks = ABSOLUTE_MAX_BLOCKS,
  maxConcurrency = 6,
  approvedPrimitives = {}
} = {}) {
  if (!manifest || manifest.chainId !== CHAIN_ID) throw new Error('invalid_manifest_chain');
  if (typeof rpc !== 'function') throw new Error('rpc_function_required');
  const contracts = manifestContractSet(manifest);

  const chainId = String(await rpc('eth_chainId', [])).toLowerCase();
  if (chainId !== CHAIN_HEX) throw new Error('rpc_chain_mismatch');

  const latest = toNumber(await rpc('eth_blockNumber', []));
  if (!Number.isSafeInteger(latest) || latest < 0) throw new Error('invalid_latest_block');
  const conf = Math.max(0, Math.min(64, Number(confirmations) || 0));
  const safeLatest = Math.max(0, latest - conf);

  const requestedTo = toBlock == null ? safeLatest : toNumber(toBlock);
  const requestedFrom = fromBlock == null ? requestedTo : toNumber(fromBlock);
  if (!Number.isSafeInteger(requestedFrom) || !Number.isSafeInteger(requestedTo) || requestedFrom < 0 || requestedTo < requestedFrom) {
    throw new Error('invalid_block_range');
  }
  if (requestedTo > safeLatest) throw new Error('range_exceeds_safe_latest');

  const configuredMax = Math.max(1, Math.min(ABSOLUTE_MAX_BLOCKS, Number(maxBlocks) || ABSOLUTE_MAX_BLOCKS));
  const count = requestedTo - requestedFrom + 1;
  if (count > configuredMax) throw new Error('block_range_too_large');
  const concurrency = Math.max(1, Math.min(ABSOLUTE_MAX_CONCURRENCY, Number(maxConcurrency) || 1));

  const blocks = [];
  const matchingTransactions = [];
  for (let n = requestedFrom; n <= requestedTo; n++) {
    const block = await rpc('eth_getBlockByNumber', [toHex(n), true]);
    if (!block) throw new Error('block_unavailable');
    blocks.push({ number: block.number, timestamp: block.timestamp });
    for (const tx of Array.isArray(block.transactions) ? block.transactions : []) {
      const to = normAddress(tx?.to);
      if (!to || !contracts.has(to)) continue;
      matchingTransactions.push(tx);
      if (matchingTransactions.length > ABSOLUTE_MAX_MATCHING_TX) throw new Error('matching_transaction_cap_exceeded');
    }
  }

  const receipts = await mapLimit(matchingTransactions, concurrency, tx => rpc('eth_getTransactionReceipt', [tx.hash]));
  const indexed = indexProjectEvidence({ manifest, transactions: matchingTransactions, receipts, blocks, approvedPrimitives });

  return {
    ...indexed,
    status: 'live-indexed',
    scan: {
      chainId: CHAIN_ID,
      fromBlock: requestedFrom,
      toBlock: requestedTo,
      safeLatestBlock: safeLatest,
      confirmations: conf,
      blocksScanned: count,
      declaredContracts: contracts.size,
      matchingTransactions: matchingTransactions.length,
      receiptReads: receipts.length,
      maxBlocksPerInvocation: configuredMax,
      maxMatchingTransactions: ABSOLUTE_MAX_MATCHING_TX,
      maxConcurrency: concurrency
    },
    caveat: 'Live-indexed means the metrics were derived from a bounded read of the configured ZORYQ RPC. Project identity is not registry-verified until ZoryqProjectRegistry is deployed and the manifest binding is validated on-chain.'
  };
}

export const PROJECT_SCAN_LIMITS = Object.freeze({
  chainId: CHAIN_ID,
  maxBlocks: ABSOLUTE_MAX_BLOCKS,
  maxMatchingTransactions: ABSOLUTE_MAX_MATCHING_TX,
  maxConcurrency: ABSOLUTE_MAX_CONCURRENCY
});
