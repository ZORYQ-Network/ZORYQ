const DEFAULT_RPC = 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID = 5919065;

async function rpc(url, method, params = []) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params })
  });
  if (!res.ok) throw new Error(`RPC ${res.status}`);
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || 'RPC error');
  return body.result;
}

function hexToNumber(hex) {
  return Number.parseInt(hex, 16);
}

export async function verifyEndpoint(url = DEFAULT_RPC) {
  const chainHex = await rpc(url, 'eth_chainId');
  const chainId = hexToNumber(chainHex);
  if (chainId !== CHAIN_ID) throw new Error(`Unexpected chainId ${chainId}`);

  const latest = await rpc(url, 'eth_getBlockByNumber', ['latest', false]);
  if (!latest || !latest.hash || !latest.number || !latest.parentHash) {
    throw new Error('Incomplete block header');
  }
  return {
    url,
    chainId,
    blockNumber: hexToNumber(latest.number),
    blockHash: latest.hash,
    parentHash: latest.parentHash,
    timestamp: hexToNumber(latest.timestamp)
  };
}

export async function witnessRound(endpoints) {
  const unique = [...new Set((endpoints || []).filter(Boolean))];
  if (!unique.length) unique.push(DEFAULT_RPC);
  const settled = await Promise.allSettled(unique.map(verifyEndpoint));
  const healthy = settled.filter(x => x.status === 'fulfilled').map(x => x.value);
  const failed = settled.filter(x => x.status === 'rejected').map(x => String(x.reason));
  const heights = healthy.map(x => x.blockNumber);
  const maxHeight = heights.length ? Math.max(...heights) : null;
  const nearTip = maxHeight === null ? [] : healthy.filter(x => maxHeight - x.blockNumber <= 2);
  const hashVotes = new Map();
  for (const h of nearTip) {
    const key = `${h.blockNumber}:${h.blockHash}`;
    hashVotes.set(key, (hashVotes.get(key) || 0) + 1);
  }
  const agreement = [...hashVotes.entries()].sort((a,b) => b[1]-a[1])[0] || null;
  return {
    ok: healthy.length > 0,
    independentAgreement: unique.length >= 2 && agreement && agreement[1] >= 2,
    endpointCount: unique.length,
    healthyCount: healthy.length,
    failedCount: failed.length,
    bestBlock: maxHeight,
    agreement: agreement ? { checkpoint: agreement[0], votes: agreement[1] } : null,
    healthy,
    failed,
    checkedAt: new Date().toISOString()
  };
}
