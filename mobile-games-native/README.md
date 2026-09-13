# ZORYQ Games Native

Canonical, reviewable Android source for ZORYQ's native games layer.

## Current status

- `runtime/`: reusable Android library (AAR) containing native game activities and views.
- `demo/`: installable validation APK.
- `ZORYQ Rush`: playable vertical slice implemented with Android Canvas + Kotlin.
- No Unity, Unreal, Godot, WebGL wrapper or external game engine is used.

## Product boundary

This directory is **not yet a replacement for the existing ZORYQ Wallet APK**. The historical Expo Wallet source currently has reproducibility debt tracked in Issue #58. Until the wallet source tree is restored/migrated screen by screen, do not claim that Wallet/Social parity is complete.

## Intended integration

The games runtime is deliberately isolated from signing and secret storage. A host app launches the Games Hub / game activities through explicit Android intents. Games must not receive seed phrases or raw private keys.

The bridge contract should pass only bounded, non-secret context such as:

- public wallet address when needed;
- public profile identifier;
- locale/theme;
- session-scoped game capability tokens;
- signed gameplay claims produced through a host-controlled signing flow, never raw key material.

## Build

From the repository root:

```bash
cd mobile-games-native
gradle :runtime:assembleDebug :demo:assembleDebug
```

CI builds the same source tree in `.github/workflows/zoryq-games-native.yml` and verifies the AAR/APK artifacts.

## Release gate

A game is not considered integrated into ZORYQ Wallet until all of the following are true:

1. Wallet source is reviewable at the same commit or a documented dependency commit.
2. Wallet build consumes this runtime source/AAR reproducibly.
3. The Games entry is reachable from the product navigation.
4. Wallet and Social smoke tests still pass.
5. Android install/launch/gameplay is validated on a real device or emulator.
6. No seed/private key material crosses the games bridge.
