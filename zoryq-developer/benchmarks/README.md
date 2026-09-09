# ZORYQ Benchmark Evidence

This directory defines how ZORYQ performance evidence is produced and how claims may be made.

## Current benchmark

`zoryq-developer/scripts/zoryq-rpc-benchmark.mjs` performs a stepped saturation test against an isolated ZORYQ node. It records:

- offered JSON-RPC requests per second
- completed JSON-RPC requests per second
- total submitted/succeeded/failed
- failure ratio
- p50/p95/p99/min/max latency
- concurrency level
- workload duration
- commit SHA
- runner/runtime/CPU/RAM metadata
- raw error classes

The CI workflow `.github/workflows/zoryq-performance-evidence.yml` builds the repository image, runs a local node, validates chain ID `5919065`, executes the benchmark, captures Docker resource evidence, and uploads the raw result manifest.

## Claim boundary

This benchmark measures **JSON-RPC read throughput**, not executed transaction TPS, block execution throughput, consensus throughput, or finality. Generated requests are never counted as transaction TPS.

A ZORYQ performance claim may move beyond RPC capacity only when the corresponding workload measures successful transaction receipts and state transitions, with exact reproduction inputs and hardware metadata.

## Evidence ladder

1. DESIGNED
2. IMPLEMENTED
3. CI VERIFIED
4. PUBLICLY VERIFIED
5. EXTERNALLY REPRODUCED
6. AUDITED

The benchmark harness starts at IMPLEMENTED. A successful GitHub Actions run moves the exact commit/workload to CI VERIFIED.

## Required next benchmark suites

### Transaction execution

Required workloads:

- native transfers
- ERC-20 transfers
- storage-heavy contracts
- log-heavy contracts
- mixed realistic transactions
- conflict-heavy transactions

Record submitted TPS separately from successful receipt TPS.

### Concurrency correctness

Before ZORYQ claims parallel execution, compare the final state of concurrent workloads to a serial reference for:

- independent transfers
- same-sender nonce contention
- many writers to one storage slot
- independent storage partitions
- ERC-20 hotspot contention
- DEX-like reserve updates
- overlapping agent budgets/allowances
- mixed success/revert batches

### Finality

Finality must be explicitly defined before latency claims are published. Measure independently:

- RPC ingress -> accepted
- accepted -> included
- included -> final
- end-to-end

Each metric must report p50/p95/p99 and reorg/failure observations.

## Reproduction

Local example:

```bash
docker build -t zoryq-bench .
docker run -d --name zoryq-bench -p 8080:8080 zoryq-bench
ZORYQ_BENCH_RPC=http://127.0.0.1:8080/rpc \
ZORYQ_BENCH_CONCURRENCY=1,4,8,16,32,64 \
ZORYQ_BENCH_STEP_SECONDS=8 \
node zoryq-developer/scripts/zoryq-rpc-benchmark.mjs
```

Never run destructive saturation tests against the public production RPC unless a dedicated load-test environment and explicit capacity window exist.
