# ZORYQ Adaptive Execution Mesh (AEM) — Research Specification v0.1

Status: **research / not active in consensus or production execution**

Chain target: ZORYQ EVM Testnet, Chain ID `5919065` (`0x5a5159`)

## 1. Purpose

ZORYQ Adaptive Execution Mesh (AEM) is a research architecture for routing an ordered EVM transaction set through different execution strategies while preserving one deterministic canonical state.

The goal is **not** to claim that parallel EVM execution is new. Aptos Block-STM and Monad already demonstrate optimistic parallel execution and conflict-driven re-execution; Sui exploits an object-centric dependency model; other high-performance chains optimize execution, storage, consensus and networking together.

AEM is intended to test a stronger question:

> Can an EVM-compatible protocol deterministically classify transaction dependency/risk, select the cheapest safe execution strategy, stream progressively stronger execution evidence, generate proof artifacts where useful, and apply MEV-resistant ordering constraints — while remaining serial-equivalent and degrading safely under adversarial contention?

No novelty claim is made until the mechanism is implemented, benchmarked against relevant baselines and reviewed independently.

## 2. Non-negotiable invariants

AEM MUST preserve these invariants before any production activation:

1. **Serial equivalence** — the final state, receipt status, logs, gas semantics and contract-visible effects MUST equal the canonical serial EVM execution of the same ordered transactions.
2. **Deterministic commit order** — adaptive scheduling MAY change when speculative work is performed, but MUST NOT silently change the canonical transaction order.
3. **Machine independence** — consensus-critical results MUST NOT depend on local CPU count, RAM pressure, thread timing, wall-clock race order or other validator-local performance signals.
4. **Speculation isolation** — speculative results MUST NOT mutate canonical state before validation/commit.
5. **Nonce correctness** — same-sender nonce ordering remains canonical and deterministic.
6. **Revert parity** — transactions that revert in canonical serial execution MUST revert identically under AEM.
7. **Proof separation** — an execution proof is evidence of computation; it MUST NOT be presented as consensus finality unless the consensus protocol itself defines that guarantee.
8. **Safe degradation** — when dependency confidence is insufficient or contention is excessive, AEM MUST fall back to a safe serial path rather than guess.
9. **No hidden EVM dialect** — unmodified EVM bytecode and normal Ethereum JSON-RPC semantics remain the compatibility target unless a future protocol version explicitly changes them.

## 3. Canonical model

For an ordered block transaction list:

`T = [T0, T1, ... Tn]`

and pre-state `S0`, define the reference result as:

`SerialEVM(S0, T) -> (Sn, Receipts, Logs)`

AEM is valid only if:

`AEM(S0, T) == SerialEVM(S0, T)`

for all consensus-observable outputs.

The scheduler is therefore an optimization layer around canonical execution semantics, not a second source of truth.

## 4. Execution lanes

AEM v0.1 defines four conceptual execution lanes. The initial implementation may begin as an offline simulator before any lane is connected to the execution client.

### Lane A — Deterministic Fast Path

Candidate transactions have high-confidence independence known before execution.

Examples may include:
- simple native transfers with independent sender/recipient sets;
- transactions with reliable declared access lists and no conflicting writes;
- pre-profiled contracts whose access behavior can be proven sufficiently constrained for the specific method/version.

A transaction MUST leave this lane if the classifier cannot establish the required safety conditions.

### Lane B — Speculative Parallel Path

Transactions with uncertain or moderate dependency risk execute speculatively in parallel.

Each speculative result carries at minimum:
- canonical transaction index;
- read set / read versions;
- write set;
- receipt candidate;
- gas/result metadata;
- execution digest.

At commit time, the engine validates the read assumptions against the canonical state produced by preceding transactions. Invalidated results are re-executed or moved to the serial safety lane.

### Lane C — Serial Safety Path

High-contention, difficult-to-predict or repeatedly invalidated transactions execute using the canonical serial path.

Typical candidates include:
- same-sender nonce chains;
- high-contention AMM/pool hotspots;
- contracts with highly dynamic storage access;
- proxy/delegatecall paths without a trusted dependency profile;
- transactions that exceed the configured conflict/re-execution threshold;
- any transaction for which the classifier is uncertain.

Lane C is a safety property, not a failure condition.

### Lane D — Proof / Witness Path

Canonical execution MAY emit an asynchronous witness/proof task after the state transition is committed.

Possible future outputs:
- execution witness commitment;
- state-diff commitment;
- receipt/log commitment;
- zk proof or validity proof where practical;
- ZORYQ Proof Pack linkage for Agent Protocol actions.

The first AEM versions should keep proof generation outside the consensus-critical latency path.

## 5. Deterministic Dependency Classifier (DDC)

The classifier is the core research component.

### 5.1 Inputs allowed for consensus-relevant classification

Only deterministic inputs shared by honest nodes may influence consensus-relevant classification, for example:
- canonical transaction bytes;
- sender and nonce;
- destination / contract-creation marker;
- value;
- calldata selector;
- EIP-2930 access list when present;
- target code hash;
- deterministic protocol configuration at the current epoch/version;
- deterministic historical contract profile committed by protocol rules, if such a mechanism is introduced.

### 5.2 Inputs forbidden from consensus-relevant classification

The canonical result MUST NOT depend on:
- current CPU utilization;
- local RAM pressure;
- local thread count;
- arrival order in a node's mempool;
- local network latency;
- non-replicated machine-learning output;
- nondeterministic wall-clock scheduling.

Local resource information MAY tune how much speculative work a node performs only if canonical commit semantics remain identical.

### 5.3 Dependency descriptor

A candidate transaction may be represented by a descriptor:

```text
DependencyDescriptor {
  tx_index,
  sender,
  nonce,
  target,
  code_hash,
  selector,
  declared_reads,
  declared_writes,
  predicted_reads,
  predicted_writes,
  confidence,
  contention_score,
  proof_requirement,
  execution_class
}
```

Predicted sets are optimization hints only until validated by actual execution.

## 6. Conflict graph and deterministic scheduling

For a transaction batch, AEM builds an optimization graph whose vertices are transactions and whose edges represent potential ordering dependencies.

A potential conflict exists when, among other rules:
- one transaction may write a location another may read or write;
- transactions share a sender with nonce dependence;
- contract creation/address derivation creates an ordering dependency;
- protocol-specific semantics require ordering.

The graph is allowed to overestimate conflicts. False positives reduce parallelism but preserve safety. False negatives MUST be detected before canonical commit and trigger re-execution/fallback.

A deterministic lane decision can be represented as:

`lane(Ti) = F(protocol_version, canonical_metadata, dependency_descriptor)`

The exact function `F` must be versioned and test-vector driven before it becomes protocol-critical.

## 7. Canonical commit algorithm

AEM v0.1 research target:

1. Receive an already canonical ordered transaction list.
2. Build deterministic dependency descriptors.
3. Assign speculative execution lanes.
4. Execute independent/speculative candidates concurrently.
5. Commit strictly according to canonical transaction index.
6. Before committing a speculative result, validate its read set/version assumptions.
7. If valid, commit its write set and receipt.
8. If invalid, re-execute against the current canonical state.
9. If the transaction repeatedly conflicts or exceeds policy thresholds, move it to serial safety execution.
10. Produce the same final state and receipts as canonical serial EVM.

The scheduler MAY optimize work ordering; the commit layer is the authority.

## 8. Adaptive policy

The word **adaptive** means the engine changes execution strategy based on deterministic dependency/conflict evidence, not that consensus rules change according to machine load.

Candidate policy inputs:
- predicted conflict probability;
- actual conflict rate for earlier transactions in the same deterministic batch;
- number of invalidated speculative reads;
- same-sender chains;
- contract/method dependency profile;
- proof/witness requirement;
- estimated execution cost derived deterministically.

Initial example policy:

```text
known-disjoint              -> Fast Path
low/medium conflict risk    -> Speculative Parallel
high conflict risk          -> Serial Safety
re-execution threshold hit  -> Serial Safety
canonical commit complete   -> optional Proof/Witness
```

Thresholds MUST be protocol-versioned when they affect consensus-visible behavior. Purely local performance thresholds may vary only when they cannot change canonical results.

## 9. Streaming confirmation semantics

AEM should make confirmation strength explicit instead of presenting all intermediate states as final.

Candidate lifecycle:

1. `accepted` — transaction accepted by the gateway/mempool; no inclusion guarantee.
2. `ordered` — transaction has a canonical block position/proposal context; execution may still be pending.
3. `executed` — a speculative execution result exists; **not yet canonical**.
4. `committed` — execution has been validated and committed to the node's canonical state.
5. `safe` — consensus-specific safe-head semantics when supported.
6. `finalized` — consensus-specific finalized-head semantics when supported.
7. `proof_attested` — optional execution proof/witness is available.

On the current ZORYQ centralized test environment, labels MUST accurately reflect the actual Reth/dev-mode guarantees and MUST NOT imply decentralized BFT finality.

## 10. MEV policy research track

AEM must not claim native MEV protection merely because it schedules transactions differently.

The research track should compare at least:
- first-seen / canonical proposer ordering baseline;
- deterministic priority policy;
- deterministic randomized ordering from a consensus-known seed;
- commit-reveal or order-then-reveal designs;
- encrypted mempool / threshold decryption designs as a later research option;
- private-orderflow risks and censorship trade-offs.

The scheduler must never use secret local ordering information in a way that creates validator divergence.

MEV metrics should include:
- profitable reorder opportunities detected in benchmark workloads;
- sandwichable transaction rate;
- ordering-policy variance;
- censorship/fairness properties;
- added latency from protection mechanisms.

## 11. Proof-aware execution research track

The proof path should be modular.

Phase 1:
- hash commitments to ordered input set;
- read/write-set commitments;
- state-diff commitment;
- receipt/log commitment;
- reproducible Proof Pack.

Phase 2:
- execution witness generation;
- independent verifier.

Phase 3, only if justified:
- zkVM / zkEVM validity proof experiments;
- recursive aggregation;
- proof marketplace or specialized prover nodes.

Proof cost, latency and hardware requirements must be published alongside any benchmark.

## 12. Benchmark matrix

AEM must be evaluated against at least two baselines:

- **Serial baseline** — canonical serial EVM execution.
- **Always-speculative baseline** — execute every eligible transaction optimistically in parallel, then validate/re-execute conflicts.

AEM is successful only if it improves end-to-end behavior over relevant baselines without changing semantics.

### Required workloads

1. independent native transfers;
2. same-sender nonce contention;
3. independent contract storage partitions;
4. single storage-slot hotspot;
5. ERC-20 independent recipients;
6. ERC-20 hotspot recipient;
7. AMM swaps across independent pools;
8. AMM swaps against one hot pool;
9. lending positions with independent collateral;
10. shared liquidity/interest-index contention;
11. autonomous-agent budget updates with overlapping limits;
12. mixed successful/reverted transactions;
13. proxy/delegatecall paths;
14. dynamic mappings and storage aliasing;
15. contract creation / CREATE2;
16. read-heavy workloads;
17. adversarial conflict bombs designed to defeat the classifier.

### Required contention levels

At minimum: `0%, 1%, 5%, 10%, 25%, 50%, 75%, 100%` conflicting transactions.

### Required concurrency profiles

At minimum: `1, 2, 4, 8, 16` execution workers where hardware permits.

### Required batch sizes

At minimum: `100, 1,000, 10,000` transactions.

### Required metrics

- transactions/second;
- gas/second and Ggas/s;
- median/p95/p99 execution latency;
- scheduler overhead;
- classifier time;
- classifier precision/recall for conflicts;
- speculative execution count;
- invalidation count;
- re-execution count and rate;
- wasted speculative gas-equivalent work;
- lane distribution;
- serial-fallback rate;
- final state digest equality;
- receipt/log equality;
- peak RAM;
- CPU utilization;
- database reads/writes;
- proof/witness latency and size when enabled.

Hardware, OS, execution-client revision, compiler flags, database mode and full workload generator must be published with results.

## 13. Research hypotheses

These are targets, **not current claims**.

### H1 — Conflict efficiency
AEM should reduce unnecessary re-execution relative to the always-speculative baseline on mixed workloads.

### H2 — Bounded scheduler overhead
On low-contention workloads, classifier/scheduler overhead should remain a small fraction of total execution cost.

### H3 — Graceful hotspot degradation
At very high contention, AEM should converge toward serial execution rather than suffer unbounded speculative waste.

### H4 — Serial equivalence
Across every benchmark class, final state and receipt semantics must equal serial reference execution.

### H5 — Useful fast path
For reliably independent transactions, AEM should reduce execution latency and improve CPU utilization versus serial execution.

### H6 — Proof decoupling
Proof/witness generation should be able to run asynchronously without extending canonical commit latency in the default mode.

## 14. Adversarial test requirements

The classifier must be attacked, not just benchmarked under friendly workloads.

Tests should include:
- hidden write dependencies behind delegatecall/proxy chains;
- storage keys derived from calldata and prior state;
- branch-dependent access sets;
- reentrancy-sensitive paths;
- deliberate conflict storms;
- large revert ratios;
- gas-heavy failed speculation;
- same-sender nonce chains submitted concurrently;
- CREATE/CREATE2 address interactions;
- contracts whose code changes through supported EVM semantics/proxy upgrades;
- malformed or misleading access lists.

Any false-negative dependency prediction must be caught by validation before commit.

## 15. Telemetry schema

Every benchmarked block/batch should expose a machine-readable AEM record:

```json
{
  "aemVersion": "0.1-research",
  "chainId": 5919065,
  "blockNumber": 0,
  "orderedTxCount": 0,
  "lanes": {
    "fast": 0,
    "speculative": 0,
    "serial": 0,
    "proof": 0
  },
  "conflicts": 0,
  "invalidations": 0,
  "reexecutions": 0,
  "serialFallbacks": 0,
  "schedulerMicros": 0,
  "executionMicros": 0,
  "serialReferenceEqual": true,
  "inputCommitment": "0x...",
  "resultCommitment": "0x..."
}
```

No public dashboard may label these fields as live network measurements until the actual execution path emits them.

## 16. Integration path with ZORYQ

### Phase A — Research only
- publish this specification;
- extend the existing Serial Equivalence harness;
- create deterministic workload generators;
- implement an offline conflict classifier/scheduler simulator;
- produce reproducible benchmark evidence.

### Phase B — Shadow execution
- execute AEM decisions in parallel with the existing production path;
- NEVER use shadow output as canonical state;
- compare lane decisions, conflicts and state/receipt digests against current Reth execution;
- publish mismatch rate and overhead.

### Phase C — Reth/REVM integration prototype
- integrate at an execution-client extension/custom-node boundary;
- instrument actual read/write sets;
- implement speculative state overlays;
- preserve canonical commit order;
- gate activation behind feature flags and CI evidence.

### Phase D — Testnet opt-in
Only after serial equivalence, crash recovery, adversarial workloads and reproducible benchmark gates are green may AEM participate in canonical testnet execution.

### Phase E — Protocol proposal
If benchmarks show a meaningful advantage, produce:
- formal algorithm specification;
- threat model;
- reproducible paper artifact;
- protocol versioning rules;
- independent review/audit plan;
- public benchmark dashboard.

## 17. Relationship to the ZORYQ product stack

AEM belongs to the **ZORYQ Chain** layer.

```text
ZORYQ Chain
  └─ Adaptive Execution Mesh
       ├─ deterministic dependency classification
       ├─ adaptive execution lanes
       ├─ serial-equivalent canonical commit
       ├─ execution evidence / proofs
       └─ MEV policy research

ZORYQ Agent Protocol
  └─ consumes explicit execution/confirmation/proof states

ZORYQ Autonomous Company
  └─ uses the Agent Protocol to coordinate bounded autonomous actions
```

The Autonomous Company should become a demanding end-to-end workload for AEM: independent agent tasks should parallelize well, while shared treasury/budget updates intentionally exercise contention and safety fallback.

## 18. Claim policy

Until a real execution prototype exists and passes the required evidence gates, public wording should be limited to:

> “ZORYQ is researching an Adaptive Execution Mesh: a deterministic, serial-equivalent execution architecture that aims to route transactions through different execution strategies based on dependency and conflict characteristics. It is experimental and not yet active in the public testnet execution path.”

Do NOT claim:
- production parallel execution;
- proprietary scientific novelty;
- superior TPS/Ggas/s;
- MEV resistance;
- zk-proven execution;
- decentralized finality;

until each statement has direct reproducible evidence.

## 19. External prior art to benchmark against

Research should explicitly compare ideas with:
- Block-STM / Aptos;
- Monad optimistic parallel execution and asynchronous execution;
- Sui object-based dependency/fast-path execution;
- MegaETH real-time execution architecture;
- Ethereum access lists and EVM serial semantics;
- relevant academic work on STM, deterministic databases, OCC/MVCC and parallel smart-contract execution.

The objective is to identify what is genuinely new, what is an engineering combination of existing techniques, and where ZORYQ can demonstrate a measurable advantage.
