# ZORYQ EVM Testnet Node

A real EVM execution node for the ZORYQ Testnet using Foundry Anvil behind a restricted public JSON-RPC gateway.

## Network
- Name: ZORYQ EVM Testnet
- Chain ID: 5919065 (`0x5a5159`)
- Native token: ZQ (18 decimals)
- Block interval: 2 seconds
- Full EVM bytecode execution: enabled
- Contract creation: enabled
- `eth_call`, `eth_getCode`, logs, receipts, raw transactions: provided by Anvil
- Solidity/ERC-20/ERC-721/dApps: supported by the EVM node

## Security model
This is a centralized public Testnet node, not ZORYQ Mainnet consensus. Administrative `anvil_*`, `hardhat_*`, `evm_*` and `debug_*` RPC methods are blocked by the public gateway. The Testnet mnemonic must be supplied through the hosting provider secret `ZORYQ_TESTNET_MNEMONIC` and must never be committed to GitHub.

## Persistence
Mount persistent storage at `/data`. Anvil writes `/data/zoryq-state.json` every 5 seconds and preserves historical states.

## Public endpoints
- `POST /` or `/rpc`: standard Ethereum JSON-RPC
- `GET /health`: network status
- `GET /network`: wallet_addEthereumChain metadata
- `POST /faucet` body `{ "address": "0x..." }`: 100 test ZQ per address / 24h

## Wallets and developer tools
Once deployed over HTTPS, the RPC can be added to MetaMask, OKX Wallet, Rabby and other EVM wallets. Standard Solidity tools such as Remix, ethers, viem, Hardhat and Foundry can deploy and interact with contracts normally.

Testnet funds have no financial value. Do not reuse the Testnet mnemonic for Mainnet or treasury keys.
