# ZORYQ Security Policy

ZORYQ EVM Testnet is experimental infrastructure. Security reports that could affect wallets, signing, contracts, RPC, faucet, treasury, deployment tooling or user data should be handled privately until mitigated.

## Reporting a vulnerability

Do **not** open a public GitHub issue with exploit details, private keys, transaction-signing weaknesses or steps that could put users or infrastructure at risk.

Until a dedicated public security contact is configured, use GitHub's private security reporting / security advisory features for this repository when available. If those features are unavailable, report only the existence and general category publicly and wait for a private channel before sharing technical exploit details.

## High-priority scope

- wallet connection and transaction construction;
- signature verification and replay protection;
- Treasury/admin authorization;
- DEX, Lending, Stake and Registry contracts;
- protocol fee routing;
- faucet abuse or unauthorized balance manipulation;
- public JSON-RPC authorization/bypass;
- access to Anvil/Hardhat/debug administrative methods;
- CI/CD and hosting secrets;
- Project Intelligence evidence integrity;
- Genesis score verification and proof replay;
- data exposure or unnecessary PII.

## Never request secrets

ZORYQ contributors and support flows must never request a user's seed phrase or private key. The Treasury-control proof uses wallet message signing and must not persist private keys or raw wallet signatures.

## Deployment claims

A contract is not considered canonical merely because a transaction was submitted. Canonical deployment requires a successful receipt, live bytecode and verification of relevant ownership/configuration against the current ZORYQ chain.

## Current network security posture

The current ZORYQ public testnet is a centralized testing environment. It is not a mainnet security guarantee, not a decentralization claim and not an independent audit. Public administrative Anvil/Hardhat/debug RPC methods are intentionally blocked.

## Testnet assets

ZQ and zUSD are testnet assets with no monetary value.
