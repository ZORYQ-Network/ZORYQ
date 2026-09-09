import fs from 'node:fs';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

const RPC_URL = process.env.ZORYQ_BENCH_RPC || 'http://127.0.0.1:8080/rpc';
const EXPECTED_CHAIN_ID = process.env.ZORYQ_BENCH_CHAIN_ID || '0x5a5159';
const STEP_SECONDS = Number(process.env.ZORYQ_BENCH_STEP_SECONDS || 10);
const CONCURRENCY_STEPS = String(process.env.ZORYQ_BENCH_CONCURRENCY || '1,4,8,16,32')
  .split(',').map(Number).filter(n => Number.isInteger(n) && n > 0);
const OUTPUT = process.env.ZORYQ_BENCH_OUTPUT || 'zoryq-benchmark-results.json';
const TIMEOUT_MS = Number(process.env.ZORYQ_BENCH_TIMEOUT_MS || 10000);
const WARMUP_REQUESTS = Number(process.env.ZORYQ_BENCH_WARMUP || 20);

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return Number(sorted[idx].toFixed(3));
}

async function rpc(method, params = []) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    const text = await response.text();
    const elapsed = performance.now() - started;
    let body;
    try { body = JSON.parse(text); } catch { body = null; }
    const ok = response.ok && body && !body.error && body.result !== undefined;
    return { ok, status: response.status, latencyMs: elapsed, error: ok ? null : body?.error?.message || text.slice(0, 160) || 'invalid_response' };
  } catch (error) {
    return { ok: false, status: 0, latencyMs: performance.now() - started, error: error?.name === 'AbortError' ? 'timeout' : String(error?.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function assertChain() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(RPC_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 99, method: 'eth_chainId', params: [] }), signal: controller.signal,
    });
    const body = await response.json();
    if (body.result !== EXPECTED_CHAIN_ID) throw new Error(`chain id mismatch: expected ${EXPECTED_CHAIN_ID}, got ${body.result}`);
  } finally { clearTimeout(timer); }
}

async function warmup() {
  for (let i = 0; i < WARMUP_REQUESTS; i++) await rpc(i % 2 ? 'eth_blockNumber' : 'eth_chainId');
}

async function runStep(concurrency) {
  const endAt = performance.now() + STEP_SECONDS * 1000;
  const latencies = [];
  const errors = new Map();
  let submitted = 0;
  let succeeded = 0;
  let failed = 0;

  async function worker(workerId) {
    let i = 0;
    while (performance.now() < endAt) {
      const method = (i + workerId) % 3 === 0 ? 'eth_chainId' : (i + workerId) % 3 === 1 ? 'eth_blockNumber' : 'eth_getBalance';
      const params = method === 'eth_getBalance' ? ['0x0000000000000000000000000000000000000000', 'latest'] : [];
      submitted++;
      const result = await rpc(method, params);
      latencies.push(result.latencyMs);
      if (result.ok) succeeded++;
      else {
        failed++;
        errors.set(result.error || 'unknown', (errors.get(result.error || 'unknown') || 0) + 1);
      }
      i++;
    }
  }

  const startedAt = performance.now();
  await Promise.all(Array.from({ length: concurrency }, (_, i) => worker(i)));
  const elapsedSeconds = (performance.now() - startedAt) / 1000;
  return {
    concurrency,
    durationSeconds: Number(elapsedSeconds.toFixed(3)),
    submitted,
    succeeded,
    failed,
    offeredRps: Number((submitted / elapsedSeconds).toFixed(2)),
    successfulRps: Number((succeeded / elapsedSeconds).toFixed(2)),
    failureRatio: submitted ? Number((failed / submitted).toFixed(6)) : 0,
    latencyMs: {
      min: latencies.length ? Number(Math.min(...latencies).toFixed(3)) : null,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      p99: percentile(latencies, 99),
      max: latencies.length ? Number(Math.max(...latencies).toFixed(3)) : null,
    },
    errors: Object.fromEntries([...errors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)),
  };
}

await assertChain();
await warmup();

const steps = [];
for (const concurrency of CONCURRENCY_STEPS) {
  const result = await runStep(concurrency);
  steps.push(result);
  console.log(`[zoryq-bench] c=${concurrency} ok=${result.succeeded}/${result.submitted} rps=${result.successfulRps} p95=${result.latencyMs.p95}ms p99=${result.latencyMs.p99}ms`);
}

const best = [...steps].sort((a, b) => b.successfulRps - a.successfulRps)[0] || null;
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  claimPolicy: 'This benchmark measures completed JSON-RPC read requests. It does not represent executed transaction TPS or consensus finality.',
  target: { rpcUrl: RPC_URL.replace(/\/[^/]*$/, '/rpc'), expectedChainId: EXPECTED_CHAIN_ID },
  workload: {
    type: 'mixed-json-rpc-read',
    methods: ['eth_chainId', 'eth_blockNumber', 'eth_getBalance'],
    stepSeconds: STEP_SECONDS,
    concurrencySteps: CONCURRENCY_STEPS,
    warmupRequests: WARMUP_REQUESTS,
    timeoutMs: TIMEOUT_MS,
  },
  environment: {
    gitSha: process.env.GITHUB_SHA || process.env.ZORYQ_COMMIT_SHA || null,
    runner: process.env.GITHUB_ACTIONS === 'true' ? 'github-actions' : 'local',
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpuModel: os.cpus()[0]?.model || null,
    cpuLogicalCount: os.cpus().length,
    memoryBytes: os.totalmem(),
    hostname: os.hostname(),
  },
  summary: {
    peakSuccessfulRpcRps: best?.successfulRps || 0,
    peakConcurrency: best?.concurrency || null,
    peakP95Ms: best?.latencyMs?.p95 ?? null,
    peakP99Ms: best?.latencyMs?.p99 ?? null,
    totalSubmitted: steps.reduce((n, s) => n + s.submitted, 0),
    totalSucceeded: steps.reduce((n, s) => n + s.succeeded, 0),
    totalFailed: steps.reduce((n, s) => n + s.failed, 0),
  },
  steps,
};

fs.writeFileSync(OUTPUT, JSON.stringify(manifest, null, 2) + '\n');
console.log(`[zoryq-bench] wrote ${OUTPUT}`);
if (manifest.summary.totalFailed > 0 && process.env.ZORYQ_BENCH_FAIL_ON_ERROR === 'true') process.exitCode = 1;
