# ZORYQ Mobile Parity Matrix

This matrix separates what is reproducible in normal Git source from what still exists only in the distributed legacy APK behavior.

Observed reference APK configuration:

- product name: ZORYQ
- Android package: `com.zoryq.wallet`
- app version: `0.4.1`
- Android versionCode: `6`
- Expo SDK: `54.0.0`
- portrait orientation
- secure-store integration
- local authentication integration
- profile photo/image-picker integration
- custom mobile-node and game-bridge plugin hooks

## Migration status

| Surface | Canonical source status | Current action |
| --- | --- | --- |
| Mobile build tree | 🟢 | `mobile-games-native/` builds directly from checkout |
| Navigation shell | 🟢 | Wallet Next migration host implements Home / Wallet / Social / Games / Profile |
| Games Hub | 🟢 | Native host integration exists |
| ZORYQ Rush | 🟢 | Playable vertical slice |
| ZORYQ Arena | 🟢 | Playable alpha |
| ZORYQ Empire | 🟢 | Playable alpha |
| Wallet public/network surface | 🟡 | Shell exists; RPC/read-only adapter is next |
| Wallet secure key lifecycle | 🔴 | Must be rebuilt from security architecture, not decompiled behavior |
| Send / receive / signing | 🔴 | Blocked until protected key lifecycle exists and is tested |
| Social feed | 🔴 | Requires canonical API/data integration |
| Social profile | 🟡 | Navigation/context boundary exists; real profile integration pending |
| Settings / language parity | 🔴 | Pending migration |
| Mobile-node product surface | 🔴 | Pending migration from documented behavior |
| Biometric gate | 🔴 | Pending secure host integration and device tests |
| Final package cutover to `com.zoryq.wallet` | 🔴 | Only after parity and security gates pass |

## Cutover rule

The migration host uses a different application ID so it can be installed beside the distributed Wallet during validation. It must not take over `com.zoryq.wallet` until Wallet/Social parity, signing security and device smoke tests are complete.
