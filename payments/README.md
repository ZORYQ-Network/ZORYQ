# ZORYQ Evolution Payments

Each prompt-based App Factory evolution is priced at **USD 1.99** and pays the configured ZORYQ Treasury.

## Canonical Treasury

`0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33`

This address is the configured destination for ZORYQ, Base, Arbitrum and Ethereum. A matching EVM address format does not by itself prove operational control on every chain, so each network remains disabled until the full payment path is verified.

## Current allowlist

- **Base (8453):** ETH, USDC
- **Arbitrum (42161):** ETH, USDC, USDT
- **Ethereum (1):** ETH, USDC, USDT
- **ZORYQ (5919065):** no real-value payment asset enabled yet

USDC mainnet contracts follow Circle's published contract addresses. USDT is enabled only where the current supported transport/contract path has been identified. Base USDT is intentionally not enabled.

## Safety gate

All chains remain `enabled: false` until:

1. Treasury control is operationally verified on the selected chain;
2. the selected asset path is verified;
3. the wallet transaction builder is integrated;
4. receipt/log verification passes against a real transaction;
5. replay and duplicate-evolution protection is exercised;
6. payment success unlocks exactly one evolution;
7. the Factory UI exposes network, asset, Treasury, price, gas and verification state.

A transaction hash alone never unlocks an evolution.

See `docs/EVOLUTION_PAYMENTS.md`, `payments/evolution-payment.config.json`, and Issue #108.
