# ZORYQ Mobile Source Recovery

## Finding

The historical mobile application was committed as opaque archives rather than as normal reviewable source files. The original `kyvo-source.zip` blob and its later `kyvo-src.tgz` / `zoryq-src.tgz` replacement do not provide a reliable canonical source recovery path today.

The released APK remains useful as a behavioral reference, but compiled Hermes bytecode must not be represented as original React Native source.

## Current canonical mobile code

`mobile-games-native/` is the first restored mobile component that now exists as normal reviewable source in Git and is built directly from checkout by CI.

This does **not** close Issue #58 for the full Wallet. Wallet + Social parity still needs a canonical application shell.

## Recovery plan

1. Inventory behaviors from the currently distributed Wallet APK without extracting secrets.
2. Recreate the host app in normal source files, starting from navigation and non-sensitive read-only surfaces.
3. Rebuild Wallet security/signing flows from documented architecture rather than decompiled code.
4. Recreate Social/Profile functionality against documented/public APIs and validate parity.
5. Integrate `mobile-games-native` through `ZoryqGameBridge`.
6. Build all mobile artifacts from checked-out source only.
7. Add smoke tests for Wallet, Social, Games Hub and each game.
8. Only then retire the opaque archive workflow and close the full-mobile reproducibility gate.

## Non-negotiable security boundary

No migration shortcut may expose or move seed phrases, private keys, mnemonics, signing secrets or provider credentials into the games runtime or repository history.
