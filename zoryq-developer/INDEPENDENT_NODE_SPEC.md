# ZORYQ Independent Node Specification — Draft v0.1

This document defines the evidence required before ZORYQ may claim independent-node or multi-validator operation. It is deliberately stricter than a marketing roadmap.

## Current state

ZORYQ EVM Testnet is currently a centralized public EVM testing environment with one public gateway. It is not a decentralized network and has no independent validator set today.

## Milestone 1 — Reproducible independent node

Exit criteria:

1. A fresh operator can bootstrap a node from documented instructions without access to private ZORYQ infrastructure credentials.
2. Node identity, chain ID `5919065`, genesis/config fingerprint and persistent data path are deterministic and documented.
3. Restart from persisted chain data is verified.
4. Full resync from genesis/config is verified.
5. Public/admin RPC separation is preserved; privileged Anvil/Hardhat/debug methods remain unavailable on public RPC.
6. A machine-readable node status endpoint exposes software version, chain ID, current block, peer count and sync state without leaking secrets.

## Milestone 2 — Three-node devnet

Minimum topology:

- 3 independently operated execution/validator nodes;
- at least 2 separate operators or administrative trust domains;
- independent persistent storage;
- no shared private signing key;
- deterministic chain-head agreement checks.

Exit tests:

- all nodes agree on chain ID and finalized/accepted head according to the chosen consensus model;
- restart one node and verify catch-up;
- stop one node and verify the network continues under the documented fault assumption;
- compare block/hash sequences across all nodes;
- verify public RPC remains available when one backend node fails.

## Milestone 3 — Fault-tested public testnet

Required tests:

- validator/node outage;
- network partition;
- stale peer recovery;
- corrupted local state recovery from documented backup/resync path;
- rolling software upgrade;
- failed upgrade rollback;
- RPC failover;
- incident communication drill.

## Consensus decision record required

Before multi-validator implementation, publish an ADR covering:

- consensus family and why it was selected;
- validator admission/removal;
- block production and finality semantics;
- validator key lifecycle;
- slashing or equivalent fault policy if applicable;
- clock/time assumptions;
- network partition behavior;
- upgrade coordination;
- emergency controls and how/when they are retired.

## Claims policy

Allowed now:

- public EVM-compatible testnet;
- centralized testing environment;
- live testnet DeFi primitives;
- agent-native developer tooling.

Not allowed until verified evidence exists:

- decentralized;
- multi-validator;
- censorship resistant;
- Byzantine fault tolerant;
- production-ready mainnet.

## Verification artifacts

Each milestone should produce public, reproducible evidence: commands, configuration fingerprints, node version, test timestamps, block/hash comparisons, incident/failure test results and a signed release note. No private keys, seed phrases or privileged credentials may be published.
