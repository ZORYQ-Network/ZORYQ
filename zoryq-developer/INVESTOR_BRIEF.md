# ZORYQ — Technical Investor / Ecosystem Brief

## Thesis

ZORYQ is building an **Agent-Native Blockchain + Builder Intelligence Network** around an EVM-compatible public testnet. The near-term objective is not token speculation; it is proving that developers and AI agents can move from intent to a verifiable on-chain product with less friction.

## What is live

- Chain ID `5919065` / CAIP-2 `eip155:5919065`
- public EVM RPC and Explorer
- testnet faucet
- staking
- canonical zUSD
- ZORYQ DEX v1 with verified testnet liquidity and a verified real swap event
- lending contract
- on-chain Project Registry
- machine-readable Agent Context, Action schema and Project schema
- Project Intelligence / Builder Reputation specifications and bounded read-only indexing
- public Network Maturity disclosure

## Verified contract addresses

| Primitive | Address |
| --- | --- |
| DEX v1 | `0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156` |
| Lending | `0xA08d491c06a2B01bbe6866CA87302c794aD9fB77` |
| Project Registry | `0x180042c92A42f183A67005E8C0968a1F190aab33` |
| zUSD | `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9` |
| Stake | `0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1` |

Verified live DEX swap:
`0x9c7ade7f2151ee3d2b5421b4e5d025636b1480e0e18774ec1da77c8cdc618fd0`

## Product wedge

The differentiation is the complete builder path:

`Wallet → Faucet → Build → Simulate → Confirm → Broadcast → Explorer → Project Registry → Intelligence → Reputation`

Instead of optimizing only for chain throughput claims, ZORYQ is optimizing for **developer velocity, machine-readable safety, verifiable usage and transparent infrastructure maturity**.

## Distribution strategy

1. Make the first on-chain action possible in minutes.
2. Publish verifiable live metrics instead of vanity metrics.
3. Expose a sanitized public developer surface with starter kits.
4. Use `good first issue` / `help wanted` contribution paths to recruit the first external builders.
5. Enter relevant hackathons and ecosystem programs with a working demo rather than a slide-only pitch.
6. Measure wallet → faucet → swap/stake/lending → repeat-use conversion.

## Current risks / known limitations

- current testnet topology is centralized;
- no independent validator set exists yet;
- protocol contracts are experimental testnet software and are not represented as audited production finance;
- Genesis Score has no live on-chain finalization;
- Project Registry is live but had zero registered projects at the latest verification;
- main source repository is currently private, which limits discoverability and external contribution.

## Infrastructure milestone that changes the story

The next major technical credibility milestone is a reproducible independent-node specification followed by a three-node multi-operator devnet with restart, catch-up and failure tests. Until those tests exist, ZORYQ must not be described as decentralized.

## What ecosystem partners can help with

The highest-value non-financial support is:

- senior EVM/network engineering review;
- node/consensus architecture feedback;
- developer distribution;
- hackathon/community introductions;
- security review;
- testnet builders willing to deploy real experimental applications.

## Public product links

- Start: `https://zoryq-evm-node-live-production.up.railway.app/start`
- Developers: `https://zoryq-evm-node-live-production.up.railway.app/developer`
- Build: `https://zoryq-evm-node-live-production.up.railway.app/build`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- DEX: `https://zoryq-evm-node-live-production.up.railway.app/swap`
- Lending: `https://zoryq-evm-node-live-production.up.railway.app/lending`
- Intelligence: `https://zoryq-evm-node-live-production.up.railway.app/intelligence`
- Network Maturity: `https://zoryq-evm-node-live-production.up.railway.app/network-maturity`

Testnet only. ZQ and zUSD have no monetary value.
