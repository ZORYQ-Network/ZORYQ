# ZORYQ Mobile-First Solo Operator Runbook

ZORYQ is currently operated by one founder primarily from a phone. This runbook minimizes single-device and single-key risk without requiring a team.

## Daily phone
Use for: ChatGPT, GitHub review, Testnet, ZORYQ Wallet development account, routine low-value operations.

Do not keep Treasury recovery phrases in screenshots, cloud photos, chat, email, notes, clipboard history, or source code.

## Key tiers
1. **Development Wallet** — Testnet only; safe to recreate.
2. **Operations Wallet** — future low-value production operations with strict balance limits.
3. **Treasury signer A** — primary hardware-backed/offline recovery.
4. **Treasury signer B** — independent backup, stored separately.
5. **Emergency signer C** — sealed offline recovery, used only if another signer is lost.

A solo founder may control a 2-of-3 Treasury, but the three credentials must not live together on the same phone.

## Release procedure from phone
1. Review GitHub PR and CI status.
2. Verify release artifact SHA-256.
3. Install only the expected APK/extension build.
4. Run Testnet create/restore/connect/sign/faucet smoke tests.
5. Promote only after Wallet ↔ Chain compatibility tests pass.
6. Never promote a mainnet binary directly from an unreviewed local change.

## Mainnet gates
No mainnet launch until: deterministic genesis frozen, validator topology tested on independent hosts, external security review completed, wallet recovery tested, treasury addresses publicly documented, migration accounting reconciled, RPC rate limiting/monitoring enabled, and emergency procedures rehearsed.