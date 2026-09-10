# ADR-001 — AEM Shadow Execution Before Canonical Integration

Date: 2026-09-10

Status: **Accepted for research phase**

## Context

ZORYQ is researching Adaptive Execution Mesh (AEM): deterministic classification of EVM workloads into execution strategies intended to reduce wasted speculative work while preserving serial semantics.

The current public testnet uses Reth as its execution client. AEM has a specification, deterministic simulator and CI research gate, but no real REVM read/write-set instrumentation and no reproduced performance advantage.

Connecting a research scheduler directly to canonical execution before those properties are measured would turn a performance experiment into a consensus/state-integrity risk.

## Decision

AEM will first run as a **read-only shadow observer**.

The canonical authority remains the existing Reth execution path. Shadow AEM:

- may read canonical blocks and transaction metadata;
- may create deterministic dependency descriptors;
- may conservatively predict dependency edges and execution lanes;
- may calculate commitments/digests and research telemetry;
- may compare predictions with later instrumentation;
- may write research artifacts outside the Reth state database.

Shadow AEM MUST NOT:

- submit transactions;
- access faucet funds;
- hold a funded private key;
- alter transaction ordering;
- alter Reth configuration or chain spec;
- mutate `/data/reth`;
- determine receipts/state roots;
- influence fork choice, safe head or finalized head;
- cause chain health to fail when the observer itself fails.

Every shadow artifact must include:

- `status: "research"`;
- `canonical: false`;
- evidence class;
- Chain ID;
- classifier version;
- source block number/hash;
- deterministic commitments;
- explicit limitations.

## Why this decision

This creates a falsifiable bridge between the current metadata simulator and eventual Reth/REVM integration. It lets ZORYQ collect real workload structure without creating a second source of truth.

It also creates a clean rollback: disable/remove the observer with no state migration and no chain reset.

## Alternatives considered

### Integrate directly into Reth/REVM now

Rejected. Real state-access instrumentation, conflict validation, overlay semantics, benchmarks and adversarial gates are not yet sufficient.

### Run an entirely separate private devnet

Useful later, but insufficient alone. The shadow observer can learn from the actual public-testnet workload while remaining non-authoritative.

### Use AI to classify transactions live

Rejected for consensus-relevant decisions. Non-deterministic model output may assist offline research, but cannot determine canonical execution behavior.

### Always execute every transaction speculatively

Retained only as a benchmark baseline. AEM specifically needs to prove whether selective speculation can reduce wasted work.

## Consequences

Positive:

- zero consensus/state risk from the first live AEM prototype;
- real block metadata for research;
- deterministic evidence artifacts;
- simple rollback;
- direct path to measuring classifier quality once real read/write instrumentation is added.

Negative:

- shadow results do not improve live TPS or latency;
- metadata-only dependency prediction has limited ground truth;
- additional telemetry consumes some CPU/network resources and must be bounded.

## Exit criteria for the shadow-only phase

Moving toward an opt-in execution prototype requires all of the following:

1. deterministic shadow digest across repeated runs and machines;
2. same-sender/nonces never incorrectly treated as independent;
3. unknown dynamic contracts fail conservative;
4. real REVM read/write-set instrumentation available;
5. serial state/receipt/log equivalence on required workloads;
6. measurable benefit against serial and always-speculative baselines;
7. bounded overhead under low contention;
8. graceful degradation under 100% contention;
9. State Recovery remains green;
10. Public/Production Smoke remain green;
11. multi-node devnet evidence exists;
12. Red Team review completed;
13. rollback plan tested.

Only then may a separate ADR propose canonical AEM participation.