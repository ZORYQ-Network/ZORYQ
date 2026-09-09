# ZORYQ Conformance & Reproducible Benchmark Specification

Status: engineering specification — not a performance claim.

## Objective

Make ZORYQ measurable before making it marketable. Every performance, compatibility, finality, validator, agent-security or reliability claim must be backed by a reproducible artifact that an external engineer can run without privileged access.

## Gate A — EVM/RPC conformance

The public network must continuously prove:

- `eth_chainId` = `0x5a5159` (5919065);
- native value transfer and receipts;
- Solidity contract creation;
- `eth_call` and state reads;
- ERC-20 transfer semantics;
- ERC-721 mint/ownership semantics;
- logs and indexed event retrieval;
- JSON-RPC batch behavior;
- explicit rejection of privileged development RPC methods on the public gateway;
- deterministic error codes for malformed/unsupported requests.

A future conformance suite should add a versioned Ethereum JSON-RPC method matrix and upstream execution-spec fixtures where compatible.

## Gate B — correctness under concurrency

Parallel execution cannot be claimed until the implementation proves serial equivalence for conflicting state transitions.

Required workload classes:

1. independent transfers across disjoint accounts;
2. same-sender nonce contention;
3. many writers to one storage slot;
4. independent contract storage partitions;
5. ERC-20 hotspot recipient contention;
6. DEX-like reserve updates;
7. agent batches with overlapping budgets/allowances;
8. reverted transactions mixed with successful transactions.

For every run record:

- ordered transaction input set;
- execution result / receipt set;
- post-state root or equivalent deterministic state digest;
- conflict count;
- re-execution count;
- failed/reverted transaction count;
- serial reference result;
- equality assertion between parallel and serial final state.

## Gate C — latency and finality

Do not use a single latency number. Report distributions.

Required metrics:

- RPC ingress → accepted latency: p50 / p95 / p99;
- accepted → included latency: p50 / p95 / p99;
- included → final latency: p50 / p95 / p99;
- end-to-end submission → finality: p50 / p95 / p99;
- block/slot interval distribution;
- reorg count and maximum observed reorg depth;
- failed transaction ratio.

Finality must have an explicit protocol definition. A fast RPC response is not finality.

## Gate D — throughput

Benchmark at increasing offered load until saturation. Report both offered and successful throughput.

Workloads:

- native transfers;
- ERC-20 transfers;
- storage-heavy contract calls;
- event/log-heavy calls;
- mixed realistic workload;
- conflict-heavy workload;
- read-heavy RPC workload.

For each point publish:

- transactions submitted per second;
- successful transactions per second;
- gas/compute per second where meaningful;
- p50/p95/p99 latency;
- CPU, memory, disk I/O and network usage;
- queue depth/backpressure;
- error/revert rate.

Never report generated requests as executed TPS.

## Gate E — reproducibility manifest

Every published benchmark must include:

- exact ZORYQ commit SHA;
- node/client version;
- benchmark harness commit SHA;
- genesis/config hash;
- machine CPU model and core count;
- RAM;
- disk type;
- OS/kernel/container runtime;
- node count and geographic placement;
- network latency/bandwidth assumptions;
- workload seed and duration;
- warm-up period;
- raw machine-readable results;
- command used to reproduce the run.

A result without this manifest is internal telemetry, not a public benchmark.

## Gate F — multi-node / validator resilience

Before claiming external or permissionless validators, prove an independently operated node can join using only public documentation.

Test matrix:

- clean node bootstrap;
- catch-up from an older state;
- node restart and recovery;
- one validator/node offline;
- delayed messages / artificial latency;
- temporary network partition;
- invalid peer messages;
- disk pressure / process restart;
- version mismatch behavior;
- state agreement after recovery.

Record recovery time, availability, state agreement and any safety/liveness failure.

## Gate G — agent/account security

The agentic thesis needs stronger evidence than ordinary wallet UX.

Required negative tests:

- method outside allowlist rejected;
- target outside allowlist rejected;
- asset outside allowlist rejected;
- spend over budget rejected;
- expired permission rejected;
- rate limit exceeded rejected;
- replayed authorization rejected;
- revoked permission rejected;
- slippage/price guard violation rejected;
- simulation mismatch fails closed;
- sponsorship quota abuse rejected.

Every delegated execution should eventually produce an inspectable receipt linking permission, simulation, execution and revocation state.

## Gate H — public-network reliability

Track over rolling windows:

- RPC availability;
- health endpoint availability;
- explorer availability;
- faucet availability without consuming funds in monitoring;
- chain-ID consistency;
- head progression;
- RPC error ratio;
- resource saturation;
- restart/deployment events.

Target SLOs must be declared before calling the network production-grade.

## Evidence ladder

Use these labels consistently:

1. **DESIGNED** — specification exists.
2. **IMPLEMENTED** — code exists.
3. **CI VERIFIED** — deterministic automated tests pass.
4. **PUBLICLY VERIFIED** — public endpoint/network passes the same checks.
5. **EXTERNALLY REPRODUCED** — independent operator reproduces the result.
6. **AUDITED** — relevant implementation has independent security review.

No feature should jump directly from DESIGNED to a marketing claim.

## Competitive acceptance bar

ZORYQ should consider itself competitive with leading real-time/parallel/agentic EVM networks only when it can publish an evidence bundle containing:

- EVM conformance results;
- serial-equivalence concurrency results;
- latency/finality distributions;
- saturation throughput curves;
- multi-node fault results;
- public-network uptime data;
- agent permission negative-test results;
- raw results and reproduction commands;
- independent reproduction and audit links when available.

The goal is not to win a benchmark screenshot. The goal is to make ZORYQ's strongest claims independently falsifiable and reproducible.