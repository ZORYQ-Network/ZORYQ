# ZORYQ Research Log

Status: **active research log**

Network: ZORYQ EVM Testnet — Chain ID `5919065` (`0x5a5159`)

This file records research questions, experiments, evidence, failures and decisions. Negative results are retained. Nothing in this file is a production claim unless explicitly classified as such and independently supported.

## Evidence classes

- IDEA — proposed, not tested.
- HYPOTHESIS — technically stated and falsifiable.
- SIMULATION — evaluated in a controlled model.
- PROTOTYPE — executable implementation outside canonical consensus.
- DEVNET — exercised on a controlled network.
- TESTNET — exercised on the public ZORYQ testnet.
- RESULT REPRODUCED — independently reproduced under disclosed methodology.
- AUDITED — independently reviewed for the stated property.
- PRODUCTION — deployed under production assumptions and evidence.

## 2026-09-10 — R-001 Adaptive Execution Mesh

**Question**

Can an EVM-compatible execution layer deterministically choose between fast, speculative-parallel and serial-safe execution strategies while preserving canonical serial semantics and reducing wasted speculative work under mixed contention?

**Current classification**

`PROTOTYPE / SIMULATION + TESTNET OBSERVATION`. AEM is **not active in canonical execution or consensus**.

**Existing evidence**

- `ADAPTIVE_EXECUTION_MESH.md` specifies serial-equivalence, deterministic commit order, machine independence, speculation isolation, nonce correctness, revert parity and safe fallback.
- A deterministic AEM scheduler simulator exists.
- `ZORYQ Adaptive Execution Mesh Research` CI gate has passed for the current simulator cases.
- `ZORYQ Serial Equivalence Evidence` has passed after repairing the harness so expected reverts are compared rather than treated as harness failures.
- `ZORYQ State Recovery` has passed with Reth native persistence after the recovery gate was aligned to durable-head recovery semantics.
- `ZORYQ AEM Shadow Evidence` run `34512414470` passed a live read-only testnet observation against Chain ID `5919065`.
- The shadow sampler selected non-empty block `0x809a` through the native Explorer index, then re-read that block through canonical JSON-RPC.
- The sampled block contained `1` transaction. Metadata-only AEM classified it as `speculative` (`fast=0`, `speculative=1`, `serial=0`).
- The deterministic shadow result commitment for that observation was `0xecc6e6a6c2473d88b05dd06335153fe583b9c397ee1390f2343891258afab5a7`.
- The live observer remained explicitly `canonical=false`, `status=research`, `evidenceClass=metadata-shadow`, with no transaction-submission primitives.
- `ZORYQ AEM Contention Arena` run `34514474423` passed a deterministic synthetic comparison at 0/10/30/50/80/100% contention. It verifies serial-equivalent state digests, deterministic scheduling and no greater execution work than the always-speculative baseline in the model. This is `SIMULATION`, not a TPS claim.
- `ZORYQ AEM Red Team` run `34514590307` passed the current adversarial simulation suite covering fail-closed dynamic/unknown accesses, same-sender dependencies, misleading declarations with runtime invalidation/reexecution, conflict bombs, worker-count independence and proof-hint state invariance. This is `ADVERSARIAL_SIMULATION`, not an audit/security proof.

**Interpretation of current evidence**

The metadata Shadow Engine can consume a real non-empty ZORYQ testnet block, validate network identity, classify it deterministically and emit a reproducible research commitment without influencing execution. The synthetic Arena and Red Team show that the abstract scheduler can reduce modeled wasted speculative work under higher contention while retaining serial-equivalent model state and failing closed under the implemented attacks.

These results do **not** prove real EVM/REVM parallel execution, throughput improvement, lower latency, classifier accuracy on actual storage accesses, novelty, or multi-node safety.

**What this does NOT prove**

- No real parallel REVM execution is active.
- No real EVM read/write-set instrumentation is active yet.
- No throughput advantage over serial, Block-STM-like or always-speculative execution has been demonstrated on real bytecode/state.
- No classifier precision/recall against ground-truth storage accesses has been measured.
- No novelty claim is established.
- No decentralized BFT finality is established.

**Decision**

Proceed only with a non-canonical Shadow Engine. Reth remains the canonical authority. Shadow output may classify metadata, estimate dependency risk and emit evidence, but may not alter transaction ordering, execution, receipts, state roots, fork choice or finality.

**Next experiment**

Add real REVM-derived read/write-set evidence in a non-canonical prototype. Use actual accesses as ground truth to measure classifier precision, false-positive rate and false-negative risk. The prototype must treat prediction as optimization only; actual execution/validation remains the correctness boundary. Then benchmark the Speculation Budget against serial and always-speculative baselines using real bytecode/state workloads.

## 2026-09-10 — R-002 Smoke-test integrity

**Question**

Are current public/production smoke failures evidence of execution-client failure or public-surface regressions?

**Evidence**

The failures were isolated to public route/file mappings and deployment timing, not basic execution identity. The Rust gateway was updated to serve EIP-3091-style `/tx/`, `/address/`, `/block/` and `/token/` explorer routes and canonical builder discovery files. The deployment containing `/token/` completed successfully before the final rerun.

- `ZORYQ Public EVM Smoke Test` rerun passed all steps: release-specific surfaces, Chain ID `5919065`, JSON-RPC compliance, EIP-3091 routes, read-only faucet status, maturity disclosure and developer evidence surfaces.
- `ZORYQ Production Smoke` run `34513130705`, latest rerun, passed all steps: health, RPC reads, canonical product surfaces, maturity, Treasury control service, protocol artifacts, builder surfaces, EIP-3091 routes, Genesis verification classes and public administrative RPC blocking.

**Decision**

Public/Production Smoke are green for the active image. Keep the assertions strict. Any future regression becomes an immediate release blocker.

## 2026-09-10 — R-003 Multi-node/P2P

**Question**

Does the current public testnet have independently demonstrated external peer connectivity and multi-node consensus behavior?

**Current classification**

`UNPROVEN`.

The validator heartbeat registry is operational telemetry and is not evidence of decentralized consensus participation.

**Decision**

Do not label the network decentralized or multi-validator until at least a reproducible two-node Reth test proves P2P synchronization/peer discovery and the consensus/finality model is explicitly defined and measured.

## 2026-09-10 — R-004 Ground-truth tracing design

**Question**

How should AEM measure real EVM state dependencies without treating prediction or one RPC tracer as a correctness oracle?

**Evidence / constraints**

Reth integrates REVM inspection APIs and `revm-inspectors` provides execution hooks/state tracing. Recent Reth/revm-inspectors history also shows tracer-specific bugs and performance differences, so trace output must be versioned and cross-checked rather than blindly trusted.

**Decision**

The next prototype is non-canonical and read-only. It will separate observed state-access evidence from state-diff evidence, pin versions/fixtures, and compare predicted dependency sets against actual execution-derived sets. It may not write `/data/reth/db`, submit transactions to the public testnet, influence ordering, or change canonical state.

## Research rules

1. A benchmark without disclosed hardware, commit, configuration and workload is not accepted as evidence.
2. A classifier prediction is never a correctness oracle; canonical validation is the correctness boundary.
3. Machine-local AI output may recommend experiments but may not determine consensus-visible results.
4. AEM must degrade safely to serial execution when confidence is insufficient or contention is adversarial.
5. A failed experiment is recorded rather than hidden.
6. Any move from shadow execution to canonical execution requires: serial-equivalence gates, recovery gates, adversarial tests, reproducible benchmarks, multi-node validation and an explicit rollback strategy.
