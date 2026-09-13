# ZORYQ Games Architecture

## Purpose

ZORYQ Games is an application layer that demonstrates native mobile capability and shared ZORYQ identity without putting normal gameplay onchain.

## Canonical source

`mobile-games-native/runtime/`

Current modules include:

- Games Hub;
- ZORYQ Rush;
- ZORYQ Arena vertical slice;
- ZORYQ Empire vertical slice;
- game-session/result models;
- Wallet/Game bridge boundary;
- runtime unit tests.

## Runtime principle

The games use native Android rendering and do not require Unity, Unreal or Godot. The runtime should optimize for deterministic local gameplay, responsive input and low-friction Android distribution.

## Identity boundary

Games may receive scoped public/session context through `ZoryqGameBridge`. They must never receive seed phrases, private keys or Wallet credentials.

Shared platform state may eventually include:

- public ZORYQ identity;
- XP;
- achievements;
- cosmetics;
- progression proofs;
- optional ownership records.

## Blockchain rule

Use blockchain only when it adds durable value: ownership, settlement, identity, marketplace or verifiable achievement. Frame-by-frame gameplay, movement, collisions and ordinary scoring remain local/offchain.

## Product maturity

- **Games Hub:** proven source/build path.
- **Rush:** playable native vertical slice with score/progression/persistence.
- **Arena:** working combat vertical slice; not a finished competitive product.
- **Empire:** working colony/economy vertical slice; not a finished persistent strategy product.

## Production gates

Before calling a game production-ready:

- physical-device performance matrix;
- crash/ANR telemetry with privacy controls;
- audio/accessibility pass;
- save migration tests;
- economy abuse analysis;
- deterministic reward rules where rewards have value;
- explicit separation between game rewards and investment claims;
- content/IP review for original assets and mechanics.
