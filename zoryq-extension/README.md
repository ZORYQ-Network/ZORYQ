# ZORYQ Wallet Extension — Testnet

Browser companion wallet for ZORYQ Testnet Alpha.

## Features
- BIP-39 12-word wallet creation.
- Import of 12/24-word BIP-39 recovery phrases.
- Same deterministic `zoryq-mldsa65-v1` account derivation used by the Android wallet.
- ML-DSA-65 public identity and native `zq1...` address.
- Local encrypted vault protected by a wallet password.
- PBKDF2-SHA-256 (310,000 iterations) + AES-256-GCM.
- No seed phrase or private key is sent to ZORYQ servers.

## Build
```bash
npm install
npm run build
```
Load the generated `dist/` directory as an unpacked extension in Chrome/Edge developer mode for testnet use.

## Security status
Experimental testnet build. Do not use for mainnet money until independent review, extension-store hardening, content-security review and signing/release procedures are complete.
