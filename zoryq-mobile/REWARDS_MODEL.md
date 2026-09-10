# ZORYQ Testnet Rewards Model

## Goal
Reward real Testnet contribution more heavily than lightweight app activity. Validator/node operators must earn substantially more points than mobile users who only stake faucet ZQ, swap, or complete quests.

## Reward classes

### Tier A — Validator / Node Operator (highest)
Eligible activity:
- running an approved ZORYQ Testnet node continuously
- successful health heartbeats
- uptime and availability
- participating in validator test campaigns
- producing/relaying verifiable node telemetry
- completing validator-specific quests

Target weight: **10x–25x** a standard mobile activity unit.

Example baseline points:
- 1 hour healthy node uptime: 120 pts
- 24h uninterrupted uptime bonus: +1,500 pts
- 7-day uptime streak: +12,000 pts
- validator campaign / test event: 2,500–25,000 pts

### Tier B — Advanced Chain Contributor
Eligible activity:
- deploy Solidity contracts
- create ERC-20 / ERC-721
- meaningful testnet volume across approved modules
- bug bounties / reproducible chain issues

Target weight: **3x–8x** standard mobile activity.

### Tier C — Mobile Wallet / Testnet User
Eligible activity:
- faucet claim
- staking faucet ZQ in approved test staking contract
- swap using approved Testnet DEX
- quests
- first transfer / NFT mint / token interaction

Target weight: **1x** standard activity.

Example baseline points:
- faucet claim: 5 pts
- first transfer: 25 pts
- approved swap: 10–40 pts, with daily cap
- stake faucet ZQ: 1 pt per approved time unit, capped
- quest: admin-defined, normally 25–500 pts

## Anti-abuse
- points are not earned from app-local counters alone
- chain-derived actions must be verified from transaction hashes/events
- faucet-based staking has low weight and caps
- swaps require minimum notional, cooldowns and anti-wash checks
- validator rewards require signed node identity + heartbeat/uptime verification
- duplicate wallets / Sybil patterns may be excluded
- all finalized epochs publish on-chain commitments/claims

## Transparency
Explorer should expose:
- reward epoch
- wallet/node identity
- reward class
- finalized points
- claim status
- proof/event reference

Pending points may be shown in the app, but must be clearly labelled pending until finalized on-chain.
