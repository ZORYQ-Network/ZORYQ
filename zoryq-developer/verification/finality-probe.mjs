import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { HDNodeWallet, JsonRpcProvider, parseEther } = require('../../zoryq-evm-node/node_modules/ethers');

const RPC = process.env.ZORYQ_RPC || 'http://127.0.0.1:8080/rpc';
const BASE = process.env.ZORYQ_BASE || RPC.replace(/\/rpc$/, '');
const CHAIN_ID = Number(process.env.ZORYQ_CHAIN_ID || 5919065);
const MNEMONIC = process.env.TEST_MNEMONIC || 'test test test test test test test test test test test junk';
const OUT = process.env.ZORYQ_FINALITY_OUT || 'finality-probe-results.json';
const SAMPLES = Math.max(1, Number(process.env.ZORYQ_FINALITY_SAMPLES || 12));
const POLL_MS = Math.max(25, Number(process.env.ZORYQ_FINALITY_POLL_MS || 100));
const TIMEOUT_MS = Math.max(5000, Number(process.env.ZORYQ_FINALITY_TIMEOUT_MS || 60000));

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const wallet = (index) => HDNodeWallet.fromPhrase(MNEMONIC, undefined, `m/44'/60'/0'/0/${index}`).connect(provider);

async function rpc(method, params = []) {
  const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: `${method}-${Date.now()}`, method, params }) });
  const body = await response.json();
  if (body.error) throw Object.assign(new Error(body.error.message || 'rpc_error'), { rpcError: body.error });
  return body.result;
}

async function optionalBlockTag(tag) {
  const started = performance.now();
  try {
    const block = await rpc('eth_getBlockByNumber', [tag, false]);
    return { tag, supported: true, blockNumber: block?.number ?? null, blockHash: block?.hash ?? null, latencyMs: Number((performance.now() - started).toFixed(3)), interpretation: 'execution_client_capability_only' };
  } catch (error) {
    return { tag, supported: false, errorCode: error?.rpcError?.code ?? null, error: error?.message || String(error), latencyMs: Number((performance.now() - started).toFixed(3)), interpretation: 'unsupported_or_unavailable' };
  }
}

async function faucet(address) {
  const response = await fetch(`${BASE}/faucet/claim`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address }) });
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `faucet claim failed ${response.status}: ${JSON.stringify(body)}`);
  assert.equal(body?.ok, true, `faucet claim did not report success: ${JSON.stringify(body)}`);
  return body;
}

async function waitReceipt(hash) {
  const started = performance.now();
  while (performance.now() - started < TIMEOUT_MS) {
    const receipt = await rpc('eth_getTransactionReceipt', [hash]);
    if (receipt?.blockHash && receipt?.blockNumber) return { receipt, observedAt: performance.now() };
    await sleep(POLL_MS);
  }
  throw new Error(`receipt inclusion timed out: ${hash}`);
}

function percentile(values, p) { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)); return Number(sorted[index].toFixed(3)); }
function distribution(values) { return { samples: values.length, p50: percentile(values, 50), p95: percentile(values, 95), p99: percentile(values, 99), min: values.length ? Number(Math.min(...values).toFixed(3)) : null, max: values.length ? Number(Math.max(...values).toFixed(3)) : null }; }

async function main() {
  const network = await provider.getNetwork();
  assert.equal(Number(network.chainId), CHAIN_ID);
  const sender = wallet(5);
  const receiver = wallet(6);
  await faucet(sender.address);
  const safeCapability = await optionalBlockTag('safe');
  const finalizedCapability = await optionalBlockTag('finalized');
  const acceptanceLatencies = [], inclusionAfterAcceptanceLatencies = [], endToEndInclusionLatencies = [], samples = [];
  for (let i = 0; i < SAMPLES; i += 1) {
    const ingressAt = performance.now();
    const tx = await sender.sendTransaction({ to: receiver.address, value: parseEther('0.000001') });
    const acceptedAt = performance.now();
    const { receipt, observedAt: includedObservedAt } = await waitReceipt(tx.hash);
    acceptanceLatencies.push(acceptedAt - ingressAt); inclusionAfterAcceptanceLatencies.push(includedObservedAt - acceptedAt); endToEndInclusionLatencies.push(includedObservedAt - ingressAt);
    samples.push({ index: i, txHash: tx.hash, accepted: true, receiptBlockNumber: receipt.blockNumber, receiptBlockHash: receipt.blockHash, receiptStatus: receipt.status, rpcIngressToAcceptedMs: Number((acceptedAt - ingressAt).toFixed(3)), acceptedToIncludedObservedMs: Number((includedObservedAt - acceptedAt).toFixed(3)), submissionToIncludedObservedMs: Number((includedObservedAt - ingressAt).toFixed(3)), includedToFinalMs: null, submissionToFinalityMs: null, finalityObserved: false });
  }
  const blocks = new Map();
  for (const sample of samples) if (!blocks.has(sample.receiptBlockNumber)) { const block = await rpc('eth_getBlockByNumber', [sample.receiptBlockNumber, false]); blocks.set(sample.receiptBlockNumber, { number: block?.number ?? sample.receiptBlockNumber, hash: block?.hash ?? null, parentHash: block?.parentHash ?? null, timestamp: block?.timestamp ?? null }); }
  const result = { schemaVersion: 1, generatedAt: new Date().toISOString(), chainId: CHAIN_ID, semanticsDocument: 'zoryq-developer/ZORYQ_FINALITY_SEMANTICS.md', scope: 'acceptance_and_inclusion_measurement_plus_execution_client_block_tag_capability', capabilities: { safeBlockTag: safeCapability, finalizedBlockTag: finalizedCapability }, latency: { rpcIngressToAcceptedMs: distribution(acceptanceLatencies), acceptedToIncludedObservedMs: distribution(inclusionAfterAcceptanceLatencies), submissionToIncludedObservedMs: distribution(endToEndInclusionLatencies), includedToFinalMs: { samples: 0, p50: null, p95: null, p99: null }, submissionToFinalityMs: { samples: 0, p50: null, p95: null, p99: null } }, samples, observedBlocks: [...blocks.values()], reorgObservation: { status: 'NOT_PROVEN_BY_SHORT_SINGLE_NODE_PROBE', reorgCount: null, maximumObservedReorgDepth: null }, protocolFinalityDefinitionAvailable: false, gateCStatus: 'BLOCKED_PROTOCOL_FINALITY_UNDEFINED', claimPolicy: 'Safe/finalized JSON-RPC block tags, if supported by the execution client, are capabilities only. They do not establish ZORYQ protocol finality. This probe intentionally leaves finality latency null until a protocol-level finality rule and multi-node fault assumptions are implemented and evidenced.' };
  await writeFile(OUT, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUT, samples: SAMPLES, latency: result.latency, capabilities: result.capabilities, gateCStatus: result.gateCStatus }, null, 2));
  assert.equal(result.protocolFinalityDefinitionAvailable, false); assert.equal(result.latency.includedToFinalMs.samples, 0); assert.equal(result.latency.submissionToFinalityMs.samples, 0); assert.equal(result.gateCStatus, 'BLOCKED_PROTOCOL_FINALITY_UNDEFINED');
}

main().catch(async (error) => { const failure = { schemaVersion: 1, generatedAt: new Date().toISOString(), gateCStatus: 'PROBE_FAILURE', error: error?.stack || String(error) }; await writeFile(OUT, `${JSON.stringify(failure, null, 2)}\n`).catch(() => {}); console.error(error); process.exit(1); });
