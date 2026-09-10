#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { analyzeBlock } from './aem-shadow.mjs';

const rpcUrl = process.env.ZORYQ_RPC_URL || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
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

async function main() {
  const latestHex = await rpc('eth_blockNumber');
  const latest = BigInt(latestHex);
  let selected = null;

  for (let offset = 0n; offset < BigInt(maxLookback) && latest >= offset; offset += 1n) {
    const tag = `0x${(latest - offset).toString(16)}`;
    const result = await analyzeBlock({ rpcUrl, blockTag: tag });
    if (result.source.transactionCount > 0) {
      selected = { ...result, sampling: { strategy: 'latest-non-empty', latestObserved: latestHex, lookbackBlocks: Number(offset) } };
      break;
    }
  }

  if (!selected) {
    selected = {
      ...(await analyzeBlock({ rpcUrl, blockTag: latestHex })),
      sampling: {
        strategy: 'latest-fallback-no-nonempty-found',
        latestObserved: latestHex,
        maxLookback,
        limitation: 'No non-empty block found inside the bounded read-only lookback window.',
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
