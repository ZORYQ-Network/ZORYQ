# ZORYQ Execution Fabric (ZEF)

Status: **RESEARCH ARCHITECTURE — NOT A PRODUCTION CLAIM**

ZORYQ is researching adaptive verifiable execution: a deterministic execution architecture that can classify transaction dependencies, group independent work, detect conflicts, re-execute invalidated candidates, and commit only a canonical result.

This document defines the research architecture and evidence gates required before any stronger public claim is allowed.

## 1. Why this exists

A conventional full node combines several responsibilities: transaction intake, scheduling, state execution, verification, state storage, P2P participation and RPC serving. ZEF investigates whether some of those responsibilities can be separated into verifiable roles without weakening deterministic execution.

ZEF is not "node-less" today. Reth remains the canonical execution reference in the current testnet research path.

## 2. Roles

### Coordinator
Accepts a deterministic transaction batch and binds it to a parent state commitment. It must not be trusted to change transaction content or canonical ordering silently.

### Dependency Analyzer
Produces a deterministic dependency/conflict description for the transaction set. Unknown or dynamic access must fail safe to a serial path.

### Candidate Scheduler
Builds deterministic execution waves from dependency information. Current implementation: `zoryq-developer/verification/candidate-scheduler.mjs`.

### Executor
Receives an immutable execution job and returns a candidate result. An executor is not trusted merely because it returned a result.

### Verifier
Checks candidate output against required commitments/evidence. Initial research verification is deterministic replay / isolated serial-reference comparison.

### Canonical Commit Layer
Accepts only results that satisfy the active evidence policy. The research architecture does not yet replace Reth consensus/state transition.

### State Provider / Archive Provider
Optional future roles for obtaining state/witness data. These are not implemented claims.

## 3. Research message formats

Conceptual input:

```text
ExecutionJob {
  schema_version
  chain_id
  batch_id
  parent_state_commitment
  ordered_transaction_hashes[]
  workload_digest
  scheduler_commitment
  execution_version
}
```

Conceptual output:

```text
ExecutionResult {
  schema_version
  batch_id
  executor_id
  status
  read_set_commitment
  write_set_commitment
  receipt_commitment
  state_delta_commitment
  execution_commitment
  telemetry_commitment
}
```

These schemas become protocol claims only after an implementation exists and passes evidence gates.

## 4. Current verified evidence ladder

### Level 1 — Research simulator
`adaptive-execution-mesh.mjs` models versioned reads/writes, speculative candidates, invalidation, re-execution and serial fallback. This is abstract-model evidence only.

### Level 2 — Deterministic candidate scheduler
`candidate-scheduler.mjs` produces deterministic dependency-aware waves and conflict telemetry. It intentionally does not fabricate EVM re-execution telemetry.

### Level 3A — Native-transfer Reth bridge
`candidate-state-equivalence.mjs` executes a published native-transfer matrix through the candidate scheduler on one isolated Reth node and replays the observed canonical order on another isolated Reth node.

A passing public CI gate supports only: `CANDIDATE_SCHEDULER_STATE_EQUIVALENCE_TRANSFER_MATRIX`.

### Level 3B — Contract-state Reth bridge
`candidate-contract-equivalence.mjs` extends the bridge to contract storage, hot-slot contention, DEX-like reserve updates, agent-budget contention and reverted transactions.

This level is not verified until the corresponding public CI gate passes.

## 5. Required path to real speculative EVM execution

The next implementation must move speculative semantics from the abstract AEM model to an actual EVM state-transition experiment.

Minimum required properties:

1. candidate execution reads from a versioned parent state;
2. actual EVM read/write access is captured or conservatively declared;
3. candidate output is content-bound to the exact signed transaction;
4. canonical commit validates the candidate read versions;
5. invalid candidates are rejected;
6. rejected candidates are re-executed against the updated canonical state;
7. serial fallback is explicit and measurable;
8. final state/receipts match a serial reference for the published workload matrix.

## 6. Telemetry semantics

Telemetry must originate from the execution/scheduling implementation, not from HTTP/RPC request concurrency.

Required fields when available:

- scheduler mode
- transaction count
- execution wave count
- maximum wave width
- conflict count
- invalidation count
- re-execution count
- serial fallback count
- workload digest
- transaction hash set
- execution version
- commit SHA

Unavailable metrics must be `null`/explicitly unavailable rather than fabricated zeroes.

## 7. Multi-process and multi-machine stages

The research path must progress in this order:

1. one-process deterministic model;
2. isolated local Reth nodes;
3. candidate executors in separate OS processes;
4. executors in separate containers;
5. executors on separate machines;
6. independently operated executor/verifier;
7. adversarial executor testing.

Moving work to a second process/container controlled by the same operator does not prove decentralization.

## 8. Independent Node 2 path remains active

ZEF does not eliminate the need to test conventional independent nodes.

The traditional path must still verify:

- identical chain identity/genesis;
- real P2P connectivity;
- `peers > 0`;
- block propagation;
- restart/state recovery;
- independent operator/infrastructure evidence.

This provides a baseline against which modular execution can later be compared.

## 9. Fault model

ZEF must eventually test at least:

- executor offline;
- executor timeout;
- malformed result;
- incorrect state delta;
- stale parent commitment;
- hidden dependency/conflict;
- duplicate/replayed result;
- conflicting executors;
- scheduler bug;
- process crash before commit;
- process crash during commit;
- network partition.

The safe default is rejection/fallback, never acceptance of unverifiable state.

## 10. Claim boundary

Until evidence gates pass, ZORYQ must not claim:

- proven parallel EVM execution;
- production speculative execution;
- decentralized execution fabric;
- node-less blockchain;
- superior throughput/performance;
- consensus safety from ZEF;
- mainnet readiness.

The defensible current research statement is:

> ZORYQ is researching adaptive verifiable execution and is publishing reproducible evidence gates for deterministic scheduling and serial-equivalence experiments.

## 11. Evidence gate ladder

- `ZORYQ Candidate Scheduler Evidence`
- `ZORYQ Candidate Scheduler State Equivalence`
- `ZORYQ Candidate Contract State Equivalence`
- future: `ZORYQ Speculative EVM Reexecution Evidence`
- future: `ZORYQ Parallel EVM Execution Evidence`
- future: `ZORYQ Multi-Process Execution Evidence`
- future: `ZORYQ Multi-Machine Execution Evidence`
- future: `ZORYQ Independent Operator Evidence`
- future: `ZORYQ Adversarial Execution Evidence`

A later gate may depend on earlier gates, but must never weaken them merely to become green.
