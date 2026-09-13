# ZORYQ Product Map

**Canonical product model:** ZORYQ is one platform, not a collection of unrelated apps.

## Positioning

**ZORYQ — Autonomous Economic Network**

The platform is organized into five layers:

```text
ZORYQ Applications
  Social · Games · AI App Factory · future apps
                    │
ZORYQ Autonomous Network
  goals · agents · tasks · proof · bounded spending
                    │
ZORYQ Identity + Wallet
  identity · recovery · signing · sessions · permissions
                    │
ZORYQ Economy
  payments · treasury · fees · agent/application commerce
                    │
ZORYQ Chain
  EVM testnet · RPC · execution · state · nodes · evidence
```

The diagram is logical, not a claim that every target capability is production-ready.

## Layer 1 — Chain

Purpose: provide verifiable execution and public infrastructure.

Current evidence includes a public EVM-compatible testnet, Chain ID `5919065`, public RPC/faucet paths and an independently reproduced first transaction. Independent multi-operator operation and mainnet readiness remain separate gates.

## Layer 2 — Identity + Wallet

Purpose: make a wallet address the user's portable identity and local signing boundary.

The canonical Android source is `mobile-games-native/wallet-host/`. It contains watch-only account access, BIP-39/BIP-44 recovery, Android Keystore protected secret storage, EVM signing and explicit testnet transaction confirmation. Production signing, independent assessment and physical-device coverage remain release gates.

## Layer 3 — Autonomous Network

Purpose: turn a goal and bounded budget into verifiable work by agents.

Target experience:

> Give ZORYQ a goal and a budget. It creates a bounded company of agents that works, hires, pays, receives and accounts with verifiable evidence.

Current building blocks include `autonomous/` schemas/validation and `zoryq-developer/obep/` outcome-bound proof tooling. End-to-end independent reproduction is not yet claimed.

## Layer 4 — Applications

Applications prove the platform through useful experiences rather than forcing blockchain into every interaction.

- **ZORYQ Social** — wallet-authenticated social surface with local-first persistence and remote API client.
- **ZORYQ Games** — native Android Games Hub with Rush plus Arena/Empire vertical slices.
- **AI App Factory** — evidence-gated application generation path; arbitrary universal app generation remains a roadmap claim.

## Layer 5 — Economy

Purpose: connect users, applications and agents through transparent payments and accounting.

Current repository evidence includes the evolution-payment reference module under `payments/`. Future production economics must separate user funds, treasury funds, agent budgets, application fees and game economies.

## Product rule

Every new feature must answer three questions:

1. Which layer owns it?
2. What evidence proves it?
3. Does it strengthen the unified platform or create another disconnected product?

If ownership is unclear, the feature should not be promoted as canonical until architecture is resolved.
