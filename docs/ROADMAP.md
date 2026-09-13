# ZORYQ Unified Roadmap

This roadmap is ordered by evidence and platform leverage. Dates are announced only when delivery capacity and proof justify them.

## NOW — Unify and make reproducible

### Platform
- establish `ARCHITECTURE.md`, `PRODUCT_MAP.md`, `NETWORK_STATUS.md`, `MAINNET_READINESS.md` and the Command Center as source of truth;
- keep ZORYQ naming/brand consistent;
- classify repository paths as KEEP / MERGE / REFACTOR / ARCHIVE / DELETE before destructive moves;
- remove corrupt packaged-source archives from all active mobile build/export dependencies;
- maintain evidence links for every green status.

### Mobile / Identity
- keep `mobile-games-native/` as canonical reviewable Android source during migration;
- build Wallet + Social + Games from normal Git files;
- maintain BIP-39/BIP-44 recovery and Android Keystore boundary;
- harden session/replay/confirmation UX;
- define exclusive production Android signing before any public production cutover.

### Autonomous Network
- make Autonomous Company the primary differentiated platform experience;
- connect objective → plan → bounded agents → task execution → proof → payment/accounting;
- reuse OBEP/Proof Pack evidence rather than inventing parallel proof systems;
- add spending-policy limits and explicit authority scopes.

### Network
- preserve public testnet reliability and onboarding;
- complete independent Node 2 evidence;
- distinguish same-operator redundancy from independent operators;
- keep mainnet claim fail-closed.

## NEXT — Demonstrable end-to-end product

### Autonomous Company vertical slice
A reproducible demo must accept a goal and budget, create bounded roles/tasks, execute at least one useful task, produce verifiable evidence and account for any testnet payment. External reproduction is required before the capability is promoted to PROVEN end-to-end.

### Mobile unification
- consolidate navigation around Wallet / Social / Autonomous / Games / Explore;
- preserve module isolation while removing migration-only naming as release architecture stabilizes;
- add physical-device performance and recovery tests;
- add privacy-safe crash/ANR observability.

### Social
- replay-safe wallet challenges;
- session expiration/revocation;
- moderation/report/block flows;
- backup/restore and rate-limit evidence.

### Games
- improve Rush production quality;
- evolve Arena and Empire beyond vertical slices only after shared identity/progression contracts are stable;
- keep gameplay offchain unless blockchain adds ownership/settlement/evidence value.

### Developer experience
- first contract / first application path after first transaction;
- stable examples/SDK boundaries;
- Command Center links to reproducible evidence;
- independent builder feedback.

## THEN — Production-readiness gates

- exclusive release signing and secure CI release path;
- independent wallet/protocol security assessment;
- multi-operator network evidence;
- disaster-recovery drill;
- incident-response tabletop exercise;
- deterministic compatibility/conformance evidence;
- sustained observability;
- upgrade and rollback drills;
- mainnet launch manifest binding all required evidence by hash.

## RESEARCH — Prove before integration

Research may include adaptive/parallel execution, dependency-aware scheduling, proof receipts, congestion isolation, post-quantum migration and safer autonomous optimization.

Every research item advances through:

`related work → hypothesis → specification → prototype → tests → benchmark → risk review`

before becoming a platform capability.

## Never substitute

- green CI for adoption;
- internal replicas for decentralization;
- testnet success for mainnet readiness;
- schemas for end-to-end autonomous execution;
- a working APK for an audited production wallet;
- marketing reach for external user/developer evidence.
