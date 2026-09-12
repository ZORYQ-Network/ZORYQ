# ZORYQ Network

**Experimental EVM-compatible blockchain testnet for evidence-first Web3 engineering, usable AI-generated applications and verifiable agent commerce.**

ZORYQ is an early-stage public blockchain project building an EVM-compatible test network, developer platform and product layer for AI-generated software and economically active AI agents.

The engineering rule is simple: **technical and product claims must be backed by code, tests, reproducible measurements, or clearly labeled research.**

> **Current stage:** active experimental development / public testnet. This repository does not claim production-mainnet readiness, audited security, decentralization, universal app generation, product-market fit or measured high-performance unless a linked artifact explicitly proves it.

## Product mission — three engines

ZORYQ is being shaped around three connected product engines:

1. **ZORYQ AI App Factory** — idea → usable application.
2. **Autonomous Company** — goal + budget → bounded agent organization that can work, hire, pay, receive and account onchain.
3. **ZORYQ Network** — verifiable infrastructure for identity, payments, execution and evidence.

The blockchain is infrastructure, not the end-user pitch. The target experience is useful software first, with ZORYQ introduced where verifiability, payments, ownership, identity or autonomous execution improve the product.

Read [`docs/AI_APP_FACTORY_FLAGSHIP.md`](docs/AI_APP_FACTORY_FLAGSHIP.md) for the product/traction loop and evidence boundaries.

## Flagship product engine — AI App Factory

> **Describe what you need. ZORYQ turns the idea into usable software and, when useful, connects that software to the blockchain.**

Target experience:

**Prompt → objective understanding → application generation → functional preview → Web app → Android APK → optional ZORYQ integration → verifiable onchain proof → sharing → application evolution.**

The current Factory is evidence-gated: template-based generated applications and an Android App Runner exist, while general arbitrary software generation, dynamic backends/databases/auth and a unique standalone APK for every prompt remain roadmap items until implemented and reproduced.

Experimental public surface: https://zoryq-evm-node-live-production.up.railway.app/launch-studio

## Flagship product engine — Autonomous Company

> **Give ZORYQ a goal and a budget. It creates a bounded autonomous company of agents that works, hires, pays, earns and accounts onchain.**

The target experience combines agent identity, scoped authority, task/service hiring, onchain payments, evidence-backed accounting and a portable Proof Pack. Capability claims remain gated until each part has a reproducible public testnet proof.

Read [`docs/ZORYQ_AUTONOMOUS_COMPANY.md`](docs/ZORYQ_AUTONOMOUS_COMPANY.md) and track the MVP in [Issue #59](https://github.com/ZORYQ-Network/ZORYQ/issues/59).

## Verified external traction

On **2026-09-12**, an independent developer reproduced the ZORYQ public first-transaction path from a local machine:

**public RPC → public faucet → fresh wallet → funded balance → signed transaction → confirmed receipt**

The published evidence used Chain ID `5919065`, received `100 ZQ` from the public testnet faucet and produced a transaction included in block `112071` with receipt `status=1`.

See [`docs/EXTERNAL_TRACTION_EVIDENCE.md`](docs/EXTERNAL_TRACTION_EVIDENCE.md) and completed [Issue #88](https://github.com/ZORYQ-Network/ZORYQ/issues/88).

**Claim boundary:** this proves external developer reproducibility for the first-transaction path. It does not by itself prove independent node operation, decentralization, audited security, Factory adoption or mainnet readiness.

## Start exploring

| Area | Evidence | Status |
| --- | --- | --- |
| AI App Factory | [`docs/AI_APP_FACTORY_FLAGSHIP.md`](docs/AI_APP_FACTORY_FLAGSHIP.md) | Flagship product strategy; current implementation is bounded/evidence-gated |
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
- **AI App Factory:** https://zoryq-evm-node-live-production.up.railway.app/launch-studio
- **Public web:** https://zoryq-testnet.vercel.app
- **X:** https://x.com/ZORIQNetwork

Testnet ZQ has no implied monetary value.

## Product and developer funnels

The Factory acquisition loop is:

**Visitor → creates first app → uses app → creates wallet → receives testnet ZQ → first transaction → useful onchain feature → shares app → returns → becomes builder / developer / contributor.**

The developer funnel is:

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

The `Faucet → First Transaction` path now has independent external evidence. The next product/traction target is to move real external users through **Prompt → usable application → Web/Android → first useful ZORYQ interaction**, while moving independent developers through **First Contract → First Application**.

## External operator challenge

The developer-reproduction half of the external challenge is now complete. The remaining high-value network milestone is a truly **independently controlled Node 2** that peers with the testnet and publishes convergence, restart/rejoin and non-secret peer evidence.

Start here: [Issue #73](https://github.com/ZORYQ-Network/ZORYQ/issues/73) and [`docs/EXTERNAL_NODE2_HANDOFF.md`](docs/EXTERNAL_NODE2_HANDOFF.md).

A second process controlled by the ZORYQ primary operator does not count as independent evidence. Never publish private keys, mnemonics, discovery secrets, provider tokens or infrastructure credentials.

## Why ZORYQ exists

ZORYQ is being developed around a stricter evidence model: separate what exists today from what is being researched, then make important technical and product claims independently reproducible.

The intended product wedge is not simply "another generic EVM chain." ZORYQ is exploring a product loop where people first receive useful software, then use blockchain capabilities only when those capabilities improve the experience. In parallel, the project is building infrastructure for **verifiable economic activity by autonomous software**: who an agent is, what it is allowed to do, what it intended, what it actually executed, what it paid or received, and what evidence supports the result.

A parallel research direction is **adaptive verifiable execution**: exploring how blockchain execution could handle different transaction workloads while preserving deterministic state. This remains research until implementation, tests and reproducible evidence demonstrate it.

## For developers

ZORYQ is looking for contributors who care about blockchain execution, distributed systems, EVM tooling, AI-generated software, AI-agent infrastructure, testing, security, developer experience and reproducible performance work.

Useful contribution paths include:

- reproduce the AI App Factory application path externally;
- extend the Factory beyond bounded templates with explicit tests and evidence;
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
3. externally used applications;
4. external Factory reproductions and retained users;
5. a reproducible Autonomous Company vertical slice;
6. external reproduction of that product;
7. paid pilots / customers;
8. security and operational maturity.

See [`docs/INVESTOR_READINESS.md`](docs/INVESTOR_READINESS.md).

## Engineering principles

- **Evidence first** — measured claims link to methodology and raw results.
- **Useful product first** — blockchain should appear where it adds value, not as friction for its own sake.
- **Research is labeled** — hypotheses stay separate from implemented behavior.
- **Security before marketing** — critical risks block release claims.
- **Reproducibility** — another engineer should be able to rebuild a result.
- **Determinism before speed** — optimization cannot silently weaken correctness.
- **Failures are data** — negative results and known limitations are documented.
- **No vanity engineering** — green CI is not a substitute for valid evidence.
- **No vanity traction** — project-controlled activity does not count as independent adoption.

## Evidence standard

ZORYQ does **not** treat target numbers as measured results. Any TPS, latency, finality, recovery, node-distribution, application-generation or adoption claim should include the evidence needed to reproduce or audit it.

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

Relevant areas: **AI app builder, AI app factory, generated applications, EVM blockchain, blockchain testnet, Web3 infrastructure, AI agents, autonomous agents, agent commerce, verifiable execution, onchain payments, distributed systems, deterministic state, parallel execution, blockchain benchmarking, RPC compatibility, developer tooling, blockchain research.**

---

**ZORYQ Network — useful software first, verifiable execution underneath.**
