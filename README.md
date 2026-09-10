# ZORYQ EVM Testnet

ZORYQ is an EVM-compatible public testnet focused on wallet onboarding, testnet activity, quests, Genesis participation and developer tooling.

> Testnet only. ZQ has no monetary value and participation does not guarantee any future token, airdrop or financial reward.

## Network

| Parameter | Value |
|---|---|
| Network name | ZORYQ EVM Testnet |
| Chain ID | `5919065` |
| Chain ID (hex) | `0x5a5159` |
| Network ID | `5919065` |
| Native symbol | `ZQ` |
| Decimals | `18` |
| Public RPC | `https://zoryq-evm-node-live-production.up.railway.app/rpc` |
| Explorer | `https://zoryq-evm-node-live-production.up.railway.app/explorer` |
| Faucet | `https://zoryq-evm-node-live-production.up.railway.app/faucet` |
| Start | `https://zoryq-evm-node-live-production.up.railway.app/start` |

The Chain ID `5919065` is treated as permanent for this testnet.

## Add ZORYQ to MetaMask / Rabby

Use the wallet's custom network flow with:

```text
Network Name: ZORYQ EVM Testnet
RPC URL: https://zoryq-evm-node-live-production.up.railway.app/rpc
Chain ID: 5919065
Currency Symbol: ZQ
Block Explorer: https://zoryq-evm-node-live-production.up.railway.app/explorer
```

Equivalent `wallet_addEthereumChain` payload:

```js
await ethereum.request({
  method: 'wallet_addEthereumChain',
  params: [{
    chainId: '0x5a5159',
    chainName: 'ZORYQ EVM Testnet',
    nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
    rpcUrls: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'],
    blockExplorerUrls: ['https://zoryq-evm-node-live-production.up.railway.app/explorer']
  }]
});
```

## EVM JSON-RPC compatibility

The public RPC is intended to work with standard EVM clients without proprietary adapters. Core methods currently exercised include:

- `eth_chainId`
- `net_version`
- `eth_blockNumber`
- `eth_getBalance`
- `eth_getTransactionReceipt`
- `eth_call`
- `eth_estimateGas`
- `eth_getLogs`
- `eth_sendRawTransaction`

A reproducible audit script is available at:

```text
zoryq-evm-node/scripts/rpc-compliance.mjs
```

Run it with Node.js 22+:

```bash
node zoryq-evm-node/scripts/rpc-compliance.mjs
```

## Explorer URLs

The explorer is being standardized around EIP-3091-style permanent routes:

```text
/tx/<transaction-hash>
/address/<wallet-or-contract-address>
/block/<block-number>
```

These routes are validated against the live deployment before the chain registry metadata is declared `EIP3091`.

## Faucet

Open the public faucet and enter a standard EVM address (`0x...`). The faucet is testnet-only, applies anti-abuse controls/cooldowns and returns a transaction hash when the claim is fulfilled on-chain.

```text
https://zoryq-evm-node-live-production.up.railway.app/faucet
```

## ethers v6 example

```js
import { JsonRpcProvider } from 'ethers';

const provider = new JsonRpcProvider(
  'https://zoryq-evm-node-live-production.up.railway.app/rpc',
  5919065
);

console.log(await provider.getNetwork());
console.log(await provider.getBlockNumber());
```

## viem example

```js
import { createPublicClient, defineChain, http } from 'viem';

const zoryq = defineChain({
  id: 5919065,
  name: 'ZORYQ EVM Testnet',
  nativeCurrency: { name: 'ZORYQ', symbol: 'ZQ', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://zoryq-evm-node-live-production.up.railway.app/rpc'] }
  }
});

const client = createPublicClient({
  chain: zoryq,
  transport: http()
});

console.log(await client.getBlockNumber());
```

## Deploy a Solidity contract

Any standard EVM deployment workflow can target ZORYQ by using Chain ID `5919065` and the public RPC. Example with Foundry:

```bash
forge create src/MyContract.sol:MyContract \
  --rpc-url https://zoryq-evm-node-live-production.up.railway.app/rpc \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

Never commit private keys, mnemonics, API credentials or production secrets to this repository.

## Current architecture

```text
Wallets / ethers / viem / MetaMask / Rabby
                  |
                  v
          Public ZORYQ Gateway
                  |
         +--------+---------+
         |                  |
         v                  v
     EVM JSON-RPC       Web surfaces
       (Anvil)      Explorer / Faucet / Docs
         |
         v
 Persistent Railway volume
```

Railway currently provides infrastructure hosting. A custom ZORYQ domain structure is planned so infrastructure hostnames are no longer the public network identity.

## Genesis and identity

ZORYQ tracks testnet actions such as faucet use, swaps and stake operations. On-chain/server-verified actions are distinguished from social self-attestations. Social points are not represented as finalized on-chain proof until a verifiable finalization mechanism exists.

ENS identity support currently verifies an Ethereum Sepolia ENSv2 beta primary name by resolving reverse and forward records back to the same EVM address.

## ETHOnline 2026 development

For ETHOnline, new work is being separated from pre-existing ZORYQ infrastructure. The planned new demonstrable module is **ZORYQ Genesis Intelligence**: live indexing and analytics for testnet wallets, contracts, Genesis actions, quests and network statistics, with The Graph as an essential data layer.

## Chain registry

A registry contribution is open for Chain ID `5919065`. Registry metadata is kept aligned with the live RPC, faucet and explorer. Explorer metadata must not be marked `EIP3091` until the public permanent routes are verified live.

## Security

- No private keys or mnemonic phrases belong in source control.
- Administrative Anvil/Hardhat RPC namespaces are blocked on the public gateway.
- Faucet access is rate-limited/cooldown-controlled.
- Testnet assets have no monetary value.
- This is not a mainnet security guarantee or audit.
