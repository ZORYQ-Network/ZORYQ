# ZORYQ Serial Equivalence Evidence Gate

Status: **research gate / not yet proven**

ZORYQ is researching adaptive verifiable execution — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state.

This document defines the evidence required before ZORYQ may claim that an adaptive or parallel execution path is serially equivalent to canonical serial execution.

## Claim boundary

Passing this gate would demonstrate equivalence only for the workloads, implementation version, environment, and state-transition cases exercised by the reproducible test suite. It would **not** by itself prove production readiness, consensus safety, decentralization, finality, arbitrary-program equivalence, or mainnet readiness.

Until the gate exists and passes, public materials must not claim proven parallel execution or proven serial equivalence.

## Required experiment

For every test vector, execute the exact same ordered transaction set from the exact same initial state in two isolated environments:

1. **Canonical serial baseline** — transactions executed strictly in canonical order.
2. **Candidate adaptive/parallel path** — the execution mechanism under evaluation.

Both runs must use identical chain configuration, genesis/state fixture, transaction bytes, block/environment inputs, software revision, and deterministic randomness inputs where applicable.

## Required equality checks

A vector passes only when both paths produce identical observable state-transition results, including at minimum:

- post-execution state root;
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

The reproducible suite should cover at least:

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
- serial result digest;
- candidate-path result digest;
- per-vector equality report;
- environment metadata needed to reproduce the run;
- final PASS/FAIL summary.

Artifacts should be content-addressed or accompanied by SHA-256 digests so independent developers can verify that published evidence has not changed.

## CI policy

The future workflow should fail closed. Missing results, malformed artifacts, unsupported vectors, timeouts, nondeterministic output, or any state/result mismatch must be failures. Performance numbers must be reported separately from correctness: a faster candidate path does not pass unless equivalence passes first.

## Promotion gate

Only after a reproducible implementation of this experiment passes may ZORYQ upgrade wording from **researching adaptive/verifiable execution** to a narrowly scoped statement that serial equivalence was demonstrated for the published test matrix and software revision.

The next engineering step is to implement the serial baseline runner, candidate-path runner, deterministic workload fixtures, comparison tool, and GitHub Actions workflow that emits the evidence bundle described above.
