# Adaptive Verifiable Execution — Falsifiable Experiment v0.1

**Status:** research specification, not an implemented capability or performance claim.

## Research question

Can an execution layer select among explicitly defined execution strategies for materially different transaction workloads while preserving deterministic final state and producing enough evidence for an independent engineer to verify the selection and result?

## Why this matters

The ZORYQ research narrative is only useful if it can be falsified. A benchmark that merely produces a high throughput number is insufficient. The experiment must test correctness first, then whether adaptation produces a measurable benefit under controlled workloads.

## Invariants

Every candidate strategy must preserve:

1. identical deterministic post-state for identical ordered input;
2. valid EVM semantics for the tested workload;
3. explicit failure rather than silent divergence;
4. reproducible execution receipts / trace evidence sufficient to identify the selected strategy and workload;
5. no weakening of validation rules to obtain a faster result.

Any state divergence is a failed experiment regardless of throughput.

## Workload classes

### W1 — independent transfers
Accounts send native transfers with no shared sender/receiver state beyond protocol-global requirements. This is intended to expose parallelizable independence if such an implementation exists.

### W2 — shared hot state
Transactions repeatedly modify the same contract/storage slots. This is intentionally conflict-heavy.

### W3 — mixed workload
A controlled mixture of W1 and W2 with a published random seed and distribution.

### W4 — adversarial dependency chain
Each transaction depends on state produced by the preceding transaction. This should prevent unsafe optimistic parallelism from appearing beneficial.

## Baseline

The baseline is a clearly identified serial/reference execution path on the same commit, machine, dataset and configuration. If ZORYQ cannot provide a valid reference path, no comparative performance claim is permitted.

## Candidate adaptive policy

A future prototype may classify a batch using observable dependency/conflict features and select a strategy. The exact classifier, thresholds and fallback rules must be committed before measured results are published. Post-hoc tuning on the reported dataset must be disclosed.

## Required measurements

For each workload and strategy publish:

- commit SHA;
- hardware / OS / runtime versions;
- node count and topology;
- workload generator version and random seed;
- transaction count and duration;
- throughput;
- p50 / p95 / p99 latency where meaningful;
- CPU and peak memory;
- conflict / abort / retry counts where applicable;
- selected strategy and reason;
- pre-state and post-state commitment/hash;
- raw logs/results;
- failures and limitations.

## Pass gates

### Gate A — correctness
All strategies produce the same expected post-state for every workload. Any unexplained divergence fails the gate.

### Gate B — reproducibility
A clean independent environment can run the documented experiment and obtain semantically equivalent results. Exact performance numbers are not required to match across different hardware; correctness must.

### Gate C — adaptation evidence
At least two materially different workloads cause the predeclared policy to choose different execution strategies for a technically justified reason.

### Gate D — useful benefit
On the same environment, the adaptive policy provides a measurable benefit on at least one declared workload without a correctness regression and without hiding regressions on other workloads.

Passing A–C does **not** imply production readiness. Gate D does **not** imply universal performance superiority.

## Failure conditions worth publishing

Negative results are valuable. Publish when:

- adaptation overhead exceeds the benefit;
- conflict detection is too expensive;
- parallel execution loses to serial execution;
- memory use becomes unacceptable;
- classification is unstable;
- deterministic state diverges;
- the policy overfits a benchmark.

## Public evidence pack layout

Future verified runs should live under a versioned directory such as:

`benchmarks/results/ave/<date>-<commit>/`

and include `README.md`, machine-readable raw output, environment metadata and checksums.

## Claim boundary

Until an implementation and evidence pack pass the gates above, the accurate wording remains:

> ZORYQ is researching adaptive verifiable execution — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state.

Do not shorten this into a claim that ZORYQ already has adaptive or parallel execution.