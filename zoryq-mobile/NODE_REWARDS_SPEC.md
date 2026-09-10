# ZORYQ Node / Validator Rewards Spec

## Distribution goal
Make it easy for a user to download and run a ZORYQ Testnet node on a PC, bind the node to a wallet, and earn validator/node points that materially exceed ordinary mobile-app points.

## Node identity
Each node has:
- nodeId (public identifier)
- operator wallet
- software version
- platform
- firstSeen / lastSeen
- uptime counters
- validator eligibility state

Never embed operator private keys in node binaries or public config.

## Proof flow
1. User downloads node package.
2. Node starts and connects to ZORYQ Testnet.
3. User links operator wallet by signing a nonce in the wallet.
4. Node submits signed heartbeat challenges.
5. Reward service verifies heartbeats, uptime, duplicate IP/device patterns, version and chain health.
6. Epoch finalizer computes points.
7. Finalized reward commitment / claim is published on-chain.
8. Explorer and APK show the same finalized values.

## Suggested weights
- healthy node hour: 120 pts
- 24h continuous: +1,500 pts
- 7d continuous: +12,000 pts
- validator test campaign: +2,500 to +25,000 pts
- mobile faucet claim: 5 pts
- normal swap: 10 to 40 pts capped
- faucet stake: low capped accrual

Thus active node operators should normally earn at least an order of magnitude more than passive APK users.

## PC package
Target distributions:
- Windows x64 portable ZIP + optional installer
- Linux x64 tar.gz
- Docker image

Required UX:
- Start Node
- Stop Node
- status: connected / syncing / healthy
- Chain ID 5919065
- operator wallet
- uptime
- pending points
- finalized points
- last heartbeat
- open Explorer
- open Docs

## Public download page
The ZORYQ Hub must have a "Run a Node" page with verified checksums and release links. Do not present a download as production-ready until the built binary/archive and checksum have been verified.
