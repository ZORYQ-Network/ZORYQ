# Build on ZORYQ — External Builder Challenge

ZORYQ is looking for independent developers who want to test a public experimental EVM-compatible network and leave behind reproducible evidence.

This is not a token-reward promise and testnet ZQ has no implied monetary value. The goal is to make the developer path independently reproducible and to find real external applications worth supporting.

## Fastest path — first transaction

```bash
git clone https://github.com/ZORYQ-Network/ZORYQ.git
cd ZORYQ/tools/external-proof
npm install
npm run prove
```

The runner creates a fresh in-memory wallet, requests public testnet funds, submits a signed transaction and prints non-secret evidence.

Never publish a private key, seed phrase, provider credential or infrastructure secret.

## Choose one builder track

### Track A — repeat the independent proof

Run the first-transaction proof from your own machine and post the non-secret result.

Evidence requested:
- Chain ID;
- fresh public wallet address;
- faucet result;
- funded balance;
- signed transaction hash;
- block number;
- receipt status;
- any onboarding friction.

### Track B — deploy the first external contract

Use Hardhat, Foundry, viem, ethers or another standard EVM toolchain and deploy a small contract using only public ZORYQ infrastructure.

Evidence requested:
- public/reviewable source;
- exact deployment command;
- deployment transaction;
- contract address;
- successful read/write reproduction;
- any RPC/tooling incompatibility.

### Track C — build an external dApp

Create a minimal application that performs at least one useful live read from ZORYQ and, where appropriate, one wallet-confirmed state-changing action.

The application must not request or store seed phrases/private keys.

Evidence requested:
- source repository;
- run instructions;
- screenshot or short description of the user flow;
- transaction/contract evidence where applicable;
- known limitations.

### Track D — run Independent Node 2

Use infrastructure you control independently from the primary ZORYQ operator and follow [`EXTERNAL_NODE2_HANDOFF.md`](EXTERNAL_NODE2_HANDOFF.md).

This is the highest-value network contribution currently open. A second process controlled by the primary operator does not count as independent evidence.

## Current public endpoints

- Chain ID: `5919065`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet/claim`
- Developer surface: `https://zoryq-evm-node-live-production.up.railway.app/developer`

## What counts as external traction

External traction must come from a person/project not controlled by the primary ZORYQ operator.

Project-owned CI, project-owned wallets, same-operator replicas, synthetic fixtures and internal demonstrations are useful engineering evidence but do not count as independent adoption.

## Current target

The immediate traction gate is:

- 5 independent developers;
- at least 3 progressing beyond faucet-only activity;
- 1 external contract/application;
- 2 repeat external users;
- 1 design partner/pilot;
- 1 independently controlled Node 2.

Track this in [Issue #103](https://github.com/ZORYQ-Network/ZORYQ/issues/103).

## After you build

Open an issue using the **External builder evidence** template and attach only non-secret evidence. Negative results are welcome: a reproducible failure is actionable product data.

If your project becomes a useful external application, ZORYQ may feature it in the public ecosystem evidence once the claims can be independently verified.
