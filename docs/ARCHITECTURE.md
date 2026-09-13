# ZORYQ Unified Architecture

ZORYQ is one evidence-first platform organized into five layers. Wallet, Social, Games, Autonomous Company, payments and the chain are not independent projects.

## Canonical model

```text
┌───────────────────────────────────────────────────────┐
│  ZORYQ APPLICATIONS                                  │
│  Social · Games · AI App Factory · future apps       │
└───────────────────────────┬───────────────────────────┘
                            │ scoped identity/actions
┌───────────────────────────▼───────────────────────────┐
│  ZORYQ AUTONOMOUS NETWORK                            │
│  goals · agents · tasks · proof · bounded authority  │
└───────────────────────────┬───────────────────────────┘
                            │ identity / signing
┌───────────────────────────▼───────────────────────────┐
│  ZORYQ IDENTITY + WALLET                             │
│  BIP-39 · BIP-44 · Keystore · EIP-155 · EIP-712     │
└───────────────────────────┬───────────────────────────┘
                            │ payments / settlement
┌───────────────────────────▼───────────────────────────┐
│  ZORYQ ECONOMY                                       │
│  user funds · treasury · fees · agent/app commerce   │
└───────────────────────────┬───────────────────────────┘
                            │ execution / evidence
┌───────────────────────────▼───────────────────────────┐
│  ZORYQ CHAIN                                         │
│  EVM testnet · RPC · state · nodes · protocol        │
└───────────────────────────────────────────────────────┘
```

The arrows describe logical dependencies, not production-readiness claims.

## Evidence status model

Every important capability is classified as:

- **PROVEN** — reproducible code, CI or public proof exists.
- **WORKING** — implementation exists, but an important production/evidence gate remains.
- **NOT_PROVEN** — required evidence is absent; no production claim is allowed.

The machine-readable registry is `../command-center/status.json` and the human dashboard is `../command-center/index.html`.

## Layer 1 — ZORYQ Chain

Responsibilities:

- chain/network identity;
- RPC and transaction admission;
- deterministic execution/state;
- EVM compatibility boundary;
- networking and peer discovery;
- consensus/finality where implemented;
- storage, snapshots and recovery;
- observability and operator tooling;
- evidence/proof layers when validated.

Normative protocol behavior belongs in `../SPECIFICATION.md`, RFCs and accepted ADRs. Experimental execution ideas remain under `../research/` until proved.

Current network status is centralized in `NETWORK_STATUS.md`. Mainnet status is centralized in `MAINNET_READINESS.md`.

## Layer 2 — ZORYQ Identity + Wallet

Canonical reviewable Android implementation is under `../mobile-games-native/wallet-host/`.

Current source includes:

- watch-only EVM account access;
- BIP-39 12-word recovery;
- Ethereum BIP-44 path `m/44'/60'/0'/0/0`;
- Android Keystore protected encryption key;
- locally protected wallet secret lifecycle;
- EIP-155 native transaction signing;
- personal-sign/EIP-712 support for application identity;
- explicit transaction confirmation.

Private keys and seed phrases must never transit through Social, Games, analytics or backend APIs. See `WALLET_ARCHITECTURE.md` and `SECURITY_MODEL.md`.

## Layer 3 — ZORYQ Autonomous Network

The core target experience is:

> Give ZORYQ a goal and a budget. It creates a bounded autonomous company of agents that works, hires, pays, receives and accounts with verifiable evidence.

Current implementation/evidence building blocks:

- `../autonomous/` — company/Proof Pack schemas and validation;
- `../zoryq-developer/obep/` — outcome-bound economic proof / interoperability tooling;
- `ZORYQ_AUTONOMOUS_COMPANY.md` — product/evidence gates.

Authority must be explicit, bounded and revocable. Agent activity is not production-trusted merely because a reference schema or proof format exists.

## Layer 4 — ZORYQ Applications

Applications consume Identity/Wallet and Autonomous services without owning wallet secrets.

### Social

Canonical mobile client path: `../mobile-games-native/wallet-host/`.

Wallet authentication uses explicit local signatures. Local-first data is allowed; remote authorization remains server-side. See `SOCIAL_ARCHITECTURE.md`.

### Games

Canonical native runtime: `../mobile-games-native/runtime/`.

The Games Hub, Rush, Arena and Empire share a bridge that is intentionally separated from wallet secret material. See `GAMES_ARCHITECTURE.md`.

### AI App Factory

Factory claims remain evidence-gated by `AI_APP_FACTORY_FLAGSHIP.md`. Template-based generation must not be marketed as universal arbitrary software generation.

## Layer 5 — ZORYQ Economy

Economic components include:

- user-controlled balances;
- treasury flows;
- application/evolution payments;
- future bounded agent budgets;
- marketplace/service settlement;
- optional game/application economies.

Current payment reference code lives under `../payments/`. User funds, treasury funds and agent budgets must remain logically and operationally separated.

## Transaction UX boundary

For application-mediated transactions:

1. application requests a scoped operation;
2. destination/value/chain context is constructed or fetched;
3. material fields are validated;
4. Wallet presents the operation to the user;
5. user explicitly confirms;
6. signing happens locally;
7. signed payload is broadcast;
8. applications/backend receive only permitted public metadata;
9. reward/accounting logic consumes verifiable outcomes, not client claims alone.

## Repository architecture rule

A new module must have one primary owner layer and one evidence path. If a feature needs to bypass Wallet security boundaries or duplicate another subsystem, architecture must be resolved before promotion.

Repository cleanup/migration decisions are tracked in `REPOSITORY_AUDIT.md`.
