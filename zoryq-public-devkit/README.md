# ZORYQ Developer Kit

Build experimental EVM apps on **ZORYQ EVM Testnet** in minutes.

> ZORYQ is currently a public **centralized testnet**. It is not production-ready or decentralized. ZQ and zUSD are test assets with no monetary value.

## Why build here?

ZORYQ combines standard EVM tooling with an agent-native developer layer, live testnet DeFi primitives, on-chain project identity and verifiable builder activity.

The goal is simple: reduce the distance between an idea and a verifiable on-chain product.

## Network

- Chain: `ZORYQ EVM Testnet`
- Chain ID: `5919065`
- Hex: `0x5a5159`
- CAIP-2: `eip155:5919065`
- Native token: `ZQ`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet`
- Developer portal: `https://zoryq-evm-node-live-production.up.railway.app/developer`
- Build ideas: `https://zoryq-evm-node-live-production.up.railway.app/ideas`
- Builder challenge: `https://zoryq-evm-node-live-production.up.railway.app/challenge`

## 60-second viem connection

```js
import { createPublicClient, http, defineChain } from 'viem';

export const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: { default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] } },
  blockExplorers: { default: { name: 'ZORYQ Explorer', url: 'https://zoryq-evm-node-live-production.up.railway.app/explorer' } },
  testnet: true,
});

const client = createPublicClient({ chain: zoryq, transport: http() });
console.log(await client.getBlockNumber());
```

## ethers v6

```js
import { JsonRpcProvider } from 'ethers';
const provider = new JsonRpcProvider(
  'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  5919065
);
console.log(await provider.getBlockNumber());
```

## Foundry

```bash
forge create src/HelloZoryq.sol:HelloZoryq \
  --rpc-url https://zoryq-evm-node-live-production.up.railway.app/rpc \
  --private-key "$YOUR_TESTNET_PRIVATE_KEY"
```

Never commit private keys. Use a disposable testnet wallet.

## Live primitives

| Primitive | Address |
| --- | --- |
| DEX v1 | `0x686Ff70d8D551F0a183DbDc608486De9fA9Aa156` |
| Lending | `0xA08d491c06a2B01bbe6866CA87302c794aD9fB77` |
| Project Registry | `0x180042c92A42f183A67005E8C0968a1F190aab33` |
| Stake | `0xbB26FaADD1E083C7c0dc0A82Ddb96cC45253Ecb1` |
| zUSD | `0xd2121E96C6af936c0496fDB499c1D0613d26c2B9` |

## What should I build?

Try one of these:

- wallet-safe AI action copilot;
- DEX price-impact dashboard;
- lending health-factor guardian;
- builder passport backed by verifiable activity;
- ENS + Project Registry identity card;
- on-chain game quest;
- RPC/network observability tool;
- something nobody on the core team predicted.

## Founding Builder Challenge

We are explicitly looking for the first **10 independent builders**. Core-team/Treasury self-activity does not count as external adoption.

A qualifying contribution can be a contract, dApp, integration, agent workflow, SDK/tooling experiment or network-infrastructure test that produces independently verifiable evidence.

Start: `https://zoryq-evm-node-live-production.up.railway.app/challenge`

## Agent-native surfaces

- `/.well-known/zoryq-agent.json`
- `/llms.txt`
- `/agent/action-schema.json`
- `/agent/project-schema.json`
- `/agent/project-intelligence-schema.json`
- `/agent/builder-reputation.json`

State-changing actions should always be previewed and explicitly confirmed in the user's wallet. Never request or store seed phrases/private keys.

## Transparency

Network maturity is public:

`https://zoryq-evm-node-live-production.up.railway.app/network-maturity`

The current public testnet remains centralized. Independent validators and multi-validator consensus are not yet live.

## Contribute

Good first contributions should be small, testable and evidence-producing. Ideal areas include:

- examples and starter templates;
- wallet integrations;
- DEX/lending dashboards;
- Project Registry tooling;
- agent action manifests;
- RPC/network testing;
- documentation improvements.

Open source is intended to be the default developer experience for this kit. The core monorepo should not be required to experiment with the network.