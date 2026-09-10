# ZORYQ Mobile Wallet + Points Architecture

## Goal
Build a mobile-first ZORYQ wallet (Android APK first) where all economically relevant state is verifiable on ZORYQ Testnet and queryable through the ZORYQ Explorer/Chain UI.

## Core rule
The APK must never maintain a hidden shadow ledger for balances, token ownership, NFT ownership, transactions, claims or finalized reward totals. Those states must come from the ZORYQ EVM chain.

## On-chain data shown in the APK
- Native ZQ balance
- Incoming/outgoing native transactions
- ERC-20 balances and transfers
- ERC-721 ownership and transfer history
- Contract interactions and receipts
- Faucet claims that result in ZQ balance changes
- Finalized points/reward claims
- Reward campaign epochs and Merkle roots / claim proofs
- On-chain claim transactions and events

## Points mining model
“Mining” in the APK means an activity/reputation points program, not Proof-of-Work or consensus mining.

### Two-stage model
1. Pending points (off-chain)
   - Device/app activity can be accumulated as provisional points.
   - Pending points have no monetary value and are not a token balance.
   - Anti-abuse checks, rate limits and campaign rules apply.
2. Finalized points (on-chain)
   - At epoch close, eligible points are committed to the chain.
   - Preferred production design: epoch Merkle root + user claim contract.
   - A successful claim emits an event and/or mints a non-transferable reward credential.
   - Explorer can query the epoch, claim transaction and emitted events.

## Explorer requirements
The Chain/Explorer must expose:
- Address profile
- ZQ balance
- ERC-20 holdings
- ERC-721 holdings
- Transactions
- Contract interactions
- Reward/points claims
- Reward epochs
- Claim status by address
- Event logs for reward contracts

## Wallet screens
1. Home
   - Wallet address
   - ZQ balance
   - Network status
   - Pending points
   - Finalized/on-chain points
2. Receive
   - Address + QR
3. Send
   - Native ZQ and ERC-20
4. Tokens
   - ERC-20 assets
5. NFTs
   - ERC-721 assets
6. Activity
   - On-chain transaction history
7. Points
   - Current epoch
   - Pending points
   - Eligible points
   - Claim button
   - Previous on-chain claims
8. dApps
   - Open ZORYQ Hub / Explorer / Swap / Faucet
9. Settings
   - Network info
   - RPC
   - Chain ID
   - Security and backup

## Network
- Name: ZORYQ EVM Testnet
- Chain ID: 5919065
- Chain ID hex: 0x5a5159
- Native currency: ZQ
- Decimals: 18
- RPC: https://zoryq-evm-node-v3-production.up.railway.app/rpc
- Explorer: https://zoryq-testnet.vercel.app/explorer.html

## Security
- Never commit mnemonic, seed phrase or private key.
- Never send a seed phrase to ZORYQ servers.
- Private keys stay encrypted on the device.
- Android production wallet should use Android Keystore-backed encryption.
- Points backend must never have custody of wallet private keys.
- Reward signing/epoch authority must be isolated from the web frontend.

## Smart-contract direction
Recommended contracts:
- ZoryqPointsRegistry: stores epoch roots / campaign metadata.
- ZoryqPointsClaim: verifies Merkle proofs and records one claim per epoch/address.
- Optional ZoryqBadge721 or non-transferable credential for achievements.

Every finalized reward action must emit indexed events so the Explorer and APK can query the same canonical state.
