# ZORYQ — ETHOnline 2026 Submission Pack

## One-line pitch

**ZORYQ is an agent-native EVM testnet that helps humans and AI agents move from idea to verifiable on-chain product with machine-readable network context, safe action manifests, native DeFi primitives and builder intelligence.**

## Why this is different

Most EVM networks compete on execution cost or throughput. ZORYQ's experimental wedge is the builder/agent workflow itself:

`connect → fund → build → simulate → confirm → broadcast → verify → index activity`

The network exposes machine-readable context for agents, a developer portal, permanent Explorer routes, Project Registry, Project Intelligence and native testnet DeFi primitives.

## Live demo path

1. Open `https://zoryq-evm-node-live-production.up.railway.app/start`
2. Add ZORYQ EVM Testnet (Chain ID `5919065`).
3. Claim test ZQ.
4. Execute ZQ ↔ zUSD in the live ZORYQ DEX.
5. Open the resulting transaction in the Explorer.
6. Show `/developer` and `/build` for the human/AI builder path.
7. Show `/.well-known/zoryq-agent.json`, `/llms.txt` and action/project schemas.
8. Show `/intelligence` and the on-chain Project Registry.
9. Show `/network-maturity` to explicitly disclose the current centralized testnet topology.

## Verified protocol evidence

- DEX v1: `0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156`
- Lending: `0xA08d491c06a2B01bbe6866CA87302c794aD9fB77`
- Project Registry: `0x180042c92A42f183A67005E8C0968a1F190aab33`
- zUSD: `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9`
- Stake: `0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1`
- Verified DEX swap tx: `0x9c7ade7f2151ee3d2b5421b4e5d025636b1480e0e18774ec1da77c8cdc618fd0`

## Demo narrative — 90 seconds

**0–15s:** "AI can write contracts, but getting from intent to safe, verifiable execution is still fragmented. ZORYQ makes that path machine-readable."

**15–35s:** Add network, claim test ZQ, show live RPC and Explorer.

**35–55s:** Execute a DEX swap and verify the receipt. Highlight that the action is user-confirmed and the target/fee/result are inspectable.

**55–75s:** Show Agent Context, Action schema and Project Registry/Intelligence.

**75–90s:** Show Network Maturity: "We publish what is live and what is not. The current testnet is centralized; the next infrastructure milestone is independent multi-node operation."

## Submission description

ZORYQ is a public EVM-compatible experimental testnet focused on developer velocity and agent-native execution. It combines standard Ethereum tooling with machine-readable chain context, safe action manifests, permanent Explorer URLs, testnet faucet, live DEX, staking, lending, an on-chain Project Registry and a Builder/Project Intelligence layer. ZORYQ is intentionally transparent about network maturity: the current testnet is centralized and is not presented as production-ready or decentralized.

## Judging proof checklist

- public RPC responds with Chain ID `5919065`;
- DEX has live bytecode and liquidity;
- at least one DEX swap event is publicly verifiable;
- Explorer permanent routes work;
- agent metadata/schema routes are public;
- Project Registry has live bytecode;
- no private keys/secrets are required for judges to inspect the project;
- testnet/no-monetary-value disclosure is visible.

## Before final submission

- make a sanitized source repository public or provide a public submission repository;
- record a concise product demo video;
- choose sponsor tracks only where ZORYQ actually uses the sponsor technology;
- never add a sponsor integration solely as a superficial checkbox;
- verify every submission link from a logged-out browser.
