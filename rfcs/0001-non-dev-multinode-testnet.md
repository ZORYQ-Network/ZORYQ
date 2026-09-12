# RFC 0001 — Non-dev Multi-Node ZORYQ Testnet

Status: Draft

## Context

The current public ZORYQ testnet is intentionally experimental and currently launches Reth with development-mode arguments. This is useful for product and EVM-integration work, but it is not sufficient evidence of a durable independently operated blockchain network.

Recent live observations reinforced that boundary: a temporary peer observation did not survive restart, and the live node returned to zero persisted peers. The current public testnet must therefore remain classified as an experimental single-primary-operator environment until stronger evidence exists.

This RFC defines a parallel transition path. It does **not** authorize destructive migration of the current public testnet, does not weaken mainnet guards, and does not select a consensus design before evidence exists.

## Goals

1. Replace development-mode consensus assumptions with a reproducible multi-node architecture.
2. Preserve EVM compatibility and deterministic state.
3. Support independent operators without sharing ZORYQ infrastructure credentials.
4. Define explicit finality, recovery and divergence semantics.
5. Make every promotion claim evidence-gated.

## Non-goals

- claiming mainnet readiness;
- claiming decentralization from process or replica count;
- maximizing TPS before correctness and recovery are proven;
- migrating production state before a tested migration/rollback plan exists;
- inventing a novel consensus protocol without a security case.

## Candidate architecture A — Ethereum-style execution + consensus clients

Use Reth as the execution client with a production-capable consensus-client layer instead of Reth development mode.

### Advantages
- reuses a mature execution/consensus separation model;
- clear engine boundary and established operational patterns;
- strong interoperability and tooling ecosystem;
- independent operators can run standard components.

### Costs / risks
- substantially more operational complexity than the current dev testnet;
- genesis, validator deposits/configuration, fork schedules and client compatibility must be managed carefully;
- mainnet-grade assumptions still require explicit security review and key custody design.

## Candidate architecture B — Purpose-built PoA/BFT testnet

Adopt a multi-validator authority/BFT architecture suitable for a controlled public testnet.

### Advantages
- potentially simpler operator experience and lower resource requirements;
- explicit validator set can accelerate early multi-operator testing.

### Costs / risks
- larger protocol/security burden if custom components are introduced;
- validator-set changes, slashing/fault handling and finality semantics must be specified rather than assumed;
- greater risk of accidental centralization or weak safety claims.

## Candidate architecture C — L2 / rollup architecture

Reframe ZORYQ as an EVM execution environment settling to another chain.

### Advantages
- can inherit parts of settlement/security from an existing ecosystem;
- strong developer compatibility options;
- may simplify some consensus responsibilities.

### Costs / risks
- changes the base-chain product thesis and trust model;
- introduces sequencer/prover/bridge/security assumptions;
- not a drop-in migration from the current testnet.

## Decision matrix

Every candidate must be scored with evidence against:

| Dimension | Required evidence |
| --- | --- |
| Safety | documented fault assumptions and invalid-state prevention |
| Finality | explicit definition and reproducible finality behavior |
| Determinism | matching state/block results across independent nodes |
| Independent operation | public runbook using only non-secret artifacts |
| Recovery | restart, rejoin and node-loss drills |
| Fork handling | reproducible divergence/reconciliation tests |
| Key custody | signer roles separated from application/faucet/dev wallets |
| EVM compatibility | compatibility tests and known deviations |
| Observability | head, peer, finality, health and resource telemetry |
| Security burden | external review scope and protocol complexity |
| Operating cost | measured resource requirements, not estimates presented as results |
| Upgrade/governance | documented authority and change process |

No candidate is selected until a short prototype/spike produces evidence for the matrix.

## Parallel transition plan

### Track 0 — Preserve current experimental testnet

The existing public testnet remains available for wallet, faucet, contract, Autonomous and developer-experience work. It must continue to be labeled experimental. No silent state reset or destructive migration is permitted.

### Track 1 — Build non-dev lab network

Create an isolated lab network using a candidate production-style architecture. The lab must use:

- a separate chain ID from the current public testnet during destructive experiments;
- reproducible public chain/genesis configuration;
- no checked-in private validator/signing keys;
- at least two node processes with distinct persistent data and P2P identities;
- deterministic convergence tests.

### Track 2 — External operator reproduction

After the lab succeeds internally, an external operator controls a separate host/account and reproduces the published procedure without privileged assistance.

### Track 3 — Migration decision

Only after recovery, convergence, security and external-operation evidence exists should a migration proposal be written for the public testnet. That proposal must include rollback and data-compatibility analysis.

## Promotion gates

### Distributed-testnet candidate

All must be true:

- [ ] no development-mode consensus dependency;
- [ ] consensus/finality semantics documented;
- [ ] public canonical configuration + SHA-256;
- [ ] two distinct persistent nodes;
- [ ] independent control boundary for at least one operator;
- [ ] matching canonical block/hash samples;
- [ ] restart/rejoin evidence;
- [ ] node-loss recovery evidence;
- [ ] fork/divergence test evidence;
- [ ] signer/key separation;
- [ ] public operator runbook;
- [ ] telemetry proving head/peer/finality health.

### Mainnet

This RFC does not alter the mainnet gate. `mainnet-guard.mjs` remains authoritative and fail-closed. Production consensus, redundancy, disaster recovery, audit, key custody, incident response, distinct mainnet genesis and distinct chain ID require real bound evidence.

## Immediate engineering spike

The first spike should answer one question only:

> Which candidate architecture can produce two reproducible non-dev ZORYQ nodes with deterministic convergence, explicit finality semantics and the lowest avoidable protocol-security burden?

For each candidate tested, publish:

1. exact component/client versions;
2. configuration/commit hash;
3. hardware/OS;
4. topology;
5. startup procedure;
6. block/hash convergence sample;
7. restart/rejoin result;
8. failure encountered;
9. security/trust assumptions;
10. measured resource use.

Negative results are valid results.

## Claim boundary

Until these gates pass, accurate wording is:

**ZORYQ operates an experimental EVM-compatible public testnet and is researching a non-dev multi-node architecture.**

Do not describe the current network as decentralized, production-mainnet-ready, or independently operated without the corresponding evidence.