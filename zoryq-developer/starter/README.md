# ZORYQ Builder Starter

A minimal public-facing starter for ZORYQ EVM Testnet.

## Network

- Name: ZORYQ EVM Testnet
- Chain ID: `5919065`
- Hex chain ID: `0x5a5159`
- Native token: `ZQ` (18 decimals, testnet only)
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet`

## Foundry: deploy in minutes

```bash
forge init my-zoryq-app
cd my-zoryq-app
```

Copy `HelloZoryq.sol` into `src/`, then deploy using your own testnet wallet:

```bash
export ZORYQ_RPC=https://zoryq-evm-node-live-production.up.railway.app/rpc
forge create src/HelloZoryq.sol:HelloZoryq \
  --rpc-url "$ZORYQ_RPC" \
  --interactive
```

`--interactive` keeps the private key out of shell history and out of this repository. Never commit a private key, seed phrase or wallet signature.

After deployment, open:

```text
https://zoryq-evm-node-live-production.up.railway.app/address/<CONTRACT_ADDRESS>
```

## viem

See `viem-read.mjs` for a zero-secret RPC example.

## What to build first

Good first products on ZORYQ are small, verifiable and useful: a counter, registry, NFT-like test object, agent action target, or a small dApp that calls the live DEX/Lending primitives.

## Testnet notice

ZQ and zUSD have no monetary value. The current network is a centralized public EVM testing environment, not a claim of decentralized production infrastructure.
