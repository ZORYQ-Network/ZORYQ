# Games runtime security boundary

The native games runtime is an untrusted product surface relative to wallet signing.

Allowed inputs are bounded public/session context. Disallowed inputs include seed phrases, mnemonics, raw private keys, keystore material and long-lived provider credentials.

Game state and scores are non-authoritative. Future blockchain rewards require independent verification, anti-replay controls and a Wallet-hosted signing flow.
