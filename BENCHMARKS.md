# ZORYQ Benchmark Policy

Performance claims are accepted only when they are reproducible and tied to an exact implementation state.

## No benchmark without context

Every published benchmark must record:

- commit hash;
- CPU;
- RAM;
- storage;
- operating system;
- compiler/runtime versions;
- node count;
- network topology and region;
- protocol configuration;
- transaction/workload definition;
- warm-up method;
- measurement duration;
- raw results;
- aggregation method;
- known limitations.

## Metrics

Depending on the component, measure:

- throughput;
- p50 / p95 / p99 latency;
- confirmation and finality latency;
- CPU and memory;
- disk and state growth;
- network bandwidth;
- sync/recovery time;
- execution conflicts;
- failure/retry rate.

## Required benchmark classes

As implementation becomes available, organize benchmarks under `benchmarks/` for:

- micro;
- macro;
- execution;
- state;
- consensus;
- networking;
- contention;
- congestion isolation;
- recovery;
- adversarial/failure scenarios.

## Fair comparisons

Competitor comparisons must use documented, reasonable configurations. Do not deliberately weaken another system to make ZORYQ appear faster.

Where configurations are not comparable, state that explicitly.

## Claims vocabulary

- **Target:** desired future performance.
- **Measured:** reproduced in a documented environment.
- **Testnet result:** observed on a named testnet configuration.
- **Independent result:** reproduced externally with evidence.

Do not convert a target into a measured claim.

## Release gate

Performance optimization must never override correctness. A faster implementation that causes state divergence, invalid transaction acceptance, broken recovery or security regression is a failed result.
