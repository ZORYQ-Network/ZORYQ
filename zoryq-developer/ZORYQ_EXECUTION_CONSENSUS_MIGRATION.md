# ZORYQ Execution and Consensus Migration

## Why this migration exists

The current public testnet is an EVM-compatible development network whose execution backend is Anvil with a configured 2-second block interval. This is useful for EVM compatibility, contracts, RPC, product development and testnet onboarding, but it is not sufficient evidence for production-grade consensus, permissionless validation, parallel execution or sub-second finality.

ZORYQ should not attempt to compete with high-performance EVM networks by relabeling a development executor. The next architecture must make execution, ordering, finality and validator participation independently measurable.

## Target outcome

ZORYQ evolves from a single development execution process into a modular network with these independently testable layers:

1. **RPC/edge layer** — public request protection, routing, observability and compatibility.
2. **Mempool/admission layer** — deterministic transaction admission, nonce policy, fee policy and backpressure.
3. **Ordering layer** — explicit block/slot proposal rules and auditable transaction ordering.
4. **Execution layer** — deterministic EVM state transition with a defined concurrency model.
5. **Consensus/finality layer** — multiple independent nodes agreeing on canonical state under documented fault assumptions.
6. **State/sync layer** — reproducible bootstrap, catch-up, snapshots and recovery.
7. **Validator/operator layer** — independent operators with keys, peer discovery, health and version compatibility.
8. **Evidence layer** — raw benchmark, fault, reorg, finality and resource data tied to exact commits.

## Mandatory architecture properties

### Deterministic EVM execution

For every accepted block, all honest nodes must derive the same receipts, logs and post-state. Any parallel executor must prove serial equivalence for conflict-heavy workloads before performance claims are published.

### Explicit finality semantics

ZORYQ must distinguish:

- **accepted** — RPC accepted the transaction;
- **included** — transaction exists in a canonical candidate block;
- **confirmed** — confirmation threshold reached;
- **final** — protocol rule says the transaction cannot be reverted without violating the stated fault assumption.

RPC response latency, block time and finality are different measurements.

### Multiple independent nodes

A validator claim requires at least three independently started nodes in automated testing before public claims, then independent operators outside the core deployment for external reproduction.

Required tests:

- clean bootstrap from genesis;
- catch-up after delayed start;
- restart with persisted state;
- one node offline;
- latency injection;
- temporary partition;
- invalid peer input;
- process crash/restart;
- disk/state recovery;
- version mismatch;
- canonical state equality after recovery.

### Permissionless validator boundary

Registration/heartbeat APIs are useful operator telemetry but are not consensus participation. ZORYQ must not describe heartbeat-registered nodes as consensus validators until those nodes actually participate in proposal/attestation/finality rules.

## Performance architecture decision

The current Anvil-backed public testnet remains the compatibility/product network while the next execution/consensus stack is developed on an isolated branch/environment.

The production-candidate executor must satisfy all of the following before replacing the current backend:

- EVM/RPC conformance equal to or better than the current testnet;
- deterministic transaction receipts/state roots;
- measurable block production and finality;
- multi-node synchronization;
- persistence/recovery without privileged manual repair;
- reproducible benchmark harness;
- bounded memory/disk growth under soak;
- explicit behavior under overload;
- no public administrative RPC methods;
- upgrade/version compatibility plan.

## Parallel execution gate

Parallel execution is a target, not a claim. A candidate design may use optimistic concurrency, dependency graphs, access lists or deterministic partitioning, but promotion requires a serial reference oracle.

For each workload, CI must record:

- ordered input transactions;
- serial reference state digest;
- candidate concurrent state digest;
- receipts and logs;
- conflicts;
- retries/re-executions;
- reverts;
- equality assertion.

The gate passes only when serial and concurrent outcomes are identical for every deterministic workload.

## Finality gate

A production-candidate consensus implementation must expose enough state to measure:

- proposal timestamp;
- inclusion timestamp;
- confirmation timestamp;
- finalization timestamp;
- canonical head;
- finalized head;
- reorg count;
- maximum reorg depth.

Benchmarks must report p50/p95/p99 for accepted-to-included, included-to-final and end-to-end finality.

## Migration phases

### Phase 0 — current testnet hardening

Status: active.

Keep current EVM compatibility network stable while collecting operational evidence. Do not introduce high-risk execution changes into the public network.

### Phase 1 — execution candidate

Build an isolated execution candidate with deterministic state-transition tests, transaction benchmark harness and serial-equivalence oracle.

Exit criteria: CI VERIFIED execution correctness and reproducible throughput/latency evidence.

### Phase 2 — multi-node consensus devnet

Run at least three isolated nodes with explicit proposal/finality semantics and automated fault tests.

Exit criteria: state agreement, restart/catch-up, partition recovery and defined finality are CI VERIFIED.

### Phase 3 — external operator devnet

Publish node software, genesis/config hashes and reproducible operator instructions. Add at least one operator outside the core deployment.

Exit criteria: EXTERNALLY REPRODUCED node bootstrap and agreement.

### Phase 4 — public performance testnet

Run load, contention and soak workloads against a dedicated environment. Publish raw results and hardware manifests.

Exit criteria: PUBLICLY VERIFIED performance plus bounded resource growth and reliability SLOs.

### Phase 5 — security and audit readiness

Complete threat models, agent authority enforcement, consensus/economic safety review, audit scope and bug bounty preparation.

## Claim policy

Until the relevant gates pass, the following terms must remain target/prototype/planned rather than factual production claims:

- parallel execution;
- sub-second finality;
- permissionless validators;
- decentralized consensus;
- independently operated validator set;
- production-grade fault tolerance;
- audited consensus;
- sustained transaction TPS above measured receipt throughput.

## Strategic advantage

The objective is not merely to equal competitor headline metrics. ZORYQ should combine independently reproducible execution evidence with scoped AI-agent authority, SocialFi, payments and DeFi. If implemented, this creates a differentiated category: a real-time EVM network where autonomous agents can act with narrow, inspectable and revocable permissions rather than unlimited wallet authority.
