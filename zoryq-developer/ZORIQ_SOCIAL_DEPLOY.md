# ZORIQ Social — Deployment Package

Status: deployment-ready static social prototype. Do not describe demo/local social data or roadmap capabilities as external adoption or live production features.

## Product boundary

- **ZORYQ Network** is the chain/protocol/developer infrastructure.
- **ZORIQ Social** is the consumer social dApp on top of that ecosystem.
- North star: **Real-Time Agentic Social & Financial Chain**.
- Social content is currently **demo/local persistence**. Verified chain identity, RPC status and Project Registry references are separate from demo social activity.
- Smart-account/passkey/paymaster, gas sponsorship, delegated-agent authority, agent wallets, stablecoin micropayments, MEV protection, sub-second finality, parallel execution and permissionless validators remain prototype/target boundaries unless independently verified.
- The strategic benchmark and evidence-gated roadmap live in `zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md`.

## Existing deployment target

Use the existing `zoryq-testnet` Vercel project or the existing ZORYQ web-serving infrastructure. Do **not** create another chain, Railway service or duplicate Vercel project just for ZORIQ Social.

Expected public routes after deploy:

- `/zoriq`
- `/social`
- `/zoriq-social`
- `/zoriq-social.html`

All clean routes rewrite to `zoriq-social.html`.

## Pre-deploy validation

From repository root:

```bash
node zoryq-developer/scripts/check-zoriq-social-readiness.mjs
```

The validator checks:

- required People / Projects / Agents / Communities / Proof Cards surfaces;
- Real-Time Agentic Social & Financial Chain product thesis;
- chain ID `5919065` / `0x5a5159`;
- verified Project Registry configuration;
- explicit separation of demo/local social persistence;
- explicit prototype boundaries for passkeys, gas sponsorship and agent authority;
- the 20-point execution roadmap document;
- absence of selected unverified production/performance claims;
- mobile breakpoint and composer input bound;
- Vercel rewrites for ZORIQ Social;
- baseline browser security headers.

## Deployment configuration

`zoryq-web/vercel.json` contains route rewrites and response security headers.

Current static prototype needs no secret environment variables. It reads public ZORYQ network configuration from `zoryq-web/config.js`. Never put private keys, mnemonics, admin signatures, privileged API credentials or paymaster secrets into the web bundle.

The browser CSP currently permits inline script/style because `zoriq-social.html` is self-contained. Before introducing third-party analytics, external image CDNs, embedded wallets, AI endpoints or other origins, update the CSP deliberately rather than broadening it with `*`.

## Final deploy procedure

1. Checkout branch `zoryq-evm-testnet-node`.
2. Run `node zoryq-developer/scripts/check-zoriq-social-readiness.mjs` and require exit code 0.
3. Review `zoryq-web/config.js`; confirm chain ID, RPC and contract addresses match the intended ZORYQ testnet.
4. Review `zoryq-developer/ZORYQ_NEXT_GEN_BENCHMARK_AND_ROADMAP.md`; confirm no target feature is being presented externally as live.
5. Deploy the **existing** ZORYQ web project with `zoryq-web` as the static web root/config scope according to the existing project settings.
6. After deploy, verify `/zoriq`, `/social`, `/start`, `/proof`, `/explorer` and `/config.js` return successfully.
7. Connect a disposable test wallet, confirm chain `5919065`, and verify the app never asks for or stores a seed phrase/private key.
8. Confirm social posts remain labeled demo/local until a persistent social backend is actually deployed.
9. Confirm the delegated-agent permission modal says it is a UI prototype and not an active permission.
10. Confirm tip/micropayment preview does not create or sign a transaction.
11. Confirm passkey/smart-account and sponsorship cards remain marked prototype/not active.

## Manual acceptance checklist

- Mobile width 360–430 px: navigation, onboarding, composer, feed, roadmap, side cards and modals remain usable.
- Desktop width 1280+ px: 3-column layout has no horizontal overflow.
- Keyboard: buttons and modal controls are reachable; Escape closes open modals.
- Wallet absent: app fails safely and explains that an injected EVM wallet is needed.
- Wrong chain: app can request/suggest ZORYQ Testnet without silently signing anything.
- Publish demo post: bounded by 500 characters; content remains local/demo.
- Follow/join UI: clearly local/demo, not represented as persisted network activity.
- Agent permission: agent, target, methods, assets, budget, time window, rate limit, slippage guard, simulation requirement and revocation boundary are visible.
- Tip preview: recipient, asset, amount, network, sponsorship state and final confirmation boundary are visible.
- Proof/Explorer links resolve to ZORYQ evidence surfaces.
- Network failure: social UI remains understandable and does not label the network healthy.
- Roadmap: all 20 execution priorities are visible as PARTIAL / PROTOTYPE / TARGET rather than fake live features.

## Security and product constraints

- Never store seed phrases or private keys.
- Explicit wallet confirmation is required before any future state-changing transaction.
- Treat external/user text as untrusted content; render as text, not arbitrary HTML.
- Add persistent moderation/report/block/mute controls before unrestricted public posting.
- Add server-side anti-spam/rate limits and Sybil controls before persistent public social storage.
- Add replay protection, session hardening and CSRF controls when introducing authenticated backend sessions.
- Validate external URLs/media before rendering them.
- Keep large social content off consensus-critical L1 state; anchor identity, proofs, permissions and economically meaningful attestations where verification adds value.
- Do not market ZORYQ as decentralized, BFT-proven, permissionless, 1M TPS, sub-second-finality production, audited, MEV-protected, passkey-live, gasless-live or production-ready social until the corresponding evidence gates pass.

## Next productionization boundary

A real public social launch still needs a persistent social data layer, authentication/session model, moderation/reporting/block/mute service, anti-spam/rate-limit enforcement, portable profile schema, durable follow/community graph, media storage policy and audited smart-account/paymaster/delegation implementation if those features are enabled.

The chain-level execution roadmap prioritizes public network evidence over additional feature count:

**code → node → devnet → public testnet → external validators → reproducible benchmarks → audit → applications → users**.

Until those gates pass, this package is a polished test/deployment-ready **social prototype**, not a production social network.
