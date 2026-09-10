# ZORYQ Protocol Status

This document separates **current evidence**, **protocol requirements**, and **future research**.

## Current evidence boundary

The repository currently contains product/security documentation, GitHub automation and a packaged mobile application build path. Protocol-level claims must not be inferred from product documentation alone.

Until node/protocol implementation, configuration and reproducible tests are first-class reviewable artifacts, advanced protocol mechanisms remain requirements or research hypotheses rather than proven ZORYQ behavior.

## Protocol goals

The protocol track is intended to define and validate:

- deterministic transaction semantics;
- EVM-compatible execution where claimed;
- explicit state transition rules;
- network and RPC behavior;
- node synchronization and recovery;
- consensus/finality semantics;
- adversarial and partition behavior;
- measurable performance under realistic workloads;
- safe upgrade/versioning rules.

## Core invariants

Before production readiness, tests should demonstrate at least:

1. honest nodes converge on the same canonical state under supported conditions;
2. invalid transactions cannot mutate canonical state;
3. crash/restart does not silently corrupt accepted state;
4. execution optimizations preserve canonical semantics;
5. protocol messages and RPC inputs have explicit validation limits;
6. finality/confirmation terminology has precise meaning;
7. supply/accounting invariants, where applicable, survive reorg/recovery scenarios.

## Parallel execution rule

If parallel execution is introduced, ZORYQ should maintain a permanent serial-equivalence property:

`parallel canonical state root == canonical serial state root`

for the same valid ordered workload, unless the specification explicitly defines a different deterministic execution model and proves equivalence at the semantic level.

## Research candidates

Potential research includes adaptive scheduling, dependency graphs, proof receipts, congestion isolation and streaming finality. See `RESEARCH.md`.

None of these terms should appear as a completed production capability without linked implementation, tests and benchmark evidence.

## Next protocol artifacts

The protocol track should progressively add:

- transaction format specification;
- state model;
- execution semantics;
- consensus/finality specification;
- networking protocol;
- RPC specification;
- genesis/configuration format;
- node operator guide;
- deterministic test vectors;
- recovery tests;
- adversarial network tests.
