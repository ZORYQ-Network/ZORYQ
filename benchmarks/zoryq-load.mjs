#!/usr/bin/env node
import { JsonRpcProvider, Wallet } from 'ethers';
import fs from 'node:fs';

const RPC = process.env.ZORYQ_BENCH_RPC || 'https://zoryq-evm-node-live-production.up.railway.app/rpc';
const CHAIN_ID = 5919065;
const TOTAL = Number(process.env.ZORYQ_BENCH_TXS || 1000);
const CONCURRENCY = Math.max(1, Math.min(256, Number(process.env.ZORYQ_BENCH_CONCURRENCY || 8)));
const PRIVATE_KEY = process.env.ZORYQ_BENCH_PRIVATE_KEY || '';
const CONFIRM = process.env.ZORYQ_BENCH_CONFIRM === 'YES_I_UNDERSTAND_THIS_SENDS_TRANSACTIONS';

if (!Number.isSafeInteger(TOTAL) || TOTAL < 1) throw new Error('ZORYQ_BENCH_TXS must be a positive integer');
if (!PRIVATE_KEY) throw new Error('Set ZORYQ_BENCH_PRIVATE_KEY to a funded dedicated benchmark account');
if (!CONFIRM) throw new Error('Refusing to send load. Set ZORYQ_BENCH_CONFIRM=YES_I_UNDERSTAND_THIS_SENDS_TRANSACTIONS');

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet = new Wallet(PRIVATE_KEY, provider);
const network = await provider.getNetwork();
if (Number(network.chainId) !== CHAIN_ID) throw new Error(`Unexpected chain ID ${network.chainId}`);

const startBlock = await provider.getBlockNumber();
const start = performance.now();
const latencies = [];
let accepted = 0, rejected = 0, cursor = 0;
const errors = {};

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a,b)=>a-b);
  return s[Math.min(s.length - 1, Math.floor((s.length - 1) * p))];
}

async function worker() {
  while (true) {
    const i = cursor++;
    if (i >= TOTAL) return;
    const t0 = performance.now();
    try {
      const tx = await wallet.sendTransaction({ to: wallet.address, value: 0n, data: '0x' });
      await tx.wait(1);
      accepted++;
      latencies.push(performance.now() - t0);
    } catch (e) {
      rejected++;
      const key = String(e?.shortMessage || e?.code || e?.message || 'unknown').slice(0,160);
      errors[key] = (errors[key] || 0) + 1;
    }
    if ((i + 1) % 1000 === 0) console.error(`progress ${i + 1}/${TOTAL} accepted=${accepted} rejected=${rejected}`);
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));
const end = performance.now();
const endBlock = await provider.getBlockNumber();
const seconds = (end - start) / 1000;
const result = {
  schema: 'zoryq-benchmark-v1',
  measuredAt: new Date().toISOString(),
  rpc: RPC,
  chainId: CHAIN_ID,
  sender: wallet.address,
  requestedTransactions: TOTAL,
  concurrency: CONCURRENCY,
  acceptedTransactions: accepted,
  rejectedTransactions: rejected,
  durationSeconds: seconds,
  submittedAndConfirmedTPS: accepted / Math.max(seconds, 0.001),
  confirmationLatencyMs: {
    p50: pct(latencies, .50),
    p95: pct(latencies, .95),
    p99: pct(latencies, .99),
    max: latencies.length ? Math.max(...latencies) : null
  },
  blockRange: { start: startBlock, end: endBlock, produced: Math.max(0, endBlock - startBlock) },
  errorRate: TOTAL ? rejected / TOTAL : 0,
  errors
};
const out = process.env.ZORYQ_BENCH_OUT || `zoryq-benchmark-${Date.now()}.json`;
fs.writeFileSync(out, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.error(`wrote ${out}`);
