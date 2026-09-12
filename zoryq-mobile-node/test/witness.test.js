import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { verifyEndpoint, witnessRound } from '../src/witness.js';

const GOOD_CHAIN = '0x5a5159'; // 5919065

function block(number = 100, hash = '0xaaa') {
  return {
    number: `0x${number.toString(16)}`,
    hash,
    parentHash: '0xparent',
    timestamp: '0x66e00000'
  };
}

async function rpcServer({ chainId = GOOD_CHAIN, latest = block(), status = 200 } = {}) {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    res.writeHead(status, { 'content-type': 'application/json' });
    if (status !== 200) return res.end(JSON.stringify({ error: 'unavailable' }));
    if (body.method === 'eth_chainId') return res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: chainId }));
    if (body.method === 'eth_getBlockByNumber') return res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: latest }));
    res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { message: 'unsupported' } }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise(resolve => server.close(resolve))
  };
}

test('witnessRound reports failure instead of inventing agreement', async () => {
  const result = await witnessRound(['http://127.0.0.1:1']);
  assert.equal(result.ok, false);
  assert.equal(result.independentAgreement, false);
  assert.equal(result.healthyCount, 0);
});

test('verifyEndpoint rejects wrong chain id', async t => {
  const s = await rpcServer({ chainId: '0x1' });
  t.after(s.close);
  await assert.rejects(() => verifyEndpoint(s.url), /Unexpected chainId 1/);
});

test('verifyEndpoint rejects incomplete or malicious block header', async t => {
  const s = await rpcServer({ latest: { number: '0x64', hash: '', parentHash: '' } });
  t.after(s.close);
  await assert.rejects(() => verifyEndpoint(s.url), /Incomplete block header/);
});

test('two independent endpoints must agree on exact height and hash', async t => {
  const a = await rpcServer({ latest: block(100, '0xabc') });
  const b = await rpcServer({ latest: block(100, '0xabc') });
  t.after(a.close); t.after(b.close);
  const result = await witnessRound([a.url, b.url]);
  assert.equal(result.ok, true);
  assert.equal(result.healthyCount, 2);
  assert.equal(result.independentAgreement, true);
  assert.deepEqual(result.agreement, { checkpoint: '100:0xabc', votes: 2 });
});

test('conflicting RPC hashes never produce independent agreement', async t => {
  const a = await rpcServer({ latest: block(100, '0xaaa') });
  const b = await rpcServer({ latest: block(100, '0xbbb') });
  t.after(a.close); t.after(b.close);
  const result = await witnessRound([a.url, b.url]);
  assert.equal(result.ok, true);
  assert.equal(result.healthyCount, 2);
  assert.equal(result.independentAgreement, false);
});

test('one healthy endpoint plus one outage is observable but not independent agreement', async t => {
  const a = await rpcServer({ latest: block(101, '0xdef') });
  t.after(a.close);
  const result = await witnessRound([a.url, 'http://127.0.0.1:1']);
  assert.equal(result.ok, true);
  assert.equal(result.healthyCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.independentAgreement, false);
});

test('duplicate endpoint cannot fake multi-RPC independence', async t => {
  const a = await rpcServer({ latest: block(102, '0xdup') });
  t.after(a.close);
  const result = await witnessRound([a.url, a.url]);
  assert.equal(result.endpointCount, 1);
  assert.equal(result.independentAgreement, false);
});
