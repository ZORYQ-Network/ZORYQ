# Contributing to ZORYQ Developer Kit

We want contributions that make it easier for another developer to build something real on ZORYQ.

## Great first contributions

- a working viem/ethers/Foundry example;
- DEX reserve or quote dashboard;
- lending health-factor example;
- Project Registry registration helper;
- agent action manifest example;
- wallet integration;
- RPC/network smoke test;
- documentation fix that removes friction.

## Contribution standard

A useful contribution should be:

1. small enough to review quickly;
2. runnable without private infrastructure credentials;
3. safe by default;
4. testnet-only unless explicitly documented otherwise;
5. backed by a verifiable result when it performs an on-chain action.

## Security rules

- Never commit seed phrases or private keys.
- Never ask users to paste a seed phrase.
- Prefer read-only examples when signing is unnecessary.
- For state-changing examples, show target, method/value and expected action before signing.
- Treat ZQ/zUSD as test assets with no monetary value.

## Network truth

ZORYQ is currently a centralized public EVM testnet. Contributions must not describe it as decentralized, multi-validator, production-ready or audited unless public evidence has changed.

## Founding builders

Independent builders are especially valuable right now. Core-team/Treasury self-activity does not count as external adoption. If you deploy something independently, include the transaction/contract address so it can be verified in the Explorer.
