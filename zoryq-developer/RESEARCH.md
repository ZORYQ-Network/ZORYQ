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

**Interpretation of the first live sample**

This proves that the current metadata Shadow Engine can consume a real non-empty ZORYQ testnet block, validate network identity, classify it deterministically and emit a reproducible research commitment without influencing execution. It does **not** prove parallel execution, classifier correctness against real storage accesses, throughput improvement, lower latency or novelty. A one-transaction block is specifically insufficient for any parallelism/performance claim.

**What this does NOT prove**

- No real parallel REVM execution is active.
- No real EVM read/write-set instrumentation is active.
- No throughput advantage over serial, Block-STM-like or always-speculative execution has been demonstrated.
- No classifier precision/recall against ground-truth storage accesses has been measured.
- No novelty claim is established.
- No decentralized BFT finality is established.

**Decision**

Proceed only with a non-canonical Shadow Engine. Reth remains the canonical authority. Shadow output may classify metadata, estimate dependency risk and emit evidence, but may not alter transaction ordering, execution, receipts, state roots, fork choice or finality.

**Next experiment**

Capture deterministic fixed block/workload fixtures with multiple transactions, then add real REVM read/write-set instrumentation in a non-canonical prototype. Use actual accesses as ground truth to measure classifier precision, false-positive rate and—most critically—verify that no predicted independence can bypass canonical validation. Only after that should the Speculation Budget be benchmarked against serial and always-speculative baselines.

## 2026-09-10 — R-002 Smoke-test integrity

**Question**

Are current public/production smoke failures evidence of execution-client failure or public-surface regressions?

**Evidence**

Current public smoke runs confirm Chain ID `5919065`, `net_version`, block reads, balance reads, `eth_call`, `eth_estimateGas`, `eth_getLogs`, unknown-receipt semantics and raw-transaction capability checks. Remaining failures have been isolated to public route/file mappings such as EIP-3091 explorer routes and builder discovery aliases.

**Decision**

Fix the public product surfaces. Do not weaken the assertions merely to obtain a green CI result.

## 2026-09-10 — R-003 Multi-node/P2P

**Question**

Does the current public testnet have independently demonstrated external peer connectivity and multi-node consensus behavior?

**Current classification**

`UNPROVEN`.

The validator heartbeat registry is operational telemetry and is not evidence of decentralized consensus participation.

**Decision**

Do not label the network decentralized or multi-validator until at least a reproducible two-node Reth test proves P2P synchronization/peer discovery and the consensus/finality model is explicitly defined and measured.

## Research rules

1. A benchmark without disclosed hardware, commit, configuration and workload is not accepted as evidence.
2. A classifier prediction is never a correctness oracle; canonical validation is the correctness boundary.
3. Machine-local AI output may recommend experiments but may not determine consensus-visible results.
4. AEM must degrade safely to serial execution when confidence is insufficient or contention is adversarial.
5. A failed experiment is recorded rather than hidden.
6. Any move from shadow execution to canonical execution requires: serial-equivalence gates, recovery gates, adversarial tests, reproducible benchmarks, multi-node validation and an explicit rollback strategy.