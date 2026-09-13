# ZORYQ Social Architecture

## Purpose

ZORYQ Social is an application layer built on ZORYQ Identity + Wallet. It must never become a second wallet or secret-storage system.

## Current mobile path

Canonical Android implementation:

- `mobile-games-native/wallet-host/src/main/java/network/zoryq/wallet/migration/SocialActivity.kt`
- `SocialStore.kt`
- `ZoryqSocialApi.kt`
- `EthereumSignature.kt`

The app supports local-first profile/feed state and a remote API client. Wallet authentication is based on explicit signatures rather than sending private keys to the Social service.

## Trust boundary

Social may receive:

- public wallet address;
- public profile/handle data;
- signed authentication messages;
- session tokens;
- posts, likes, follows and other social content.

Social must never receive:

- mnemonic / seed phrase;
- raw private key;
- Android Keystore material;
- decrypted wallet secret;
- unbounded transaction authority.

## Authentication flow

```text
Social requests challenge
        ↓
Wallet shows/authorizes signing boundary
        ↓
Wallet signs locally
        ↓
Social API verifies signature
        ↓
Short-lived application session
```

Profile registration may use EIP-712 typed data when the backend contract requires it. A signature authenticates intent; it must not be repurposed into a hidden payment or transaction.

## Offline-first rule

Local state should remain usable when the remote service is unavailable. Synchronization must be idempotent where possible, preserve user intent and avoid duplicating actions after reconnect.

## Production gates

Before production promotion:

- server-side authorization tests;
- rate limiting and abuse controls;
- session expiration/revocation;
- replay protection for wallet challenges;
- moderation/report/block paths;
- privacy/data-retention policy;
- backend backup/restore evidence;
- monitoring and incident-response ownership.
