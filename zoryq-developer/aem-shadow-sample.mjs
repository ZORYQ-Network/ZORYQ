#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { analyzeBlock } from './aem-shadow.mjs';

const rpcUrl = process.env.ZORYQ_RPC_URL || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const baseUrl = process.env.ZORYQ_BASE_URL || rpcUrl.replace(/\/rpc\/?$/, '');
const maxLookback = Math.max(1, Math.min(512, Number(process.env.ZORYQ_AEM_LOOKBACK || 128)));
const output = process.env.ZORYQ_AEM_SHADOW_OUT || '';

async function rpc(method, params = []) {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`rpc_http_${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(body.error.message || 'rpc_error');
  return body.result;
}

async function explorerCandidate() {
  try {
    const response = await fetch(`${baseUrl}/explorer/transactions?page=1&limit=1&order=desc`);
    if (!response.ok) return null;
    const body = await response.json();
    const tx = Array.isArray(body?.transactions) ? body.transactions[0] : null;
    if (!tx || tx.blockNumber == null) return null;
    const n = BigInt(tx.blockNumber);
    return { tag: `0x${n.toString(16)}`, blockNumber: n.toString(10), txHash: tx.hash || null };
  } catch {
    return null;
  }
}

async function main() {
  const latestHex = await rpc('eth_blockNumber');
  const latest = BigInt(latestHex);
  let selected = null;

  // Prefer the native Explorer's already-indexed evidence to avoid scanning
  // hundreds/thousands of empty blocks through the public RPC.
  const indexed = await explorerCandidate();
  if (indexed) {
    const result = await analyzeBlock({ rpcUrl, blockTag: indexed.tag });
    if (result.source.transactionCount > 0) {
      selected = {
        ...result,
        sampling: {
          strategy: 'latest-indexed-non-empty',
          latestObserved: latestHex,
          indexedBlockNumber: indexed.blockNumber,
          indexedTxHash: indexed.txHash,
          lookbackBlocks: Number(latest - BigInt(indexed.blockNumber)),
        },
      };
    }
  }

  // Fallback is intentionally bounded so the research observer cannot become
  // an accidental RPC load generator.
  if (!selected) {
    for (let offset = 0n; offset < BigInt(maxLookback) && latest >= offset; offset += 1n) {
      const tag = `0x${(latest - offset).toString(16)}`;
      const result = await analyzeBlock({ rpcUrl, blockTag: tag });
      if (result.source.transactionCount > 0) {
        selected = { ...result, sampling: { strategy: 'bounded-rpc-lookback', latestObserved: latestHex, lookbackBlocks: Number(offset) } };
        break;
      }
    }
  }

  if (!selected) {
    selected = {
      ...(await analyzeBlock({ rpcUrl, blockTag: latestHex })),
      sampling: {
        strategy: 'latest-fallback-no-nonempty-found',
        latestObserved: latestHex,
        maxLookback,
        limitation: 'No non-empty block found via the Explorer index or bounded RPC lookback.',
      },
    };
  }

  const encoded = `${JSON.stringify(selected, null, 2)}\n`;
  if (output) await writeFile(output, encoded, 'utf8');
  process.stdout.write(encoded);
}

main().catch((error) => {
  console.error(`[aem-shadow-sample] ${error?.stack || error}`);
  process.exitCode = 1;
});
