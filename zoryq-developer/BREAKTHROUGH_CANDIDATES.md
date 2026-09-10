# ZORYQ Breakthrough Candidates — Novelty Gate v0.1

Status: **research hypotheses, not product claims**

The scores below are provisional. A score of 4/5 or 5/5 means only that an idea deserves deeper research; it does not establish originality. Related work, implementation evidence, benchmark results and independent review may reduce any score.

## Evaluation dimensions

Each hypothesis is judged on: problem significance, distinct mechanism, measurable advantage, new trade-off, technical risk, falsifiability and provisional novelty.

| # | Hypothesis | Problem addressed | Proposed ZORYQ mechanism | Measurable win required | Main new trade-off / risk | Novelty |
|---|---|---|---|---|---|---:|
| 1 | Adaptive Verified Execution | Parallel execution wastes work under mixed contention | Deterministic lane selection + serial-equivalent commit + optional evidence path | lower re-execution/waste than always-speculative without low-contention regression | scheduler complexity / false predictions | 4/5 |
| 2 | Speculation Budget | Speculation can cost more than serial execution | deterministic expected-benefit budget limits speculative work | bounded wasted work and graceful convergence to serial at hotspots | cost model may be inaccurate | 4/5 |
| 3 | Congestion Isolation Domains | One hot contract degrades unrelated workloads | dependency graph isolates independent execution domains while preserving one canonical order/state | hot-contract workload causes materially less latency/TPS degradation elsewhere | composability and cross-domain dependencies | 4/5 |
| 4 | Proof-Aware Execution Routing | Proof generation is usually bolted on after execution | proof requirement participates in deterministic execution strategy while proof generation stays off critical path where possible | proof-capable workloads without default commit-latency penalty | witness/prover overhead | 4/5 |
| 5 | Programmable Confidence | Apps have different confirmation needs but APIs often expose coarse labels | explicit ACK/EXECUTED/PRECONFIRMED/SAFE/FINAL/PROVEN semantics with machine-readable guarantees | lower perceived latency without overstating security; no safety ambiguity | API/protocol complexity | 3/5 |
| 6 | Deterministic Dependency Profiles | Dynamic EVM state access limits pre-scheduling | code-hash-bound learned profiles validated against real accesses | higher classifier precision with zero undetected commit-time false negatives | stale/poisoned profiles | 4/5 |
| 7 | Adaptive State Prefetch Graph | Parallel CPU workers stall on storage | dependency-derived deterministic/locally-safe state prefetch | lower DB wait and p95 execution latency | memory pressure / wasted IO | 3/5 |
| 8 | Hot-State Microshards | Global state storage becomes a bottleneck | ephemeral execution partitions over versioned state, converging through canonical commit | better hardware scaling for disjoint hot state | complex atomicity | 4/5 |
| 9 | Proof Receipts | Third parties often need replay or trusted RPC to validate application claims | compact commitments to ordered input, state diff, receipt/logs; ZK optional | cheaper independent verification for selected workloads | proof cost / data availability | 3/5 |
| 10 | MEV-Aware Adaptive Scheduler | Performance schedulers can accidentally create exploitable ordering behavior | execution optimization is cryptographically separated from canonical ordering; later ordering policy has explicit fairness constraints | reduced reorder/sandwich opportunity without throughput collapse | latency / encrypted-orderflow complexity | 4/5 |
| 11 | Conflict Pricing | Gas does not directly price contention imposed on validators | resource model adds measured contention/state pressure as a pricing signal | lower attacker/validator resource asymmetry under conflict bombs | fee unpredictability | 3/5 |
| 12 | State-Growth Budget | Cheap persistent state can externalize long-term cost | explicit per-epoch storage/resource budgets with rent/expiry research | bounded state growth at comparable app utility | UX and contract compatibility | 3/5 |
| 13 | Deterministic Recovery Checkpoints | Fast recovery is often operational rather than protocol-evidenced | periodic reproducible state/recovery commitments and drills | lower recovery time with verified state equality | storage/IO overhead | 3/5 |
| 14 | Self-Observing Execution | Networks publish metrics but metrics are not tied to protocol evidence | versioned machine-readable execution/conflict/recovery evidence records | third parties reproduce performance/regression claims | telemetry cost / gaming metrics | 4/5 |
| 15 | Safe Autonomous Optimization | Static tuning underperforms changing workloads; unconstrained AI is unsafe | AI proposes parameters offline, deterministic envelopes + CI/governance decide activation | measurable optimization without consensus nondeterminism | governance/model poisoning | 4/5 |
| 16 | Native Agent Policy Accounts | AI agents require spending autonomy without unrestricted keys | cryptographic scopes, budgets, session authority, revocation and audit trails as first-class account policy | autonomous execution with provable bounded loss | account-system complexity | 4/5 |
| 17 | Verifiable Service Intents | Agent/app users care about outcomes, not transaction sequences | bonded solvers compete under outcome constraints and proof receipts | better execution quality/cost while preserving user limits | solver centralization / MEV | 3/5 |
| 18 | Resource-Specific Markets | One gas scalar poorly represents compute/storage/bandwidth/proof pressure | separate internal resource accounting with unified user quote | improved DoS economics and resource utilization | economic complexity | 3/5 |
| 19 | Crypto-Agile Accounts | Future cryptographic migration can fracture account ownership | versioned signature/authentication envelopes allowing staged algorithm migration | migration without mass asset relocation or consensus ambiguity | larger auth payloads | 3/5 |
| 20 | Light-Verification-First UX | Fast UX often means blind trust in centralized RPC | compact headers/proofs plus browser/mobile verification paths designed with product APIs | materially less RPC trust at acceptable mobile cost | bandwidth/proof complexity | 3/5 |

## Five candidates advancing to deeper research

### C1 — Adaptive Verified Execution + Speculation Budget

Combines #1 and #2. The core falsifiable claim is not “parallel execution is new”; it is that ZORYQ can select *when not to speculate* well enough to reduce wasted work across changing contention while preserving serial semantics.

Required comparison: serial vs always-speculative vs AEM on 0/1/5/10/25/50/75/100% contention, with scheduler overhead and re-execution measured.

### C2 — Congestion Isolation Domains

Combines #3 with parts of #8. The key experiment mixes a pathological hot contract with independent transfers, DEX pools, social actions and autonomous-agent budget operations. Success means the hot workload does not proportionally degrade independent workloads.

### C3 — Deterministic Dependency Profiles

Hypothesis #6. The key risk is hidden/dynamic state access; therefore a profile is never trusted for correctness. Real REVM instrumentation must validate it before commit.

### C4 — Self-Observing + Safe Autonomous Optimization

Combines #14 and #15. The network emits verifiable operational/execution evidence; AI may detect anomalies or propose tuning, but deterministic envelopes and governance/CI remain authoritative.

### C5 — Native Agent Policy Accounts

Hypothesis #16. This aligns the Chain with ZORYQ Agent Protocol and Autonomous Company: agents receive cryptographically bounded authority rather than unrestricted wallets. It is valuable even if AEM fails, but must be compared with existing smart-account/account-abstraction policy systems before any originality claim.

## Two central candidates

### Primary — Adaptive Verified Execution with Speculation Budget

**Why selected:** high impact, directly benchmarkable, compatible with the current Reth/REVM direction and capable of being falsified incrementally in shadow mode.

**Kill criterion:** discard or redesign if it cannot beat always-speculative execution on mixed contention after including scheduler/storage overhead, or if safe classification requires so much conservatism that useful parallelism disappears.

### Secondary — Congestion Isolation Domains

**Why selected:** targets a more user-visible systemic failure mode than headline TPS: a hot application should not unnecessarily stall unrelated execution.

**Kill criterion:** discard as a core breakthrough if composability forces effectively global synchronization or if isolation only works by introducing hidden shards/trust boundaries that materially weaken semantics.

## Relationship to the product stack

```text
ZORYQ Chain
  ├─ Adaptive Verified Execution
  ├─ Speculation Budget
  └─ Congestion Isolation Domains
          ↓
ZORYQ Agent Protocol
  └─ bounded agent policy accounts + proof/evidence semantics
          ↓
ZORYQ Autonomous Company
  └─ public demonstration of cryptographically constrained autonomous work
```

## Next evidence gates

1. AEM metadata Shadow Engine on real non-empty blocks.
2. REVM read/write-set instrumentation in a non-canonical prototype.
3. Ground-truth classifier precision/recall.
4. Speculation-budget benchmark against serial and always-speculative baselines.
5. Conflict-bomb Red Team.
6. Congestion-isolation mixed-workload benchmark.
7. Multi-node devnet before any canonical activation.

Until those gates pass, all twenty items remain hypotheses.