# ZORYQ

**Autonomous Economic Network — useful applications, portable identity, bounded autonomous agents and verifiable execution.**

ZORYQ is an experimental Web3 platform built as one system across five layers:

1. **ZORYQ Chain** — public EVM-compatible testnet and execution/evidence infrastructure.
2. **ZORYQ Identity + Wallet** — local self-custody, recovery, signing and application identity.
3. **ZORYQ Autonomous Network** — bounded agents, tasks, proof and economic coordination.
4. **ZORYQ Applications** — Social, Games, AI App Factory and future experiences.
5. **ZORYQ Economy** — transparent application/agent payments, treasury boundaries and settlement.

The engineering rule is strict: **important claims must be backed by reviewable source, CI, reproducible public evidence or clearly labeled research.**

> **Current stage:** active experimental development / public testnet. ZORYQ does not claim production-mainnet readiness, audited security, decentralization, universal application generation, measured high performance or product-market fit unless a linked artifact proves the exact claim.

## Command Center

The canonical status model lives in [`command-center/status.json`](command-center/status.json) and is rendered by [`command-center/index.html`](command-center/index.html).

Status language:

- **PROVEN** — reproducible source, CI or public proof exists.
- **WORKING** — implementation exists, but an important production/evidence gate remains.
- **NOT_PROVEN** — required evidence is absent; the production claim is not allowed.

Core source-of-truth documents:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/PRODUCT_MAP.md`](docs/PRODUCT_MAP.md)
- [`docs/NETWORK_STATUS.md`](docs/NETWORK_STATUS.md)
- [`docs/MAINNET_READINESS.md`](docs/MAINNET_READINESS.md)
- [`docs/WALLET_ARCHITECTURE.md`](docs/WALLET_ARCHITECTURE.md)
- [`docs/SOCIAL_ARCHITECTURE.md`](docs/SOCIAL_ARCHITECTURE.md)
- [`docs/GAMES_ARCHITECTURE.md`](docs/GAMES_ARCHITECTURE.md)
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md)

## Platform architecture

```text
ZORYQ Applications
 Social · Games · AI App Factory
            │
ZORYQ Autonomous Network
 goals · agents · tasks · proof · bounded authority
            │
ZORYQ Identity + Wallet
 BIP-39 · BIP-44 · Keystore · EIP-155 · EIP-712
            │
ZORYQ Economy
 user funds · treasury · fees · agent/app commerce
            │
ZORYQ Chain
 EVM testnet · RPC · state · nodes · evidence
```

This is the logical product architecture. It is not a claim that each target capability is production-ready.

## ZORYQ Chain

- **Network:** ZORYQ Testnet
- **Chain ID:** `5919065`
- **Compatibility target:** EVM
- **Stage:** public experimental testnet
- **Public RPC:** https://zoryq-evm-node-live-production.up.railway.app/rpc
- **Public faucet:** https://zoryq-evm-node-live-production.up.railway.app/faucet/claim
- **Developer surface:** https://zoryq-evm-node-live-production.up.railway.app/developer
- **Public web:** https://zoryq-testnet.vercel.app

Testnet ZQ has no implied monetary value.

On **2026-09-12**, an independent developer reproduced the public first-transaction path from a local machine:

**public RPC → public faucet → fresh wallet → funded balance → signed transaction → confirmed receipt**

That evidence proves external reproducibility of the first-transaction path. It does **not** prove decentralization, independent node operation, audited security or mainnet readiness. See [`docs/EXTERNAL_TRACTION_EVIDENCE.md`](docs/EXTERNAL_TRACTION_EVIDENCE.md).

The highest-value remaining network gate is an independently controlled **Node 2** with peer, convergence and restart/rejoin evidence. See [`docs/EXTERNAL_NODE2_HANDOFF.md`](docs/EXTERNAL_NODE2_HANDOFF.md).

## ZORYQ Identity + Wallet

Canonical reviewable Android source is under [`mobile-games-native/wallet-host/`](mobile-games-native/wallet-host/).

Current Testnet RC source includes:

- watch-only EVM balance/nonce access;
- BIP-39 12-word wallet recovery/import;
- Ethereum BIP-44 path `m/44'/60'/0'/0/0`;
- Android Keystore protected encryption-key lifecycle;
- AES-GCM encrypted wallet secrets;
- explicit testnet transaction confirmation;
- EIP-155 native ZQ signing/broadcast;
- personal-sign/EIP-712 identity signing;
- unit coverage for transfer, address, signing and recovery boundaries.

Seed phrases/private keys never belong in Social, Games, backend APIs, analytics or logs.

The legacy distributed Android package used a historical debug-signing identity. ZORYQ therefore does not treat that shared/debug credential as a production trust anchor. A future production release requires an exclusive ZORYQ release key and independent assessment of the critical Wallet flow.

## ZORYQ Autonomous Network

The primary differentiated target experience is:

> **Give ZORYQ a goal and a budget. It creates a bounded autonomous company of agents that works, hires, pays, receives and accounts with verifiable evidence.**

Current building blocks include:

- [`autonomous/`](autonomous/) — company and Proof Pack schemas/validation;
- [`zoryq-developer/obep/`](zoryq-developer/obep/) — outcome-bound proof/interoperability tooling;
- [`docs/ZORYQ_AUTONOMOUS_COMPANY.md`](docs/ZORYQ_AUTONOMOUS_COMPANY.md) — product and evidence gates.

The end-to-end experience remains evidence-gated. Schemas and reference proofs do not by themselves prove a fully autonomous production company.

## ZORYQ Applications

### Social

The canonical native client is part of `mobile-games-native/wallet-host/`. It implements local-first social state plus a remote API client, with wallet authentication through explicit local signatures. Social never receives the Wallet private key or mnemonic.

See [`docs/SOCIAL_ARCHITECTURE.md`](docs/SOCIAL_ARCHITECTURE.md).

### Games

The native runtime is under [`mobile-games-native/runtime/`](mobile-games-native/runtime/).

Current source includes:

- ZORYQ Games Hub;
- **ZORYQ Rush** — playable runner vertical slice;
- **ZORYQ Arena** — working combat vertical slice;
- **ZORYQ Empire** — working colony/economy vertical slice;
- scoped Wallet/Game bridge and runtime tests.

Normal gameplay stays offchain. Blockchain should be used only where durable identity, ownership, settlement or verifiable achievements add value.

See [`docs/GAMES_ARCHITECTURE.md`](docs/GAMES_ARCHITECTURE.md).

### AI App Factory

The target loop is:

**Prompt → objective understanding → usable application → Web/Android → optional ZORYQ integration → verifiable proof → evolution.**

Current Factory capabilities remain bounded/evidence-gated. Arbitrary universal application generation, dynamic backends/databases/auth and a unique production APK for every prompt are not claimed until implemented and reproduced.

See [`docs/AI_APP_FACTORY_FLAGSHIP.md`](docs/AI_APP_FACTORY_FLAGSHIP.md).

## ZORYQ Economy

Reference evolution-payment logic lives under [`payments/`](payments/). Production economics must keep user funds, treasury funds, agent budgets, application fees and game economies explicitly separated.

Future agent spending must be bounded by policy and never default to unlimited authority.

## Mobile reproducibility

The canonical mobile source now exists as normal reviewable repository files under `mobile-games-native/`.

Active mobile CI is being consolidated around that tree:

- `Build ZORYQ Android APK` builds Wallet/Games from reviewable source;
- `Export reviewable mobile source` exports the same source tree with deterministic inventory/checksums;
- `ZORYQ Mobile Native` tests/builds runtime and Wallet host.

The historical `zoryq-src.tgz` archive is legacy debt and is **not** the canonical source. Its removal/quarantine is tracked as repository cleanup after workflow migration evidence is green.

## Mainnet

**Mainnet is not claimed.**

Mainnet promotion requires evidence for independent operators, multi-node convergence, deterministic execution/conformance, disaster recovery, key custody, incident response, external audit, production signing, upgrade/rollback and a hash-bound launch manifest.

See [`docs/MAINNET_READINESS.md`](docs/MAINNET_READINESS.md) and [`docs/MAINNET_RECOVERY_AND_AUDIT_GATES.md`](docs/MAINNET_RECOVERY_AND_AUDIT_GATES.md).

## Developer path

The intended developer funnel is:

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

The first-transaction step has independent external evidence. The next meaningful proof is external contract/application work plus an independently controlled Node 2.

Read [`docs/DEVELOPER_ONBOARDING.md`](docs/DEVELOPER_ONBOARDING.md) and [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Repository map

```text
.github/             CI, security and evidence workflows
autonomous/          Autonomous Company schemas / Proof Pack work
benchmarks/          benchmark definitions/results framework
command-center/      unified evidence dashboard and status registry
docs/                source-of-truth plus supporting evidence
infra/               network/deployment reproduction artifacts
mobile-games-native/ canonical native Android Wallet/Social/Games source
payments/            economy/payment reference modules
research/            explicitly non-production research
rfcs/                 proposed protocol/design changes
tools/                evidence/network developer tooling
zoryq-developer/     developer and OBEP proof tooling
```

Migration/cleanup decisions are recorded in [`docs/REPOSITORY_AUDIT.md`](docs/REPOSITORY_AUDIT.md). Working source is not moved simply for cosmetic organization; structural moves must update imports, CI and documentation atomically.

## Engineering principles

- **Evidence first** — measured claims link to evidence.
- **One platform** — features belong to a defined layer instead of becoming disconnected projects.
- **Useful software first** — blockchain appears where it adds value.
- **Security before marketing** — critical risks block release claims.
- **Research is labeled** — hypotheses remain separate from implementation.
- **Reproducibility** — another engineer should be able to inspect/build/prove the result.
- **No vanity engineering** — green CI is not adoption or decentralization.
- **No vanity traction** — project-controlled activity is not independent adoption.

---

**ZORYQ — Autonomous Economic Network. Build useful systems; make critical actions verifiable.**
