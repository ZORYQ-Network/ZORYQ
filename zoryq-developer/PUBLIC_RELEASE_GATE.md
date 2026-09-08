# ZORYQ public release gate

Purpose: prepare a safe, discoverable public developer surface without exposing privileged infrastructure or secrets.

## Release principle
Do not make the historical monorepo public by default. Publish a clean, minimal developer-facing repository/surface only after this gate passes.

## Required checks
1. No private keys, mnemonics, seed phrases, API tokens, service credentials or wallet signatures.
2. No Railway/Vercel/Supabase secret values; public endpoint URLs are allowed.
3. No privileged deployment automation capable of signing transactions.
4. No stale KYVO branding or claims that conflict with current ZORYQ identity.
5. No claim of decentralization, multi-validator consensus, audit completion, Mainnet readiness or token value.
6. Chain identity fixed to ZORYQ EVM Testnet / Chain ID 5919065.
7. RPC, Explorer, Faucet, DEX, Lending, Stake and Project Registry links verified before release.
8. `README`, `LICENSE`, `SECURITY`, `CONTRIBUTING` and quickstart present.
9. Starter examples use environment placeholders only and never committed secrets.
10. All state-changing examples require explicit user wallet confirmation.

## Public starter scope
Recommended first public package:
- chain configuration;
- five-minute Foundry quickstart;
- viem read-only example;
- ethers v6 read-only example;
- minimal wallet Add/Switch Network example;
- contract addresses and Explorer links;
- Agent Action / Project schemas;
- Project Registry read-only example;
- responsible disclosure policy;
- good-first contributor guide.

Exclude from first public package:
- privileged admin internals;
- infrastructure credentials/configuration values that are not intentionally public;
- historical obsolete deployment workflows;
- unrelated legacy application code;
- any key material.

## Exit criteria
The release is ready when a new developer can clone it, connect to the public RPC, read chain state, deploy a simple contract using their own wallet, verify the transaction in Explorer and understand the current centralized-testnet maturity disclosure without access to any ZORYQ privileged secret.
