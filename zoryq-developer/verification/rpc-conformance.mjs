#!/usr/bin/env node

/**
 * ZORYQ Gate A JSON-RPC conformance harness.
 *
 * This suite is deliberately read-only against the configured endpoint. It does
 * not submit transactions, request faucet funds, mine blocks, or call admin
 * surfaces. Results are emitted as JSON for reproducible evidence bundles.
 */

const RPC = process.env.ZORYQ_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const EXPECTED_CHAIN_ID = process.env.ZORYQ_CHAIN_ID || '0x5a5159';
const EXPECTED_NET_VERSION = process.env.ZORYQ_NET_VERSION || '5919065';
const TIMEOUT_MS = Number(process.env.ZORYQ_RPC_TIMEOUT_MS || 10000);

let nextId = 1;

function isHexQuantity(value) {
  return typeof value === 'string' && /^0x(?:0|[1-9a-f][0-9a-f]*)$/i.test(value);
}

async function post(payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(RPC, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`non-JSON response: HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
    return { httpStatus: response.status, body, latencyMs: performance.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method, params = []) {
  const id = nextId++;
  const result = await post({ jsonrpc: '2.0', id, method, params });
  if (Array.isArray(result.body)) throw new Error(`${method}: expected object response`);
  if (result.body?.id !== id) throw new Error(`${method}: response id mismatch`);
  return result;
}

function requireRpcError(result, expectedCodes, label) {
  const error = result.body?.error;
  if (!error || !Number.isInteger(error.code)) {
    throw new Error(`${label}: expected JSON-RPC error, got ${JSON.stringify(result.body)}`);
  }
  if (!expectedCodes.includes(error.code)) {
    throw new Error(`${label}: expected error code ${expectedCodes.join(' or ')}, got ${error.code}`);
  }
  return { code: error.code, message: String(error.message || '') };
}

const checks = [];
async function check(name, fn) {
  const started = performance.now();
  try {
    const evidence = await fn();
    checks.push({ name, status: 'PASS', durationMs: +(performance.now() - started).toFixed(3), evidence });
  } catch (error) {
    checks.push({ name, status: 'FAIL', durationMs: +(performance.now() - started).toFixed(3), error: error.message });
  }
}

await check('chain identity', async () => {
  const chain = await rpc('eth_chainId');
  const network = await rpc('net_version');
  if (chain.body?.result !== EXPECTED_CHAIN_ID) throw new Error(`eth_chainId expected ${EXPECTED_CHAIN_ID}, got ${chain.body?.result}`);
  if (network.body?.result !== EXPECTED_NET_VERSION) throw new Error(`net_version expected ${EXPECTED_NET_VERSION}, got ${network.body?.result}`);
  return { chainId: chain.body.result, netVersion: network.body.result };
});

await check('head and canonical block shape', async () => {
  const head = await rpc('eth_blockNumber');
  if (!isHexQuantity(head.body?.result)) throw new Error(`invalid block number quantity: ${head.body?.result}`);
  const block = await rpc('eth_getBlockByNumber', [head.body.result, false]);
  const b = block.body?.result;
  if (!b || b.number !== head.body.result || typeof b.hash !== 'string' || !/^0x[0-9a-f]{64}$/i.test(b.hash)) {
    throw new Error(`invalid canonical block response: ${JSON.stringify(b)}`);
  }
  return { number: b.number, hash: b.hash };
});

await check('read RPC primitives', async () => {
  const zero = '0x0000000000000000000000000000000000000000';
  const balance = await rpc('eth_getBalance', [zero, 'latest']);
  const nonce = await rpc('eth_getTransactionCount', [zero, 'latest']);
  const code = await rpc('eth_getCode', [zero, 'latest']);
  const call = await rpc('eth_call', [{ to: zero, data: '0x' }, 'latest']);
  const logs = await rpc('eth_getLogs', [{ fromBlock: 'latest', toBlock: 'latest' }]);
  if (!isHexQuantity(balance.body?.result)) throw new Error('eth_getBalance did not return a hex quantity');
  if (!isHexQuantity(nonce.body?.result)) throw new Error('eth_getTransactionCount did not return a hex quantity');
  if (typeof code.body?.result !== 'string' || !code.body.result.startsWith('0x')) throw new Error('eth_getCode did not return hex data');
  if (typeof call.body?.result !== 'string' || !call.body.result.startsWith('0x')) throw new Error('eth_call did not return hex data');
  if (!Array.isArray(logs.body?.result)) throw new Error('eth_getLogs did not return an array');
  return { balance: balance.body.result, nonce: nonce.body.result, code: code.body.result, call: call.body.result, logCount: logs.body.result.length };
});

await check('JSON-RPC batch behavior', async () => {
  const a = nextId++;
  const b = nextId++;
  const result = await post([
    { jsonrpc: '2.0', id: a, method: 'eth_chainId', params: [] },
    { jsonrpc: '2.0', id: b, method: 'eth_blockNumber', params: [] },
  ]);
  if (!Array.isArray(result.body) || result.body.length !== 2) throw new Error(`expected two batch responses, got ${JSON.stringify(result.body)}`);
  const byId = new Map(result.body.map((entry) => [entry.id, entry]));
  if (byId.get(a)?.result !== EXPECTED_CHAIN_ID) throw new Error('batch eth_chainId mismatch');
  if (!isHexQuantity(byId.get(b)?.result)) throw new Error('batch eth_blockNumber invalid');
  return { responseCount: result.body.length, httpStatus: result.httpStatus };
});

await check('privileged development RPC methods rejected', async () => {
  const methods = [
    ['evm_mine', []],
    ['hardhat_setBalance', ['0x0000000000000000000000000000000000000000', '0x1']],
    ['anvil_setBalance', ['0x0000000000000000000000000000000000000000', '0x1']],
  ];
  const rejected = [];
  for (const [method, params] of methods) {
    const result = await rpc(method, params);
    const error = requireRpcError(result, [-32601], method);
    rejected.push({ method, code: error.code });
  }
  return rejected;
});

await check('unsupported method is deterministic', async () => {
  const method = 'zoryq_conformanceDefinitelyUnsupported';
  const first = requireRpcError(await rpc(method), [-32601], 'unsupported#1');
  const second = requireRpcError(await rpc(method), [-32601], 'unsupported#2');
  if (first.code !== second.code) throw new Error(`nondeterministic error codes: ${first.code} vs ${second.code}`);
  return { code: first.code };
});

await check('invalid params are deterministic', async () => {
  const first = requireRpcError(await rpc('eth_getBalance', []), [-32602], 'invalid params#1');
  const second = requireRpcError(await rpc('eth_getBalance', []), [-32602], 'invalid params#2');
  if (first.code !== second.code) throw new Error(`nondeterministic error codes: ${first.code} vs ${second.code}`);
  return { code: first.code };
});

const passed = checks.filter((x) => x.status === 'PASS').length;
const failed = checks.length - passed;
const report = {
  schemaVersion: 1,
  suite: 'zoryq-gate-a-rpc-conformance',
  endpoint: RPC,
  readOnly: true,
  expected: { chainId: EXPECTED_CHAIN_ID, netVersion: EXPECTED_NET_VERSION },
  generatedAt: new Date().toISOString(),
  node: process.version,
  summary: { total: checks.length, passed, failed },
  checks,
};

console.log(JSON.stringify(report, null, 2));
if (failed > 0) process.exit(1);
