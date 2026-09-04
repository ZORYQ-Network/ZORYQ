# ZORYQ Wallet v1 — Recovery & Key Derivation

## Scope
This specification defines the testnet wallet identity used by the ZORYQ mobile wallet.

## Recovery phrase
- Standard: BIP-39 English mnemonic.
- Default: 12 words (128 bits entropy).
- Import: 12 or 24 words.
- The mnemonic is generated and processed locally.
- The mnemonic or derived secret key MUST NOT be sent to Supabase, analytics, RPC, support systems or any ZORYQ backend.

## ZORYQ account derivation
Because ML-DSA does not use BIP-32, ZORYQ uses an explicitly versioned deterministic derivation:

1. `root = BIP39.mnemonicToSeed(mnemonic)` (64 bytes).
2. `domain = UTF8("zoryq-mldsa65-v1:account")`.
3. `keySeed = SHA-256(domain || root || uint32_be(accountIndex))`.
4. `ML-DSA-65.keygen(keySeed)` generates the signing keypair.
5. `payload = SHA-256(publicKey)[0..19]`.
6. `address = Bech32(hrp="zq", payload)`.

Account index `0` is the first/default account.

## Signing
- Signature scheme: ML-DSA-65 / FIPS 204.
- Implemented with `@noble/post-quantum`.
- Secret keys are derived only when needed and should be zeroized after use where the runtime permits it.

## Mobile secret storage
- Android/iOS wallet recovery material is stored with `expo-secure-store` and device authentication.
- Android cloud backup is disabled for wallet secret material.
- Screenshot capture is blocked on backup/recovery screens when the OS supports it.
- Recovery words are shown during onboarding only after explicit user action and require backup verification before persistence.

## Mainnet gate
This v1 implementation is for ZORYQ Testnet. Do not enable mainnet funds until the wallet derivation, native storage, transaction signing and recovery flows receive an independent security review and real-device testing.
