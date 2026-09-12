# ZORYQ External Traction Evidence

This document records externally reproducible traction evidence. It is intentionally conservative: evidence is separated from roadmap or marketing claims.

## 2026-09-12 — first independent developer reproduction

GitHub user `@shivamdwivedi2442` reported a successful reproduction of the public ZORYQ first-transaction path from a local machine as an independent developer.

Public source: [Issue #88](https://github.com/ZORYQ-Network/ZORYQ/issues/88)

### Reproduced path

`public RPC -> public faucet -> fresh wallet -> funded balance -> signed transaction -> confirmed receipt`

### Published non-secret evidence

- Schema: `zoryq-external-first-transaction-proof/1.0`
- Chain ID: `5919065`
- RPC: `https://zoryq-evm-node-live-production.up.railway.app/rpc`
- Faucet: `https://zoryq-evm-node-live-production.up.railway.app/faucet/claim`
- Fresh wallet: `0x1Cf099E4Feb85B97EC5210dca73929B376e3f2eC`
- Faucet HTTP status: `200`
- Faucet result: `ok=true`
- Faucet transaction: `0x4171e1d3b20bd52d7267cee15ab692656ed5aeb37e818aadaaf13102a98a9b23`
- Faucet amount: `100 ZQ`
- Observed funded balance: `100 ZQ`
- Signed transaction: `0x98ff155f15686957d2b33bceb93e05a3c5c9677437aef4e7a551e23ba9900e4b`
- Receipt block: `112071`
- Receipt status: `1`
- Reported runner limitations: `[]`
- Started: `2026-09-12T14:04:23.418Z`
- Completed: `2026-09-12T14:04:42.295Z`

Issue #88 was closed as completed after the evidence was reviewed against its published acceptance criteria.

## What this proves

This is evidence that an external developer could use the public ZORYQ onboarding path without requiring a ZORYQ private key, seed phrase, infrastructure credential, private faucet bypass or undocumented privileged endpoint.

It materially improves confidence in the public developer funnel at the `Faucet -> First Transaction` stage.

## What this does not prove

This evidence does **not** by itself prove:

- an independently operated Node 2;
- decentralized consensus;
- multi-operator production infrastructure;
- audited security;
- production or mainnet readiness;
- real economic value for testnet ZQ;
- revenue, TVL, retained users or product-market fit.

Those are separate evidence gates.

## Next external traction gates

1. Independent Node 2 under a separate control boundary with peer/convergence/restart evidence — [Issue #73](https://github.com/ZORYQ-Network/ZORYQ/issues/73).
2. Multiple independent developers repeating the onboarding path.
3. First independently created/deployed application using ZORYQ.
4. First independent reproduction of the Autonomous Company vertical slice once its capability gates are complete.
5. First paying customer or externally funded pilot using a production-safe ZORYQ service.

## Evidence policy

Never convert a single reproduction into a broader adoption claim. ZORYQ should report the exact number and type of independently verified external events and link to public evidence whenever possible.
