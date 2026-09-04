# ZORIQ Revenue Engine

ZORIQ monetizes **before** a proprietary blockchain exists. Revenue activation is gated by partner accounts, store products, backend controls and security checks.

## Official public treasuries
- EVM: `0xc0e03982fb8615ddf8b8fabd27e5a35541e12f33`
- Solana: `53uWrDJCiGtFHZPFiCzuRGPbSxEYaep2JC5mCQqZV3jG`
- Bitcoin Native SegWit: `bc1q55tt9sphzstjvs3tzylxsltxvvwsv8l69dydmg`

Public receiving addresses only. Private keys/seeds never belong in the app, GitHub, backend or logs.

## Engine 1 — ZORIQ Route Fee
Launch hypothesis: **15 bps / 0.15%** on eligible routes, configurable server-side.

Rules:
- fee disclosed separately before signature;
- network/provider/ZORIQ fees remain separate;
- live charging requires integrator + compatible treasury + backend policy;
- every monetized transaction is reconciled on-chain;
- kill switch can disable fees without disabling portfolio access.

Illustrative gross fee at 0.15% (not a forecast):
- US$100k monthly eligible volume -> US$150
- US$1M -> US$1,500
- US$10M -> US$15,000
- US$100M -> US$150,000

## Engine 2 — ZORIQ Pro
Founders pricing hypothesis: **US$4.99/month** or localized store equivalent.

Paid value:
- advanced Guard analysis/history;
- portfolio intelligence;
- routing controls;
- ONE automations when production-ready;
- premium alerts/customization;
- priority support.

No paid plan guarantees a token or airdrop.

## Engine 3 — ZORIQ Business
Future B2B products:
- Guard API;
- ONE API;
- risk webhooks;
- routing intelligence;
- partner dashboard and reconciliation.

## Engine 4 — Partner/referral revenue
Only where the protocol/partner explicitly permits affiliate, integrator or revenue-share monetization.

## Engine 5 — Future ZORIQ Network
A future ZORIQ L2/appchain can add execution-layer economics after product traction justifies native infrastructure. It is not required for initial revenue.

## Revenue ledger
For each monetized transaction store quote id, chain namespace/id, tx hash/signature, fee asset, gross fee, partner share, net ZORIQ revenue, destination treasury, disclosure-policy version, settlement status and timestamps.

## Activation gate
Revenue mode remains preview until partner approval, canary settlement, UI disclosure, reconciliation, support/refund process and market-appropriate legal/tax/accounting review are complete.
