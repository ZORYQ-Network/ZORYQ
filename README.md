# ZORYQ Network

**Experimental Web3 network and product research project — build, test, validate.**

ZORYQ is an early-stage project exploring an EVM-compatible blockchain network together with developer, wallet, swap, SocialFi and mobile product infrastructure.

> **Current status:** active experimental development. This repository does not represent a production mainnet and should not be interpreted as evidence of production readiness, audited security, measured throughput, validator decentralization or other capabilities unless linked to reproducible evidence.

## Repository scope

This repository currently contains project documentation, GitHub workflows and the packaged source used by the mobile build pipeline. The full node/protocol implementation is not presently exposed as normal source files in this repository.

That distinction matters: documentation may describe intended architecture or active research, but only implemented code, tests, reproducible benchmarks and deployed infrastructure should be treated as evidence that a capability exists.

See [`docs/REPOSITORY_STATUS.md`](docs/REPOSITORY_STATUS.md) for the current evidence boundary.

## ZORYQ Testnet

- **Network:** ZORYQ Testnet
- **EVM compatible:** project target / active testnet work
- **Chain ID:** `5919065`
- **Stage:** experimental testnet development
- **Public web:** https://zoryq-testnet.vercel.app
- **X:** https://x.com/ZORIQNetwork

Public endpoints and interfaces may change while the project is experimental.

## What ZORYQ is building

Current product and research areas include:

- EVM-compatible blockchain/testnet work
- RPC and network infrastructure
- developer and application testing
- node-operator infrastructure
- explorer and network visibility
- wallet / ZORYQ Vault
- swap and cross-chain product work
- SocialFi experiments
- XP, quests and participation systems
- mobile application for Android/iOS

## Engineering principles

ZORYQ uses an evidence-first standard:

- claims should link to code, tests, benchmark methodology or deployed infrastructure;
- speculative or planned work must be labeled as such;
- negative test and benchmark results should not be hidden;
- security-sensitive changes require additional review;
- branding consistency must not replace technical substance.

## Architecture and research

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current product architecture documentation
- [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md) — current threat model
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — staged product roadmap
- [`docs/REPOSITORY_STATUS.md`](docs/REPOSITORY_STATUS.md) — what this repository currently proves
- [`docs/adr/README.md`](docs/adr/README.md) — Architecture Decision Records
- [`rfcs/README.md`](rfcs/README.md) — protocol/product RFC process

## For developers

ZORYQ is intended for builders who want to experiment with Web3 infrastructure and EVM-compatible application flows in a developing environment.

Before contributing, read [`CONTRIBUTING.md`](CONTRIBUTING.md). Material architectural changes should be documented as an ADR or RFC rather than introduced only through implementation.

## Security

See [`SECURITY.md`](SECURITY.md) before reporting vulnerabilities. Never publish seed phrases, private keys, signing secrets, infrastructure credentials or sensitive exploit details in public issues.

## Build. Test. Validate.

ZORYQ is still early. The objective of the current phase is to convert architectural ideas into code, tests, measurable validation and reproducible evidence before production use.

---

**ZORYQ Network — experimental Web3 infrastructure and product research.**
