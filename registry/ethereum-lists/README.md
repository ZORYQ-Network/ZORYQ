# ZORYQ EVM Testnet — public registry submission

Canonical target: `ethereum-lists/chains` → `_data/chains/eip155-5919065.json`

CAIP-2 chain reference: `eip155:5919065`

## Public endpoints

- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Faucet / Start: `https://zoryq-evm-node-live-production.up.railway.app/start`
- Explorer: `https://zoryq-evm-node-live-production.up.railway.app/explorer`
- Native testnet asset: `ZQ` (18 decimals)

## wallet_addEthereumChain

```json
{
  "chainId": "0x5a5159",
  "chainName": "ZORYQ EVM Testnet",
  "nativeCurrency": {
    "name": "ZORYQ Testnet",
    "symbol": "ZQ",
    "decimals": 18
  },
  "rpcUrls": [
    "https://zoryq-evm-node-live-production.up.railway.app/rpc"
  ],
  "blockExplorerUrls": [
    "https://zoryq-evm-node-live-production.up.railway.app/explorer"
  ]
}
```

## Registry policy

This is a testnet. ZQ has no monetary value and testnet participation does not guarantee rights to any future token or airdrop.

The explorer is currently declared with `standard: "none"` in the registry candidate. EIP-3091-compatible `/tx/`, `/address/`, and `/block/` routes have been implemented in the web package, but the registry metadata should only be upgraded to `EIP3091` after those routes are confirmed live on the submitted explorer URL.
