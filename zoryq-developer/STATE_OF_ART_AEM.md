# ZORYQ AEM — State of the Art / Novelty Boundary

Status: **research evidence, not product claims**  
Date: 2026-09-10  
Target: ZORYQ Adaptive Execution Mesh / Adaptive Verified Execution

## Why this file exists

ZORYQ must not call parallel execution, conflict detection, serial commit, preconfirmation, or state tracing original merely because they are combined in this repository. This document defines the known-work boundary that the AEM research program must exceed with reproducible evidence.

## Directly relevant prior/current systems

### Block-STM / Aptos

Block-STM uses optimistic parallel execution, dynamically detects dependencies/conflicts, validates speculative work and preserves a result equivalent to a preset serial order. Its published evaluation explicitly studies changing conflict rates.

**Novelty consequence for ZORYQ:** “adaptive parallel execution” and “serial-equivalent optimistic execution” are not original claims.

Primary reference: Gelashvili et al., *Block-STM: Scaling Blockchain Execution by Turning Ordering Curse to a Performance Blessing*, PPoPP 2023 / arXiv:2203.06871.

### Monad

Monad publicly describes optimistic parallel EVM execution in which pending results record storage slots read (SLOAD) and written (SSTORE), commit occurs serially, and transactions are re-executed when an input has been invalidated.

**Novelty consequence for ZORYQ:** recording EVM read/write sets, optimistic workers, input validation and serial commit are baseline techniques, not ZORYQ inventions.

Reference: Monad, *How Monad Works — Optimistic parallel execution*.

### Conflict-specification research

Recent research reports that supplying conflict information to block transactional-memory algorithms can improve EVM and MoveVM execution relative to plain speculative baselines.

**Novelty consequence for ZORYQ:** dependency hints/predictions alone are insufficient. ZORYQ must show a distinct deterministic policy and measurable benefit after classifier/scheduler/storage overhead.

Reference: Anjana et al., *Efficient Parallel Execution of Blockchain Transactions Leveraging Conflict Specifications*, arXiv:2503.03203.

### REVM / revm-inspectors / Reth

Reth integrates REVM inspection APIs. The REVM inspector ecosystem provides access-list, opcode, tracing and storage inspectors; recent releases explicitly track SLOAD/SSTORE/accessed-slot behavior.

**Novelty consequence for ZORYQ:** instrumentation is enabling infrastructure, not the breakthrough. ZORYQ should reuse/audit mature inspection hooks rather than inventing consensus-critical tracing machinery prematurely.

References: Reth Rust docs (`reth::revm`), `paradigmxyz/revm-inspectors`, current REVM inspector documentation.

### MegaETH

MegaETH exposes ~10 ms mini-blocks and realtime execution-result streaming ahead of standard EVM blocks.

**Novelty consequence for ZORYQ:** fast streaming/preconfirmation APIs alone are not novel. Programmable Confidence must state security semantics precisely and, if pursued, demonstrate a distinct useful property.

Reference: MegaETH Documentation — Mini-Blocks and Realtime API.

### Sui

Sui uses object semantics to distinguish transaction dependency patterns and can process certain owned-object operations through a faster path than shared-object operations.

**Novelty consequence for ZORYQ:** multi-path processing based on dependency structure is not original by itself.

## Current novelty hypothesis that remains defensible

The candidate is **not** “parallel EVM”. It is the following falsifiable system-level hypothesis:

> A deterministic scheduler can use observed/predicted dependency risk and a bounded speculation budget to choose when *not* to speculate, isolate pathological contention from independent workloads, preserve serial-equivalent EVM semantics, and expose verifiable execution evidence with lower wasted work than an always-speculative baseline across changing contention.

This remains a **HYPOTHESIS** until real bytecode/state evidence and benchmark results exist.

## Required baselines

Every meaningful AEM execution benchmark must include at least:

1. canonical serial execution;
2. always-speculative optimistic execution;
3. AEM adaptive policy;
4. a Block-STM-like / OCC-inspired baseline where technically feasible;
5. disclosed scheduler/instrumentation/storage overhead.

## Required contention matrix

`0% / 10% / 30% / 50% / 80% / 100%`

Additional hotspot mixtures must combine a contended contract with independent transfers, DEX-like state, social actions and agent-policy/budget operations.

## Kill criteria

The primary AEM hypothesis must be killed or redesigned if any of the following remains true after real REVM instrumentation:

- AEM does not reduce total execution/re-execution work against always-speculative execution on mixed contention after scheduler overhead.
- Conservative classification removes most useful parallelism.
- Storage/database bottlenecks dominate so strongly that scheduling gains do not improve end-to-end execution.
- Conflict isolation requires weakening composability or canonical semantics.
- Machine-local factors change consensus-visible scheduling decisions.
- Predicted independence can bypass runtime validation.
- AEM materially increases DoS/MEV attack surface without compensating benefits.

## Current evidence ladder

- deterministic abstract scheduler: **SIMULATION**;
- synthetic contention Arena: **SIMULATION**;
- adversarial scheduler harness: **ADVERSARIAL_SIMULATION**;
- metadata-only live Shadow Engine: **PROTOTYPE + TESTNET OBSERVATION**;
- real REVM state-access ground truth: **IN PROGRESS**;
- real parallel REVM execution: **NOT IMPLEMENTED**;
- multi-node AEM: **NOT IMPLEMENTED**;
- independently reproduced AEM advantage: **NOT ESTABLISHED**;

## Research rule

A higher novelty score must come from a result that is new, useful, measurable, reproducible, safe and explainable — not from renaming known parallel-execution techniques.
