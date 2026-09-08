# Contributing to ZORYQ

Thanks for helping build ZORYQ EVM Testnet.

ZORYQ is an experimental EVM testnet focused on agent-native developer tooling, verifiable builder intelligence and transparent infrastructure. The current public testnet is centralized and should not be described as production-ready or decentralized.

## Good first contributions

- improve ethers, viem, Foundry and Hardhat examples;
- improve Explorer UX and permanent `/tx`, `/address`, `/block` and `/token` routes;
- add RPC compatibility tests;
- improve accessibility and mobile UX in Faucet, DEX, Stake and Lending;
- add safe read-only network analytics;
- improve Project Intelligence and Builder Reputation evidence quality;
- document independent-node and multi-validator requirements.

## Workflow

1. Open or select an issue for material work.
2. Use a focused branch.
3. Implement tests and documentation with the change.
4. Run the relevant test suite.
5. Open a focused PR with reproducible verification steps.
6. Security-sensitive wallet, signing, contracts, fees, faucet, treasury and RPC changes require additional review.

## Definition of Done

- loading/error/empty states where relevant;
- no unnecessary PII or secrets in analytics;
- basic accessibility;
- tests proportional to risk;
- documentation updated;
- no secret committed;
- no false deployment/decentralization claims.

## Security rules

1. Never commit private keys, mnemonics, tokens or hosting secrets.
2. Never expose Anvil/Hardhat/debug administrative RPC namespaces publicly.
3. Never label a contract as deployed until receipt, bytecode and relevant configuration are verified against the live chain.
4. State-changing wallet flows must require explicit wallet confirmation.
5. Do not create CI workflows that autonomously broadcast privileged deployments using embedded or ephemeral private keys.
6. ZQ and zUSD are testnet assets with no monetary value.

## Pull request checklist

Include a problem statement, implementation approach, tests or reproducible verification, screenshots for user-facing changes when useful, security impact, and RPC/contract/wallet/faucet implications when applicable.

## Responsible disclosure

Do not open a public issue for a suspected vulnerability. Follow `SECURITY.md`.

## Commits

Prefer Conventional Commits: `feat:`, `fix:`, `security:`, `docs:`, `test:`, `chore:`.
