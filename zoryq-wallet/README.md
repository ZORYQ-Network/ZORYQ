# ZORYQ Wallet — Testnet

Self-custody mobile wallet for the ZORYQ Testnet Alpha.

## Current testnet features
- Create a 12-word BIP-39 recovery phrase.
- Restore from a 12/24-word BIP-39 phrase.
- Deterministic ML-DSA-65 account derivation.
- Native `zq1...` Bech32 address.
- Device-authenticated secure storage.
- Screenshot protection on seed/recovery screens.
- ZORYQ Testnet balance, points and faucet integration.
- 24-hour faucet cooldown per wallet.

## Security boundary
The recovery phrase and ML-DSA secret key never leave the device. Only the public `zq1...` address is sent to the ZORYQ Testnet API.

This is an experimental testnet build. Do not store money or mainnet assets until the wallet and chain have completed independent security review.
