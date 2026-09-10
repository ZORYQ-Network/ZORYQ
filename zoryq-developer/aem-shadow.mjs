#!/usr/bin/env node
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const AEM_SHADOW_VERSION = '0.1.0-metadata-shadow';
export const ZORYQ_CHAIN_ID = 5919065;
export const ZORYQ_CHAIN_HEX = '0x5a5159';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function digest(value) {
  return `0x${createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')}`;
}

function normAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) return null;
  return value.toLowerCase();
}

function normHex(value, fallback = '0x0') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]*$/.test(value)) return fallback;
  if (value === '0x' || value === '0x0') return value === '0x' ? '0x' : '0x0';
  const stripped = value.slice(2).replace(/^0+/, '') || '0';
  return `0x${stripped.toLowerCase()}`;
}

function selector(input) {
  if (typeof input !== 'string' || !input.startsWith('0x') || input.length < 10) return null;
  return input.slice(0, 10).toLowerCase();
}

function normalizeAccessList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((entry) => ({
    address: normAddress(entry?.address),
    storageKeys: Array.isArray(entry?.storageKeys)
      ? entry.storageKeys.map((key) => String(key).toLowerCase()).sort()
      : [],
  })).filter((entry) => entry.address).sort((a, b) => a.address.localeCompare(b.address));
}

function accessTokens(accessList) {
  const out = new Set();
  for (const entry of accessList) {
    out.add(`account:${entry.address}`);
    for (const key of entry.storageKeys) out.add(`slot:${entry.address}:${key}`);
  }
  return out;
}

export function describeTransaction(tx, index, codeClass = 'unknown') {
  const from = normAddress(tx?.from);
  const to = normAddress(tx?.to);
  const input = typeof tx?.input === 'string' ? tx.input.toLowerCase() : '0x';
  const accessList = normalizeAccessList(tx?.accessList);
  const simpleTransfer = Boolean(from && to && input === '0x' && codeClass === 'eoa');

  return {
    index,
    hash: typeof tx?.hash === 'string' ? tx.hash.toLowerCase() : `fixture:${index}`,
    from,
    nonce: normHex(tx?.nonce),
    to,
    value: normHex(tx?.value),
    gas: normHex(tx?.gas),
    type: normHex(tx?.type),
    selector: selector(input),
    inputBytes: input.startsWith('0x') ? Math.max(0, (input.length - 2) / 2) : 0,
    accessList,
    codeClass,
    simpleTransfer,
    contractCreation: tx?.to == null,
  };
}

function intersects(a, b) {
  for (const item of a) if (b.has(item)) return true;
  return false;
}

export function dependencyReason(a, b) {
  if (a.from && b.from && a.from === b.from) return 'same_sender_nonce_chain';

  // Native value transfers mutate sender/recipient account state. Treat overlap
  // conservatively even though many balance additions commute algebraically.
  const accountsA = new Set([a.from, a.to].filter(Boolean));
  const accountsB = new Set([b.from, b.to].filter(Boolean));
  if (intersects(accountsA, accountsB)) return 'account_overlap';

  if (a.contractCreation || b.contractCreation) return 'contract_creation_unknown_dependency';

  const accessA = accessTokens(a.accessList);
  const accessB = accessTokens(b.accessList);
  if (accessA.size && accessB.size && intersects(accessA, accessB)) return 'declared_access_overlap';

  if (a.to && b.to && a.to === b.to && (a.codeClass === 'contract' || b.codeClass === 'contract')) {
    return 'shared_contract_target';
  }

  return null;
}

export function classify(descriptors) {
  const edges = [];
  const degree = new Array(descriptors.length).fill(0);
  for (let i = 0; i < descriptors.length; i += 1) {
    for (let j = i + 1; j < descriptors.length; j += 1) {
      const reason = dependencyReason(descriptors[i], descriptors[j]);
      if (!reason) continue;
      edges.push({ from: i, to: j, reason });
      degree[i] += 1;
      degree[j] += 1;
    }
  }

  const lanes = descriptors.map((d, index) => {
    let lane = 'serial';
    let reason = 'conservative_unknown';
    let confidence = 'low';

    if (d.contractCreation) {
      lane = 'serial';
      reason = 'contract_creation';
    } else if (d.codeClass === 'unknown') {
      lane = 'serial';
      reason = 'target_code_unknown';
    } else if (d.simpleTransfer && degree[index] === 0) {
      lane = 'fast';
      reason = 'disjoint_simple_eoa_transfer';
      confidence = 'high';
    } else if (degree[index] === 0 && d.codeClass === 'contract' && d.accessList.length > 0) {
      lane = 'speculative';
      reason = 'declared_access_no_predicted_overlap';
      confidence = 'medium';
    } else if (degree[index] === 0 && d.codeClass === 'eoa') {
      lane = 'fast';
      reason = 'disjoint_eoa_account_set';
      confidence = 'high';
    } else if (degree[index] <= 1 && d.codeClass === 'contract') {
      lane = 'speculative';
      reason = 'bounded_predicted_conflict';
      confidence = 'low';
    } else {
      lane = 'serial';
      reason = degree[index] > 1 ? 'high_predicted_contention' : 'conservative_fallback';
      confidence = degree[index] > 1 ? 'medium' : 'low';
    }

    // Same-sender chains are never eligible for the fast path.
    if (edges.some((edge) => edge.reason === 'same_sender_nonce_chain' && (edge.from === index || edge.to === index))) {
      lane = 'serial';
      reason = 'same_sender_nonce_chain';
      confidence = 'high';
    }

    return { index, hash: d.hash, lane, reason, confidence, predictedConflictDegree: degree[index] };
  });

  return { edges, lanes };
}

async function rpc(url, method, params = []) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`rpc_http_${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`rpc_${method}_${body.error.code ?? 'error'}:${body.error.message ?? 'unknown'}`);
  return body.result;
}

async function classifyCodeTargets(rpcUrl, blockTag, transactions) {
  const targets = [...new Set(transactions.map((tx) => normAddress(tx?.to)).filter(Boolean))].sort();
  const out = new Map();
  for (const target of targets) {
    try {
      const code = await rpc(rpcUrl, 'eth_getCode', [target, blockTag]);
      out.set(target, typeof code === 'string' && code !== '0x' ? 'contract' : 'eoa');
    } catch {
      out.set(target, 'unknown');
    }
  }
  return out;
}

export async function analyzeBlock({ rpcUrl, blockTag = 'latest' }) {
  const chainId = await rpc(rpcUrl, 'eth_chainId');
  if (String(chainId).toLowerCase() !== ZORYQ_CHAIN_HEX) throw new Error(`chain_id_mismatch:${chainId}`);

  const block = await rpc(rpcUrl, 'eth_getBlockByNumber', [blockTag, true]);
  if (!block || !Array.isArray(block.transactions)) throw new Error('block_unavailable');
  const canonicalTag = block.number || blockTag;
  const codeClasses = await classifyCodeTargets(rpcUrl, canonicalTag, block.transactions);
  const descriptors = block.transactions.map((tx, index) => describeTransaction(tx, index, codeClasses.get(normAddress(tx?.to)) || 'unknown'));
  const { edges, lanes } = classify(descriptors);
  const laneCounts = lanes.reduce((acc, item) => {
    acc[item.lane] = (acc[item.lane] || 0) + 1;
    return acc;
  }, { fast: 0, speculative: 0, serial: 0 });

  const core = {
    aemVersion: AEM_SHADOW_VERSION,
    chainId: ZORYQ_CHAIN_ID,
    source: {
      blockNumber: canonicalTag,
      blockHash: block.hash || null,
      parentHash: block.parentHash || null,
      transactionCount: descriptors.length,
    },
    evidenceClass: 'metadata-shadow',
    status: 'research',
    canonical: false,
    classifier: {
      deterministic: true,
      realReadWriteInstrumentation: false,
      aiConsensusInput: false,
      limitations: [
        'metadata-only prediction',
        'access lists are hints, not complete state-access proofs',
        'dynamic contract storage access is not known until future REVM instrumentation',
        'shadow decisions do not affect Reth execution or consensus',
      ],
    },
    descriptors,
    dependencyEdges: edges,
    lanes,
    laneCounts,
  };

  return {
    ...core,
    inputCommitment: digest({ blockHash: block.hash, orderedHashes: descriptors.map((d) => d.hash) }),
    descriptorCommitment: digest(descriptors),
    resultCommitment: digest({ edges, lanes }),
  };
}

export function runSelfTest() {
  const mk = (hash, from, to, nonce = '0x0', input = '0x') => ({ hash, from, to, nonce, value: '0x1', gas: '0x5208', type: '0x2', input, accessList: [] });
  const a = '0x0000000000000000000000000000000000000001';
  const b = '0x0000000000000000000000000000000000000002';
  const c = '0x0000000000000000000000000000000000000003';
  const d = '0x0000000000000000000000000000000000000004';
  const contract = '0x00000000000000000000000000000000000000aa';

  const independent = [
    describeTransaction(mk('0x01', a, b), 0, 'eoa'),
    describeTransaction(mk('0x02', c, d), 1, 'eoa'),
  ];
  const first = classify(independent);
  const second = classify(independent);
  assert.equal(digest(first), digest(second), 'same input must produce same schedule digest');
  assert.deepEqual(first.lanes.map((x) => x.lane), ['fast', 'fast']);

  const nonceChain = [
    describeTransaction(mk('0x03', a, b, '0x1'), 0, 'eoa'),
    describeTransaction(mk('0x04', a, d, '0x2'), 1, 'eoa'),
  ];
  const nonceResult = classify(nonceChain);
  assert(nonceResult.lanes.every((x) => x.lane === 'serial'), 'same-sender nonce chain must not enter fast path');

  const dynamicContract = [describeTransaction(mk('0x05', a, contract, '0x3', '0x12345678'), 0, 'contract')];
  const dynamicResult = classify(dynamicContract);
  assert.notEqual(dynamicResult.lanes[0].lane, 'fast', 'unknown contract storage behavior must not enter fast path');

  const unknown = [describeTransaction(mk('0x06', a, b), 0, 'unknown')];
  assert.equal(classify(unknown).lanes[0].lane, 'serial', 'unknown target code must fail conservative');

  const orderDigestA = digest(independent.map((d) => d.hash));
  const orderDigestB = digest([...independent].reverse().map((d) => d.hash));
  assert.notEqual(orderDigestA, orderDigestB, 'canonical order must influence the digest');

  const evidence = {
    status: 'research',
    canonical: false,
    evidenceClass: 'metadata-shadow',
    deterministicDigest: digest({ first, nonceResult, dynamicResult }),
  };
  assert.equal(evidence.canonical, false);
  return evidence;
}

async function main() {
  if (process.argv.includes('--self-test')) {
    console.log(JSON.stringify({ ok: true, ...runSelfTest() }, null, 2));
    return;
  }

  const rpcUrl = process.env.ZORYQ_RPC_URL || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
  const blockTag = process.env.ZORYQ_AEM_BLOCK || 'latest';
  const output = process.env.ZORYQ_AEM_SHADOW_OUT || '';
  const result = await analyzeBlock({ rpcUrl, blockTag });
  const encoded = `${JSON.stringify(result, null, 2)}\n`;
  if (output) await writeFile(output, encoded, 'utf8');
  process.stdout.write(encoded);
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  main().catch((error) => {
    console.error(`[aem-shadow] ${error?.stack || error}`);
    process.exitCode = 1;
  });
}
