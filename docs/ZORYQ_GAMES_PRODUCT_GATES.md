# ZORYQ Games — Product and Integration Gates

## Current native game set

- **ZORYQ Rush** — playable native vertical slice.
- **ZORYQ Arena** — playable native alpha combat slice.
- **ZORYQ Empire** — playable native alpha city/production slice.

All three are implemented in `mobile-games-native/runtime` using Kotlin + Android SDK/Canvas, with no Unity, Unreal or Godot dependency.

## Reward integrity

Client-side score, ZQ collectibles, credits, reputation, buildings or match results are **game state**, not an entitlement to transferable or mainnet assets.

Any future testnet reward must follow a server/host verified claim flow:

1. game emits a bounded result/evidence payload;
2. Wallet/host identifies the public account without exposing private key material to the game;
3. trusted verification applies anti-replay and abuse controls;
4. reward policy decides whether a testnet reward is available;
5. Wallet displays and signs any required transaction through its own protected signing flow.

Never let the game runtime receive wallet seed phrases or raw private keys.

## Wallet integration gate

Issue #58 remains the source-of-truth blocker for claiming full Wallet integration. The historical Expo source was stored only as opaque archives and is not currently reproducible from normal reviewable files.

Do not replace the existing Wallet APK until a canonical mobile app source tree exists and preserves, at minimum:

- wallet creation/import/recovery safeguards;
- balance and transaction surfaces;
- existing Social/Profile behavior;
- settings and language behavior;
- node/testnet product surfaces still intended for release;
- Games Hub navigation;
- protected signing boundaries.

## Migration strategy

Use the current released APK as a behavioral reference only. Rebuild the canonical mobile shell screen-by-screen in reviewable Git source, validate parity with tests/device checks, and integrate `mobile-games-native` as a normal module. Do not patch Hermes bytecode or represent decompiled output as original source.
