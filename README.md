# ZORYQ Network

**Experimental EVM-compatible blockchain testnet for evidence-first Web3 engineering and verifiable agent commerce.**

ZORYQ is an early-stage public blockchain project building an EVM-compatible test network, developer platform and an **Agent Commerce & Trust Layer** for economically active AI agents.

The engineering rule is simple: **technical claims must be backed by code, tests, reproducible measurements, or clearly labeled research.**

> **Current stage:** active experimental development / public testnet. This repository does not claim production-mainnet readiness, audited security, decentralization, novel consensus, product-market fit or measured high-performance unless a linked artifact explicitly proves it.

## Flagship product direction — Autonomous Company

> **Give ZORYQ a goal and a budget. It creates a bounded autonomous company of agents that works, hires, pays, earns and accounts onchain.**

The target experience combines agent identity, scoped authority, task/service hiring, onchain payments, evidence-backed accounting and a portable Proof Pack. Capability claims remain gated until each part has a reproducible public testnet proof.

Read [`docs/ZORYQ_AUTONOMOUS_COMPANY.md`](docs/ZORYQ_AUTONOMOUS_COMPANY.md) and track the MVP in [Issue #59](https://github.com/ZORYQ-Network/ZORYQ/issues/59).

## Verified external traction

On **2026-09-12**, an independent developer reproduced the ZORYQ public first-transaction path from a local machine:

**public RPC → public faucet → fresh wallet → funded balance → signed transaction → confirmed receipt**

The published evidence used Chain ID `5919065`, received `100 ZQ` from the public testnet faucet and produced a transaction included in block `112071` with receipt `status=1`.

See [`docs/EXTERNAL_TRACTION_EVIDENCE.md`](docs/EXTERNAL_TRACTION_EVIDENCE.md) and completed [Issue #88](https://github.com/ZORYQ-Network/ZORYQ/issues/88).

**Claim boundary:** this proves external developer reproducibility for the first-transaction path. It does not by itself prove independent node operation, decentralization, audited security or mainnet readiness.

## Start exploring

| Area | Evidence | Status |
| --- | --- | --- |
| External traction | [`docs/EXTERNAL_TRACTION_EVIDENCE.md`](docs/EXTERNAL_TRACTION_EVIDENCE.md) | First independent developer transaction verified |
| Investor readiness | [`docs/INVESTOR_READINESS.md`](docs/INVESTOR_READINESS.md) | Evidence-gated plan |
| Autonomous Company | [`docs/ZORYQ_AUTONOMOUS_COMPANY.md`](docs/ZORYQ_AUTONOMOUS_COMPANY.md) | MVP evidence gates open |
| Developer onboarding | [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md) | Public first-transaction reproduction achieved |
| Independent Node 2 | [Issue #73](https://github.com/ZORYQ-Network/ZORYQ/issues/73) | Still open — highest-value external network gate |
| Project overview | [`docs/PROJECT_OVERVIEW.md`](docs/PROJECT_OVERVIEW.md) | Active |
| Architecture | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Documented |
| Protocol | [`PROTOCOL.md`](PROTOCOL.md), [`SPECIFICATION.md`](SPECIFICATION.md) | Being established |
| Security | [`SECURITY.md`](SECURITY.md), [`docs/SECURITY_THREAT_MODEL.md`](docs/SECURITY_THREAT_MODEL.md) | Active baseline |
| Research | [`RESEARCH.md`](RESEARCH.md), [`research/`](research/) | Active |
| Benchmarks | [`BENCHMARKS.md`](BENCHMARKS.md), [`benchmarks/`](benchmarks/) | Evidence framework; results not claimed |
| Roadmap | [`docs/ROADMAP.md`](docs/ROADMAP.md) | Active |
| Contributing | [`CONTRIBUTING.md`](CONTRIBUTING.md) | Open |

## Network

- **Name:** ZORYQ Testnet
- **Chain ID:** `5919065`
- **Compatibility target:** EVM
- **Stage:** public experimental testnet / active development
- **Public RPC:** https://zoryq-evm-node-live-production.up.railway.app/rpc
- **Public faucet:** https://zoryq-evm-node-live-production.up.railway.app/faucet/claim
- **Developer surface:** https://zoryq-evm-node-live-production.up.railway.app/developer
- **Public web:** https://zoryq-testnet.vercel.app
- **X:** https://x.com/ZORIQNetwork

Testnet ZQ has no implied monetary value.

## Developer path

The target funnel is:

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

The `Faucet → First Transaction` path now has independent external evidence. The next traction target is to move multiple independent developers through **First Contract → First Application**, while finishing the remaining faucet reliability/observability requirements tracked in [Issue #55](https://github.com/ZORYQ-Network/ZORYQ/issues/55).

## External operator challenge

The developer-reproduction half of the external challenge is now complete. The remaining high-value network milestone is a truly **independently controlled Node 2** that peers with the testnet and publishes convergence, restart/rejoin and non-secret peer evidence.

Start here: [Issue #73](https://github.com/ZORYQ-Network/ZORYQ/issues/73) and [`docs/EXTERNAL_NODE2_HANDOFF.md`](docs/EXTERNAL_NODE2_HANDOFF.md).

A second process controlled by the ZORYQ primary operator does not count as independent evidence. Never publish private keys, mnemonics, discovery secrets, provider tokens or infrastructure credentials.

## Why ZORYQ exists

ZORYQ is being developed around a stricter evidence model: separate what exists today from what is being researched, then make important technical and product claims independently reproducible.

The intended product wedge is not simply "another generic EVM chain." The project is exploring infrastructure for **verifiable economic activity by autonomous software**: who an agent is, what it is allowed to do, what it intended, what it actually executed, what it paid or received, and what evidence supports the result.

A parallel research direction is **adaptive verifiable execution**: exploring how blockchain execution could handle different transaction workloads while preserving deterministic state. This remains research until implementation, tests and reproducible evidence demonstrate it.

## For developers

ZORYQ is looking for contributors who care about blockchain execution, distributed systems, EVM tooling, AI-agent infrastructure, testing, security, developer experience and reproducible performance work.

Useful contribution paths include:

- run the public onboarding proof independently;
- run an independent Node 2;
- build an external dApp on ZORYQ;
- improve documentation and reproducibility;
- add explicit failure/adversarial tests;
- inspect RPC and EVM compatibility behavior;
- improve the Autonomous Company evidence path;
- create benchmark workloads and methodology without inventing results.

Read [`CONTRIBUTING.md`](CONTRIBUTING.md). Public contribution opportunities are tracked through GitHub Issues.

## Investor / partner view

ZORYQ is not using unverified token-price or adoption claims as a substitute for traction. The current fundraising strategy is to accumulate evidence that changes the investment conversation:

1. independent developers;
2. independent node operators;
3. external applications;
4. a reproducible Autonomous Company vertical slice;
5. external reproduction of that product;
6. paid pilots / customers;
7. security and operational maturity.

See [`docs/INVESTOR_READINESS.md`](docs/INVESTOR_READINESS.md).

## Engineering principles

- **Evidence first** — measured claims link to methodology and raw results.
- **Research is labeled** — hypotheses stay separate from implemented behavior.
- **Security before marketing** — critical risks block release claims.
- **Reproducibility** — another engineer should be able to rebuild a result.
- **Determinism before speed** — optimization cannot silently weaken correctness.
- **Failures are data** — negative results and known limitations are documented.
- **No vanity engineering** — green CI is not a substitute for valid evidence.
- **No vanity traction** — project-controlled activity does not count as independent adoption.

## Evidence standard

ZORYQ does **not** treat target numbers as measured results. Any TPS, latency, finality, recovery, node-distribution or adoption claim should include the evidence needed to reproduce or audit it.

For technical benchmark claims, include at minimum:

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
docs/               Architecture, security, product and operational documentation
docs/adr/           Architecture Decision Records
rfcs/                Proposed protocol/product changes
research/            Research notes, experiments and results
benchmarks/          Reproducible benchmark definitions and results
autonomous/          Autonomous Company / agent-commerce implementation work
```

The mobile source/build path has known reproducibility debt tracked in [Issue #58](https://github.com/ZORYQ-Network/ZORYQ/issues/58); broad mobile promotion should not outrun that evidence gate.

## Security

Do not publish wallet, signing, authentication, treasury, swap-routing, infrastructure-secret or other sensitive vulnerabilities in a public issue. Follow [`SECURITY.md`](SECURITY.md).

## Build in public

ZORYQ intends to publish engineering progress without turning unfinished work into marketing claims. Expect specifications, experiments, failures, CI evidence, benchmarks, external reproductions and implementation milestones to become more visible as they are validated.

## Search / discovery

Relevant areas: **EVM blockchain, blockchain testnet, Web3 infrastructure, AI agents, autonomous agents, agent commerce, verifiable execution, onchain payments, distributed systems, deterministic state, parallel execution, blockchain benchmarking, RPC compatibility, developer tooling, blockchain research.**

---

**ZORYQ Network — make the engineering verifiable, then let the evidence speak.**
