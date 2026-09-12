# ZORYQ Developer Onboarding

ZORYQ is an experimental EVM-compatible public testnet under active development. This guide intentionally distinguishes **verified public paths** from **paths still being hardened**.

## Goal

The target onboarding path is:

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

A stage is promoted as publicly supported only when an external developer can reproduce it without private knowledge or privileged credentials.

## Network identity

- Network: **ZORYQ Testnet**
- Chain ID: **5919065**
- Compatibility target: **EVM**
- Stage: **experimental public testnet / active development**
- Public project surface: https://zoryq-testnet.vercel.app

## Evidence-gated onboarding status

| Stage | Current public status | Evidence gate |
| --- | --- | --- |
| Discovery | Available | Repository and public project surface are reachable |
| Docs | Available / improving | Architecture, protocol, security, research and contribution docs are public |
| Faucet | P0 hardening | Fresh wallet must obtain testnet ZQ under documented limits |
| First transaction | P0 hardening | Fresh funded wallet must sign a transaction and receive a verifiable receipt |
| First contract | Not yet promoted as stable | Reproducible deployment instructions plus public receipt/address |
| First application | Not yet promoted as stable | External developer can build and use an app without privileged setup |
| Contribution | Available | CONTRIBUTING.md and public GitHub Issues |
| Ecosystem project | Target | Independent project with reproducible integration |

## P0: Faucet → First Transaction

The canonical blocker is tracked publicly in:

https://github.com/ZORYQ-Network/ZORYQ/issues/55

Completion requires one reproducible run proving:

1. a **fresh wallet** is created;
2. the wallet receives testnet ZQ through the documented faucet path;
3. the balance is observed through RPC;
4. the fresh wallet signs a real transaction;
5. the transaction is accepted by the testnet;
6. a receipt is returned and can be independently checked;
7. the transaction hash and reproduction instructions are published.

An HTTP 200 response, mocked test, internal wallet or undocumented endpoint is **not sufficient evidence**.

## What developers can do today

Until the P0 path is fully promoted, useful contributions include:

- review architecture and protocol documentation;
- improve reproducibility and failure-mode documentation;
- add explicit negative tests;
- inspect EVM/RPC compatibility assumptions;
- propose benchmark workloads and methodology;
- review security assumptions and threat models;
- convert research claims into falsifiable experiments;
- improve developer UX without weakening evidence gates.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and the repository Issues.

## Research direction

ZORYQ is researching **adaptive verifiable execution** — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state.

This is a research direction, not a production or performance claim. It should advance through:

**specification → prototype → test → benchmark → independent reproduction → supported capability**

## Publication rule

Do not publish or repeat claims about TPS, finality, decentralization, congestion isolation, parallel execution, security, audit status or production readiness unless a linked artifact supports them.

For measurable claims, publish at minimum:

- commit hash;
- environment/hardware;
- node count and topology;
- workload/configuration;
- duration;
- raw output;
- methodology;
- limitations.

## Next milestone

The highest-value onboarding milestone is a public, repeatable **Fresh Wallet → Faucet → Balance → Signed Transaction → Receipt** walkthrough. Once that gate passes, this document should be upgraded from a readiness map into a copy-paste zero-to-build tutorial.
