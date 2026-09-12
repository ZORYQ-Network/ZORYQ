# ADR-0004: Non-dev multi-node prototype route

- Status: Accepted for prototype evaluation only
- Date: 2026-09-12
- Scope: distributed-testnet candidate, not mainnet

## Context

The current public ZORYQ testnet is useful for product and EVM experimentation, but its canonical runtime still depends on Reth `--dev`. Reth documents dev mode as a local proof-of-authority mode that disables network discovery. A temporary `peers>0` observation is therefore not sufficient evidence of a durable independently operated network.

ZORYQ needs a non-dev architecture that can be reproduced by independent operators without weakening EVM compatibility, deterministic execution, recovery, or evidence standards.

## Decision

For the first non-dev prototype, ZORYQ will evaluate an Ethereum-style split stack:

- **Execution layer:** Reth, using the Engine API and no `--dev` or `--dev.mnemonic` flags.
- **Consensus layer candidate:** Lighthouse, using a dedicated testnet configuration and authenticated Engine API connection through a per-node JWT secret.
- **Node topology:** one execution client paired with one consensus client per operator.
- **Operator boundary:** Node 1 and Node 2 must run under distinct host/account/control boundaries before the network may be described as independently operated.

This is a prototype selection, not a permanent protocol commitment. If the prototype cannot satisfy ZORYQ's cost, finality, recovery, upgrade, or product requirements, the decision must be revisited with evidence.

## Why this route first

1. Reth is designed as an execution client and documents the need for a consensus client on post-Merge networks.
2. Lighthouse provides a mature consensus-client implementation with Engine API/JWT integration and explicit validator/beacon-node separation.
3. The split makes responsibilities clearer: execution validates/executes blocks while consensus selects/finalizes the canonical chain.
4. It gives ZORYQ an auditable baseline before considering a custom BFT/PoA engine, which would create materially more consensus and security burden.

## Prototype invariants

The prototype must fail acceptance if any of these are violated:

- no Reth `--dev`;
- no `--dev.mnemonic`;
- no consensus-critical private key or JWT secret committed to the repository;
- exact execution genesis and consensus config are public and hash-pinned;
- Node 1 and Node 2 have distinct P2P identities and storage;
- both operators independently control their infrastructure;
- both nodes converge on the same finalized/canonical block samples;
- restart/rejoin works from each operator's persistent state;
- a one-node outage and recovery drill is recorded;
- fork/divergence behavior is tested and documented;
- public telemetry distinguishes execution head, consensus head/finality, peers and health.

## Secret model

Each operator creates locally:

- Engine API JWT secret;
- validator/signing keys if the chosen prototype requires validators;
- node identity and infrastructure credentials.

Only public keys, public node identities, hashes and non-secret evidence may be published.

## Non-goals

This ADR does **not** claim:

- decentralization;
- mainnet readiness;
- production-grade validator economics;
- audited consensus safety;
- final performance/finality targets;
- that Lighthouse is permanently selected for ZORYQ mainnet.

## Promotion gate

A distributed-testnet claim requires at minimum two independently controlled operators reproducing the same public configuration, stable multi-node operation, matching block/finality evidence, and recovery evidence.

Mainnet remains a separate gate under `mainnet-guard.mjs` and requires production consensus, key custody separation, redundancy, disaster recovery, security audit, incident response, and distinct mainnet genesis/chain ID evidence.
