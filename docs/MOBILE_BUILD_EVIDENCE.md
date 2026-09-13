# ZORYQ Canonical Mobile Build Evidence

This document records the evidence that closed Issue #58 and replaced the historical corrupt mobile-source archive path.

## Proven source

Canonical mobile source is stored as normal reviewable Git files under:

`mobile-games-native/`

Proven `main` commit:

`7954a353d75f61f1bde49bb9999d827c5c49c5e1`

## Reviewable source export

Workflow: `Export reviewable mobile source`

- Run ID: `34775086349`
- Result: **success**
- Artifact: `zoryq-mobile-source-7954a353d75f61f1bde49bb9999d827c5c49c5e1`
- Artifact ID: `10323315846`
- Artifact digest: `sha256:72faff19025d27bebe37d5ff954622660768817ec1120fedb98c96db69e96d38`

The workflow verifies the canonical source tree, rejects committed key/keystore files, scans for obvious embedded wallet secrets, produces a deterministic file inventory, computes SHA-256 checksums and writes source-export provenance.

## Canonical Android build

Workflow: `Build ZORYQ Android APK`

- Run ID: `34775086297`
- Result: **success**
- Artifact: `ZORYQ-Android-Canonical-71`
- Artifact ID: `10322959125`
- Artifact digest: `sha256:d847b3ae0a079f907fbd634979834675bb3f929d2f92cb36a63d8df391401bb8`

The workflow tests Wallet/Games modules, builds directly from `mobile-games-native/`, produces Wallet and Games APKs, calculates APK SHA-256 hashes and emits build provenance.

## Security / provenance boundary

This evidence proves source/build reproducibility for the current Testnet mobile code. It does not prove an external security audit, production release signing, physical-device coverage or mainnet readiness.

The historical `zoryq-src.tgz` archive was corrupt and is no longer part of the build or source-export path. It is removed from the current repository tree by the follow-up cleanup after the successful `main` evidence above; its history remains available through Git.
