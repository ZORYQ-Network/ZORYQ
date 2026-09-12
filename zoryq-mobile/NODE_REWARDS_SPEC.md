# ZORYQ Node / Validator Rewards Spec

## Distribution goal
Make it easy for a user to download and run a ZORYQ Testnet node on a PC or supported mobile device, bind the node to a wallet, and earn validator/node points that materially exceed ordinary mobile-app points.

## Reward epoch
ZORYQ Testnet node rewards use a transparent weekly epoch cadence:
- Epoch 1 starts **2026-09-07 00:00:00 UTC**.
- Each epoch lasts **7 days**.
- New epochs begin every Monday at **00:00 UTC**.
- Pending points may update during the epoch.
- Pending values are estimates and may be adjusted by anti-abuse/health review.
- Finalized epoch rewards are authoritative only after the epoch commitment / claim data is published on-chain.

The APK may show the current epoch number, elapsed percentage and countdown to the next boundary, but must never label pending points as finalized rewards.

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
1. User downloads node package or enables the supported mobile node agent.
2. Node starts and connects to ZORYQ Testnet.
3. User links operator wallet by signing a nonce in the wallet.
4. Node submits authenticated heartbeat challenges.
5. Reward service verifies heartbeats, uptime, duplicate IP/device patterns, version and chain health.
6. Epoch finalizer computes points.
7. Finalized reward commitment / claim is published on-chain.
8. Explorer and APK show the same finalized values.

## Suggested weights and milestones
- healthy node hour: 120 pts
- 24h continuous: +1,500 pts
- 7d continuous: +12,000 pts
- validator test campaign: +2,500 to +25,000 pts
- mobile faucet claim: 5 pts
- normal swap: 10 to 40 pts capped
- faucet stake: low capped accrual

The operator UI should make the next **real contribution milestone** visible (1h, 24h, 7d) without inventing loot boxes, random rewards, paid boosts or artificial click streaks.

Thus active node operators should normally earn at least an order of magnitude more than passive APK users.

## PC / mobile package UX
Required UX:
- Start Node
- Stop Node
- status: connected / syncing / healthy
- Chain ID 5919065
- current reward epoch + countdown
- operator wallet
- uptime
- pending points
- finalized points when available
- last heartbeat
- next uptime milestone
- open Explorer
- open Docs

## Public download page
The ZORYQ Hub must have a "Run a Node" page with verified checksums and release links. Do not present a download as production-ready until the built binary/archive and checksum have been verified.
