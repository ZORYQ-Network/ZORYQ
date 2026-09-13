# ZORYQ Command Center

The Command Center is the human-readable view of ZORYQ's evidence registry.

## Purpose

It unifies five layers under one status model:

1. ZORYQ Chain
2. ZORYQ Identity + Wallet
3. ZORYQ Autonomous Network
4. ZORYQ Applications
5. ZORYQ Economy + Engineering

The canonical machine-readable registry is `status.json`. `index.html` renders that registry and, when browser CORS permits, queries the public ZORYQ Testnet RPC for the live Chain ID and block height.

## Status rules

- `PROVEN` — reproducible source, CI, or public proof exists.
- `WORKING` — implementation exists, but an important production/evidence gate remains.
- `NOT_PROVEN` — evidence required for the claim is absent.

`PROVEN` never means audited mainnet-ready unless the specific evidence says so.

## Updating the registry

A status may be promoted only when its `evidence` path points to a reviewable artifact. Do not use marketing activity, screenshots, internal replicas, or unlinked claims as evidence.

The source-of-truth documents are:

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT_MAP.md`
- `docs/NETWORK_STATUS.md`
- `docs/MAINNET_READINESS.md`
- `docs/WALLET_ARCHITECTURE.md`
- `docs/SOCIAL_ARCHITECTURE.md`
- `docs/GAMES_ARCHITECTURE.md`
- `docs/SECURITY_MODEL.md`
