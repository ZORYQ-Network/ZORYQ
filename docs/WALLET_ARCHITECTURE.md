# ZORYQ Wallet Architecture

## Purpose

ZORYQ Wallet is the identity and signing boundary for the unified platform. The goal is simple self-custody on testnet today while preserving a security model that can evolve toward production.

## Canonical implementation

Reviewable Android source lives in:

`mobile-games-native/wallet-host/`

The current Testnet Release Candidate includes:

- watch-only EVM address validation, balance and nonce queries;
- local wallet creation;
- BIP-39 12-word recovery/import;
- Ethereum BIP-44 derivation `m/44'/60'/0'/0/0`;
- AES-GCM encrypted secret storage;
- Android Keystore-backed encryption key;
- EIP-155 native ZQ transaction signing for Chain ID `5919065`;
- personal-sign-compatible message signing;
- EIP-712 typed-data signing used by Social identity flows;
- explicit transaction confirmation before signing/broadcast;
- tests for address validation, transfer boundaries, signing and known BIP-39/BIP-44 recovery vectors.

This is testnet evidence, not an external security audit.

## Secret boundary

The following may never be sent to Social, Games, backend APIs, analytics or logs:

- mnemonic / seed phrase;
- raw private key;
- decrypted wallet secret;
- Android Keystore key material.

Applications request scoped signatures/actions from Wallet rather than receiving signing authority.

## Recovery model

New wallets use a BIP-39 recovery phrase and standard Ethereum derivation path. Recovery UX must make clear that anyone possessing the phrase controls the account. The phrase should be shown only through an explicit user action and never automatically logged, synchronized or copied to remote services.

## Current Android signing state

The canonical host intentionally uses a migration application identity rather than silently replacing the legacy distributed APK. The legacy APK was signed with a historical Android Debug certificate. A shared/debug key is not an acceptable long-term production trust anchor.

Production distribution requires an exclusive ZORYQ release-signing key, protected outside the repository, with documented certificate fingerprints, backup/rotation procedures and CI release-signing controls.

## Wallet rules

- local confirmation of network, destination and value;
- chain-ID validation;
- no background spending authority by default;
- no invisible signature prompts;
- no secret sharing with application modules;
- recovery must be tested before production;
- high-value/application permissions require explicit scopes;
- clipboard/screenshots/biometric protections should be strengthened before production release.

## External wallets

Future WalletConnect/Reown or external-wallet connectors are application options, not a reason to weaken the native Wallet boundary.

## Mainnet gate

Wallet mainnet promotion requires at minimum:

1. exclusive production signing key and release process;
2. independent assessment of key lifecycle, recovery and signing flows;
3. physical-device test matrix;
4. threat-model review;
5. backup/recovery drills;
6. incident-response ownership;
7. session/replay protections for application authentication;
8. rollback/kill-switch plan where technically appropriate.

Until these gates are met, the native Wallet is a **testnet release candidate**, not a production mainnet wallet.
