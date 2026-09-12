# ZORYQ Developer Onboarding

ZORYQ is an experimental EVM-compatible public testnet under active development. This guide distinguishes **verified public paths** from milestones that still require independent external reproduction.

## Goal

**Discovery → Docs → Faucet → First Transaction → First Contract → First Application → Contribution → Ecosystem Project**

## Network identity

- Network: **ZORYQ Testnet**
- Chain ID: **5919065**
- Native test currency: **ZQ**
- Compatibility target: **EVM**
- Stage: **experimental public testnet / active development**
- Public project surface: https://zoryq-testnet.vercel.app
- RPC: https://zoryq-evm-node-live-production.up.railway.app/rpc
- Faucet/start: https://zoryq-evm-node-live-production.up.railway.app/start
- Explorer: https://zoryq-evm-node-live-production.up.railway.app/explorer

These endpoints are also independently discoverable through the merged `ethereum-lists/chains` registry submission: https://github.com/ethereum-lists/chains/pull/8687

## Evidence-gated onboarding status

| Stage | Current public status | Evidence |
| --- | --- | --- |
| Discovery | Available | Repository and public project surface |
| Docs | Available / improving | Public architecture, protocol, security, research and contribution docs |
| Faucet | **Technically verified from public infrastructure** | GitHub-hosted run `34697729081` funded a fresh wallet with 100 ZQ |
| First transaction | **Technically verified from public infrastructure** | Same run produced a signed transaction with receipt `status=1` |
| Independent developer reproduction | Open | Issue #88 |
| First contract | Not yet promoted as stable | Needs reproducible deployment instructions plus public receipt/address |
| First application | Not yet promoted as stable | Needs an external developer build without privileged setup |
| Contribution | Available | CONTRIBUTING.md and public GitHub Issues |
| Ecosystem project | Target | Independent project with reproducible integration |

## Fastest reproducible test

The repository contains a non-secret proof runner for the public developer path:

```bash
git clone https://github.com/ZORYQ-Network/ZORYQ.git
cd ZORYQ/tools/external-proof
npm install
npm run prove
```

The runner creates a fresh wallet in process memory, requests test ZQ from the public faucet, waits for the balance to become visible through RPC, signs a real transaction, waits for its receipt, and prints only non-secret evidence. It does **not** print or persist the private key.

A successful reproduction should report:

- Chain ID `5919065`;
- a fresh public address;
- faucet transaction hash;
- funded balance;
- signed transaction hash;
- receipt block;
- receipt status `1`.

Never publish the private key or mnemonic of the temporary wallet.

## Verified reference run

The public-path runner completed successfully from GitHub-hosted infrastructure using only the public ZORYQ RPC and faucet in workflow run `34697729081`:

- Chain ID: `5919065`
- fresh wallet: `0xD556Bb49192f4025E51be72a2c1A82563a95F7Fe`
- faucet HTTP: `200`
- faucet tx: `0x5a0daa7ba9de10d52a4c91ea69970a7214d0b18df991bfff0620087d8b12d81a`
- funded balance: `100 ZQ`
- signed tx: `0x5480da2d39cadb6e88a69e76b97d7b7baed100e50a7b9efaea55a816dd6f2cf0`
- receipt block: `111776`
- receipt status: `1`
- artifact digest: `sha256:9ef3c125bb5228237f2b640172a5085b70a60235f070a267070df14aa045f15e`

This proves the technical public path. It does **not** count as independent-developer adoption because the workflow is controlled by the ZORYQ repository.

## External developer challenge

The highest-value next traction milestone is an independent developer reproducing the same flow without privileged help and publishing only non-secret evidence.

Start here: https://github.com/ZORYQ-Network/ZORYQ/issues/88

A successful independent reproduction will unlock the next onboarding focus: **First Transaction → First Contract**.

## What developers can contribute now

- independently reproduce the public proof runner and report success/failure;
- inspect EVM/RPC compatibility assumptions;
- improve onboarding and actionable faucet error handling;
- add explicit negative tests;
- propose reproducible benchmark workloads and methodology;
- review security assumptions and threat models;
- convert research claims into falsifiable experiments;
- improve documentation and developer UX without weakening evidence gates.

See [CONTRIBUTING.md](../CONTRIBUTING.md) and public Issues.

## Research direction

ZORYQ is researching **adaptive verifiable execution — a blockchain architecture designed to dynamically handle different transaction workloads while preserving deterministic state.**

This is a research direction, not a production or performance claim. It should advance through:

**specification → prototype → test → benchmark → independent reproduction → supported capability**

## Publication rule

Do not publish or repeat claims about TPS, decentralization, congestion isolation, parallel execution, security, audit status or production readiness unless a linked artifact supports them. Measurable claims should include commit, environment, topology, workload/configuration, duration, raw output, methodology and limitations.

## Next milestone

**Independent developer reproduction → reproducible First Contract tutorial.**

Technical public-path verification is no longer the primary unknown. External reproduction and zero-to-contract developer experience are now the highest-value onboarding gates.
