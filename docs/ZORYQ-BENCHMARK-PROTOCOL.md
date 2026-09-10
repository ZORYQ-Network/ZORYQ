# ZORYQ Public Benchmark Protocol

Status: testnet benchmark methodology
Chain ID: 5919065

## Principle

ZORYQ only publishes measured values. Observed load, synthetic capacity and production capacity must never be presented as the same metric.

## Required environment disclosure

Every benchmark result must publish:

- ZORYQ commit hash and release name
- Reth version and exact runtime flags
- chain ID and genesis fingerprint
- node count and topology
- CPU limit and CPU model when available
- RAM limit
- persistent disk type/size
- region/provider
- RPC gateway configuration and concurrency limits
- transaction type mix
- sender/account count
- duration and warm-up period

## Load ladder

1. Baseline: live public testnet observation, no synthetic traffic.
2. Stage A: 1,000,000 signed transactions.
3. Stage B: 10,000,000 signed transactions.
4. Stage C: 100,000,000 signed transactions.

A stage advances only if chain state remains consistent and the previous stage finishes without crash loop, state rollback, persistent health failure or memory exhaustion.

## Mandatory measurements

- accepted transactions
- rejected transactions and reason
- sustained TPS
- peak TPS
- block time average, p50, p95 and p99
- RPC submission latency p50, p95 and p99
- receipt/finality latency p50, p95 and p99
- gas throughput in Ggas/s
- block gas utilization
- CPU average and peak
- RAM average and peak
- disk growth
- database/state growth
- total blocks produced
- total transactions included
- error rate
- restart/crash count
- chain reorg/rollback count
- uptime during test

## Integrity rules

- Do not call an empty-chain block rate "TPS capacity".
- Do not extrapolate one-block bursts into sustained TPS.
- Do not omit failed/rejected requests.
- Do not compare results across different hardware without publishing both environments.
- Do not reset `/data/reth/db` between stages unless the published test explicitly declares a fresh-genesis methodology.
- Production-linked tests must preserve Chain ID 5919065.
- Faucet funds are not used as benchmark traffic.

## Public evidence package

Each completed run should publish:

- raw load-generator output
- timestamped telemetry
- hardware/container limits
- test configuration
- transaction generator source
- block range
- start/end state roots where practical
- summary JSON/CSV
- charts generated from the raw dataset
- known limitations

## ZORYQ target

The immediate goal is not a marketing TPS number. The goal is a reproducible benchmark that outside developers can independently inspect and rerun. A competitive capacity claim is published only after sustained controlled load has been demonstrated without compromising state integrity or reliability.
