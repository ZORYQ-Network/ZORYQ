# ZORYQ

**Experimental EVM-compatible Web3 network and application platform — build, test, validate, and measure.**

ZORYQ is an early-stage project combining a developing EVM-compatible test network with a mobile-first Web3 product stack. The project is being organized around a simple engineering rule: **technical claims must be backed by code, tests, reproducible measurements, or clearly labeled research.**

> **Current stage:** active experimental development. This repository is not evidence of production-mainnet readiness, a completed novel consensus protocol, audited security, or measured high-performance claims unless a linked artifact explicitly proves it.

## Start here

| Area | Current repository evidence | Status |
| --- | --- | --- |
| Project overview | `README.md`, `docs/PROJECT_OVERVIEW.md` | Active |
| Product architecture | `docs/ARCHITECTURE.md`, `docs/WALLET_ARCHITECTURE.md` | Documented |
| Mobile build | `.github/workflows/android-apk.yml` | Automated experimental build |
| Security baseline | `SECURITY.md`, `docs/SECURITY_THREAT_MODEL.md`, `docs/SECURITY_CHECKLIST.md` | Active baseline |
| Protocol specification | `PROTOCOL.md`, `SPECIFICATION.md` | Being established |
| Research process | `RESEARCH.md`, `research/` | Being established |
| Reproducible benchmarks | `BENCHMARKS.md`, `benchmarks/` | Not yet demonstrated |
| ADR / RFC process | `docs/adr/`, `rfcs/` | Being established |
| Production mainnet | — | **Not claimed here** |

## What is ZORYQ?

ZORYQ currently has two related engineering tracks:

1. **Network / protocol track** — EVM-compatible blockchain infrastructure, node and RPC behavior, transaction semantics, recovery, finality, networking, execution and future verifiable-execution research.
2. **Application track** — ZORYQ Vault, swap/cross-chain interfaces, SocialFi, XP/quests, mobile clients and developer-facing product experiences.

These tracks must not be conflated. A product feature does not prove a protocol innovation, and a research hypothesis is not considered implemented until code, tests and evidence exist.

## Network information

- **Network:** ZORYQ Testnet
- **EVM compatibility target:** Yes
- **Chain ID:** `5919065`
- **Declared stage:** public testnet / active development
- **Public web:** https://zoryq-testnet.vercel.app
- **X:** https://x.com/ZORIQNetwork

Network endpoints, explorer/faucet information and validator/node instructions should only be published here once they are stable and reproducible.

## Engineering principles

- **Evidence first:** measured claims link to methodology and raw results.
- **Research is labeled:** speculative ideas stay separate from implemented protocol behavior.
- **Security before marketing:** critical wallet, signing, RPC, consensus, state and CI risks block release work.
- **Reproducibility:** another engineer should be able to rebuild a result from a documented commit and environment.
- **Trade-offs are documented:** no architecture is presented as removing fundamental distributed-systems limits.
- **Failures are useful data:** negative results and known limitations are documented instead of hidden.

## Protocol and research direction

Areas being investigated or prepared for formal research may include:

- adaptive / parallel execution;
- dependency-aware scheduling;
- proof-carrying or verifiable execution receipts;
- explicit confirmation/finality levels;
- congestion isolation;
- state recovery and divergence detection;
- safe autonomous optimization;
- post-quantum and verifiable-compute research.

**These are research directions, not performance claims.** Each concept must progress through specification → prototype → test → benchmark → risk analysis before being described as a proven ZORYQ capability.

See [`RESEARCH.md`](RESEARCH.md), [`PROTOCOL.md`](PROTOCOL.md) and [`SPECIFICATION.md`](SPECIFICATION.md).

## Repository structure

```text
.github/            GitHub workflows and contribution templates
docs/               Product, security, architecture and operational documentation
docs/adr/           Architecture Decision Records
rfcs/                Proposed protocol/product changes
research/            Research notes, experiments and results
benchmarks/          Reproducible benchmark definitions and results
zoryq-src.tgz        Temporary packaged mobile source used by the APK workflow
```

The packaged mobile source is a **known repository limitation**. The long-term target is normal first-class source directories with lockfiles, reviewable diffs, tests and dependency tooling without requiring an archive extraction step.

## Build and validation

The current Android pipeline extracts the packaged mobile source, installs dependencies, runs TypeScript checks and Expo Doctor, generates the native Android project and builds an APK artifact.

For protocol-level work, build/run/test commands will be documented only when the corresponding implementation is present and reproducible in the repository.

## Security

Do not publish wallet, auth, signing, treasury, swap-routing, infrastructure-secret or other sensitive vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md).

Security-critical changes require stronger review than UI/documentation changes. See [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md).

## Benchmarks

ZORYQ does **not** treat target numbers as measured results. Any future TPS, latency, finality, recovery or resource claim must include:

- commit hash;
- hardware and operating system;
- node count and topology;
- workload and configuration;
- duration;
- raw output;
- methodology;
- limitations.

See [`BENCHMARKS.md`](BENCHMARKS.md).

## Contributing

Material architecture changes should begin as an issue, ADR or RFC as appropriate. Contributions should include tests and documentation proportional to their risk.

See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Roadmap

The repository roadmap must track engineering maturity rather than promotional dates. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

**ZORYQ — make the engineering verifiable, then let the evidence speak.**
