# ZORYQ Serial Equivalence Evidence Gate

Status: **research gate / candidate scheduler implemented, parallel EVM execution not yet proven**

ZORYQ is researching adaptive verifiable execution — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state.

This document defines the evidence required before ZORYQ may claim that an adaptive or parallel execution path is serially equivalent to canonical serial execution.

## Current verified architecture

The current ZORYQ testnet uses Reth as its execution client. Public JavaScript gateways can control JSON-RPC traffic but do not own Reth's internal EVM state-transition scheduler. Gateway concurrency therefore must never be described as parallel EVM execution.

ZORYQ now also contains an experimental **candidate scheduling layer** at `zoryq-developer/verification/candidate-scheduler.mjs`. It deterministically derives conflict resources, groups non-conflicting transactions into scheduling waves, records real scheduler decisions, and emits machine-readable conflict telemetry. Conflicting transactions are deferred into later waves instead of being misrepresented as speculative parallel state execution.

The candidate scheduler evidence proves only scheduler behavior. It does **not** prove that Reth executes EVM state transitions in parallel.

## Claim boundary

A full Gate B pass requires the candidate scheduling/execution experiment to preserve the same canonical observable state transition as a serial Reth reference while also providing non-fabricated scheduler/conflict evidence.

Passing the scheduler-only gate demonstrates only that ZORYQ has an auditable dependency-aware candidate scheduler for the published fixture matrix. It does **not** by itself prove production readiness, consensus safety, decentralization, finality, arbitrary-program equivalence, performance superiority, internal parallel EVM execution, or mainnet readiness.

## Candidate scheduler evidence

The scheduler publishes at minimum:

- scheduler name and mode;
- transaction count;
- deterministic scheduling-wave count;
- maximum independent wave width;
- concrete conflict pairs and conflicting resource keys;
- conflict count;
- explicit re-execution count;
- serial-isolation/fallback count and reason;
- workload digest;
- claim-boundary text.

A conflicting fixture must produce `conflictCount > 0`. The gate explicitly requires `reexecutionCount == 0` until actual speculative execution and re-execution are implemented, preventing fabricated telemetry.

## Required full experiment

For every test vector, execute the exact same ordered transaction set from the exact same initial state in two isolated environments:

1. **Canonical serial baseline** — transactions executed strictly in canonical order.
2. **Candidate scheduling/execution path** — ZORYQ's explicit candidate scheduler/executor under evaluation.

Both runs must use identical chain configuration, genesis/state fixture, transaction bytes, block/environment inputs, software revision, and deterministic randomness inputs where applicable.

## Required equality checks

A vector passes only when both paths produce identical observable state-transition results, including at minimum:

- post-execution state digest/root where available;
- transaction success/revert status in canonical order;
- receipts root or an equivalent deterministic receipt digest;
- logs/events and their canonical ordering;
- account nonces and balances for touched accounts;
- deployed contract addresses and code hashes;
- storage values for touched slots;
- gas used per transaction and cumulative gas when execution rules require equality;
- block-level execution outputs that are part of deterministic state transition.

Any mismatch fails the gate. The CI must never rewrite expected outputs merely to make the test green.

## Minimum workload matrix

| Workload | Why it matters |
| --- | --- |
| Independent ETH transfers | baseline non-conflicting work |
| Same-sender nonce chain | ordering dependency |
| Many senders to one receiver | shared-account contention |
| Independent contract storage | parallel-friendly state |
| Same-slot writes | direct write/write conflict |
| Read-after-write | dependency detection |
| Write-after-read | stale-read protection |
| Contract deployment + calls | address/code/state dependency |
| Reverts mixed with successes | failure semantics |
| Event-heavy transactions | deterministic log ordering |
| Hot-account / hot-contract burst | contention fallback behavior |
| Mixed workload | scheduler/adaptation boundary |

## Reproducibility requirements

Each CI run must publish an evidence artifact containing:

- repository commit SHA;
- execution-engine version and build identifiers;
- chain ID and genesis/state-fixture digest;
- workload/vector manifest digest;
- exact transaction hashes or signed transaction fixture digest;
- candidate scheduler telemetry;
- serial result digest;
- candidate-path result digest;
- per-vector equality report;
- environment metadata needed to reproduce the run;
- final PASS/FAIL summary.

Artifacts should be content-addressed or accompanied by SHA-256 digests so independent developers can verify that published evidence has not changed.

## CI policy

The workflow must fail closed. Missing results, malformed artifacts, unsupported vectors, timeouts, nondeterministic output, or any state/result mismatch must be failures. Performance numbers must be reported separately from correctness: a faster candidate path does not pass unless equivalence passes first.

## Promotion gate

Only after a reproducible candidate scheduling/execution experiment passes the equality requirements may ZORYQ upgrade wording to a narrowly scoped statement that **candidate-scheduler serial equivalence** was demonstrated for the published matrix and revision.

A stronger claim of **parallel EVM execution** remains prohibited until the execution path itself performs and exposes real parallel/speculative state execution with conflict/re-execution evidence.
