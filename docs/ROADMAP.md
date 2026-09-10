# ZORYQ Engineering Roadmap

This roadmap tracks technical maturity. Dates should be announced only when delivery capacity and evidence justify them.

## NOW — Repository and evidence foundation

### Product/application
- maintain ZORYQ brand consistency;
- keep mobile build reproducible;
- improve source reviewability and remove the packaged-source dependency safely;
- strengthen security and contribution process;
- maintain documentation for wallet, swap, SocialFi and XP boundaries.

### Network/protocol
- define current testnet/network evidence boundary;
- establish protocol specification structure;
- document state, execution, networking and finality semantics as implementation becomes reviewable;
- establish RFC/ADR process;
- establish reproducible benchmark methodology;
- add protocol-level threat modeling.

## NEXT — Testable engineering maturity

### Product/application
- authentication/session hardening;
- test-environment wallet send/receive;
- provider-backed swap simulation/quotes;
- server-side XP/event integrity;
- privacy-safe crash/telemetry controls;
- deeper security assessment.

### Network/protocol
- first-class node/protocol source tree;
- deterministic transaction/state test vectors;
- explicit EVM compatibility matrix;
- node startup/configuration documentation;
- state snapshot/recovery tests;
- adversarial network tests;
- observable RPC/network metrics;
- baseline performance measurements with raw results.

## RESEARCH — Prove before integration

Candidate tracks include:

- adaptive / parallel execution;
- dependency-aware scheduling and PSDG-style experiments;
- proof receipts / verifiable execution;
- explicit streaming confirmation/finality models;
- congestion isolation;
- safe autonomous optimization;
- post-quantum migration research;
- verifiable autonomous/AI execution.

Each research item should progress through:

`related work → hypothesis → specification → prototype → tests → benchmark → risk review`

before being considered a proven ZORYQ protocol capability.

## LONG TERM — Production-readiness gates

Production/mainnet maturity should require evidence for:

- deterministic state and conformance;
- consensus/finality safety under supported fault assumptions;
- crash/recovery correctness;
- security review of critical components;
- reproducible builds/releases;
- dependency/supply-chain controls;
- node/operator runbooks;
- incident response;
- upgrade/rollback procedures;
- sustained public infrastructure observability;
- documented known limitations.

## Product launch track

Where product maturity permits, the application roadmap may progress through closed alpha, testnet beta, limited production rollout and public launch. Wallet, swaps, fees, treasury and any future token functionality require their own security/legal/operational gates and must not be inferred from protocol roadmap milestones.

## Token policy

Any future token remains conditional on separate legal, tokenomics, security and infrastructure work. GitHub engineering documentation must not promise token price, investment return or guaranteed distribution.
