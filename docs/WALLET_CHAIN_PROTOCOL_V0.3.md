# ZORYQ Wallet ↔ Chain Protocol v0.3

This document is normative for the official ZORYQ Wallet and ZORYQ Chain user-account protocol.

## Account identity
- Recovery: BIP-39 mnemonic (12 words by default; restore may accept 12/24).
- Key algorithm: ML-DSA-65 (FIPS 204).
- Account derivation domain: `zoryq-mldsa65-v1:account`.
- Address HRP: `zq`.
- Address payload: first 20 bytes of SHA-256(raw ML-DSA-65 public key), Bech32 encoded.
- New user public-key encoding: raw FIPS 204 ML-DSA-65 public key, base64, format id `mldsa65-raw-v1`.

## Signing domains
- Human/dApp message authentication: `zoryq-sign-v1:` + UTF-8 message.
- User transaction signing: `zoryq-tx-v1:` + canonical JSON transaction.

## Canonical transaction JSON
- UTF-8.
- Object keys sorted lexicographically.
- Compact separators (no insignificant whitespace).
- Integers stay integers.
- `signature` is excluded from the signed payload.
- `pubkey_format` and `pubkey` are included in the signed payload.

## Provider API
The browser extension exposes `window.zoryq` on approved ZORYQ origins.

Methods:
- `zoryq_chainId`
- `zoryq_requestAccounts`
- `zoryq_accounts`
- `zoryq_signMessage`
- `zoryq_signTransaction`

Testnet Chain ID: `zoryq-testnet-1`.

## Security invariants
1. The private key / mnemonic never leaves the wallet.
2. A node derives the sender address from the submitted public key and rejects mismatches before accepting the signature.
3. A dApp never receives the mnemonic or private key.
4. Testnet faucet authentication uses a short-lived server challenge signed by the wallet.
5. Wallet and Chain releases must include a compatibility test before version promotion.

## Compatibility
Devnet v0.3 keeps legacy OpenSSL-DER signed transactions temporarily for validator/faucet internals. New end-user wallets use `mldsa65-raw-v1` only.