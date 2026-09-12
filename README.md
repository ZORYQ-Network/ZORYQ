# ZORYQ Network

**Experimental EVM-compatible blockchain testnet for evidence-first Web3 engineering.**

ZORYQ is an early-stage public blockchain project building an EVM-compatible test network and developer platform. The engineering rule is simple: **technical claims must be backed by code, tests, reproducible measurements, or clearly labeled research.**

> **Current stage:** active experimental development / public testnet. This repository does not claim production-mainnet readiness, audited security, decentralization, novel consensus, or measured high-performance unless a linked artifact explicitly proves it.

## Why ZORYQ exists

Blockchain systems often mix roadmap language, research ideas and measured capabilities. ZORYQ is being developed around a stricter evidence model: separate what exists today from what is being researched, then make important technical claims reproducible.

A provisional research direction is **adaptive verifiable execution**: exploring how a blockchain architecture could dynamically handle different transaction workloads while preserving deterministic state. This remains research until implementation, tests and reproducible evidence demonstrate it.

## Start exploring

| Area | Evidence | Status |
| --- | --- | --- |
| Developer onboarding | [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md) | Evidence-gated path |
| External operator challenge | [Issue #73](https://github.com/ZORYQ-Network/ZORYQ/issues/73) | Looking for first independent Node 2 + developer reproduction |
| Project overview | [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Active |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Documented |
| Protocol | [`PROTOCOL.md`](PROTOCOL.md), [`SPECIFICATION.md`](SPECIFICATION.md) | Being established |
| Security | [`SECURITY.md`](SECURITY.md), [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md) | Active baseline |
| Research | [`RESEARCH.md`](RESEARCH.md), [`research/`](research/) | Active |
| Benchmarks | [`BENCHMARKS.md`](BENCHMARKS.md), [`benchmarks/`](benchmarks/) | Evidence framework; results not claimed |
| Roadmap | [`docs/ROADMAP.md`](docs/ROADMAP.md) | Active |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) | Open |

## External operator challenge

ZORYQ is actively looking for its first **independent external node operator/developer**. The challenge is intentionally evidence-first: run Node 2 on infrastructure you control, peer with the public testnet, publish non-secret convergence evidence, then attempt the developer path without private assistance.

Start here: **[Issue #73 — run an independent ZORYQ Node 2 and reproduce the developer path](https://github.com/ZORYQ-Network/ZORYQ/issues/73)**.

A second process controlled by the ZORYQ primary operator does not count as independent evidence. Never publish private keys, mnemonics, discovery secrets, provider tokens or infrastructure credentials.

## Developer path

The target funnel is:

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

The current P0 is **Faucet → First Transaction**. ZORYQ will not promote a zero-to-build flow as stable until an external developer can reproduce a fresh-wallet funding and signed transaction path with public evidence. Track the blocker in [Issue #55](https://github.com/ZORYQ-Network/ZORYQ/issues/55) and see [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md).

## Network

- **Name:** ZORYQ Testnet
- **Chain ID:** `5919065`
- **Compatibility target:** EVM
- **Stage:** public testnet / active development
- **Public web:** https://zoryq-testnet.vercel.app
- **X:** https://x.com/ZORIQNetwork

Stable RPC, explorer, faucet, wallet and deployment instructions will be promoted here only after they are reproducible enough for external developers. Until then, absence of a link should be read as **not yet publicly supported**, not as an invitation to guess an endpoint.

## For developers

ZORYQ is looking for contributors who care about blockchain execution, distributed systems, EVM tooling, testing, security, developer experience and reproducible performance work.

A useful contribution does not need to be large. Good starting areas include:

- improve documentation and reproducibility;
- add tests for explicit failure cases;
- improve developer onboarding;
- inspect RPC and EVM compatibility behavior;
- create benchmark workloads and methodology without inventing results;
- document architecture decisions and limitations;
- turn research questions into falsifiable experiments.

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Public contribution opportunities are tracked through GitHub Issues.

## Engineering principles

- **Evidence first** — measured claims link to methodology and raw results.
- **Research is labeled** — hypotheses stay separate from implemented behavior.
- **Security before marketing** — critical risks block release claims.
- **Reproducibility** — another engineer should be able to rebuild a result.
- **Determinism before speed** — optimization cannot silently weaken correctness.
- **Failures are data** — negative results and known limitations are documented.
- **No vanity engineering** — green CI is not a substitute for valid evidence.

## Research directions

Current or planned research areas may include:

- adaptive and parallel execution;
- dependency-aware scheduling;
- verifiable execution receipts;
- explicit confirmation/finality semantics;
- congestion isolation;
- state recovery and divergence detection;
- safe autonomous optimization;
- verifiable compute and future cryptographic research.

**These are research directions, not performance claims.** A concept should progress through specification → prototype → test → benchmark → risk analysis before being described as a proven ZORYQ capability.

See [`RESEARCH.md`](RESEARCH.md), [`PROTOCOL.md`](PROTOCOL.md) and [`SPECIFICATION.md`](SPECIFICATION.md).

## Evidence standard

ZORYQ does **not** treat target numbers as measured results. Any future TPS, latency, finality, recovery or resource claim should include at minimum:

1. commit hash;
2. hardware and operating system;
3. node count and topology;
4. workload and configuration;
5. test duration;
6. raw output;
7. methodology;
8. limitations.

See [`BENCHMARKS.md`](BENCHMARKS.md).

## Repository map

```text
.github/            CI workflows and contribution templates
docs/               Architecture, security and operational documentation
docs/adr/           Architecture Decision Records
rfcs/                Proposed protocol/product changes
research/            Research notes, experiments and results
benchmarks/          Reproducible benchmark definitions and results
zoryq-src.tgz        Temporary packaged mobile source used by APK workflow
```

The packaged mobile source is a known repository limitation. The target is first-class source directories, lockfiles, reviewable diffs, tests and dependency tooling without archive extraction.

## Security

Do not publish wallet, signing, authentication, treasury, swap-routing, infrastructure-secret or other sensitive vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md).

## Build in public

ZORYQ intends to publish engineering progress without turning unfinished work into marketing claims. Expect specifications, experiments, failures, CI evidence, benchmarks and implementation milestones to become more visible as they are validated.

## Search / discovery

Relevant areas: **EVM blockchain, blockchain testnet, Web3 infrastructure, distributed systems, blockchain execution, deterministic state, parallel execution, adaptive execution, verifiable execution, blockchain benchmarking, RPC compatibility, developer tooling, blockchain research.**

---

**ZORYQ Network — make the engineering verifiable, then let the evidence speak.**
