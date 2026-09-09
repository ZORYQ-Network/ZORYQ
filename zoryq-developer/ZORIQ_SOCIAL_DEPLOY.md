# ZORIQ Social — Deployment Package

Status: deployment-ready static social prototype. Do not describe demo/local social data as external adoption.

## Product boundary

- **ZORYQ Network** is the chain/protocol/developer infrastructure.
- **ZORIQ Social** is the consumer social dApp on top of that ecosystem.
- Social content is currently **demo/local persistence**. Verified chain identity, RPC status and Project Registry references are separate from demo social activity.
- Smart-account/passkey/paymaster and delegated-agent authority are UX/protocol boundaries unless and until their live implementation is independently verified.

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

- required ZORIQ Social product surfaces;
- chain ID `5919065` / `0x5a5159`;
- verified Project Registry address;
- explicit separation of demo/local social persistence;
- absence of selected unverified production/performance claims;
- mobile breakpoint and composer input bound;
- Vercel rewrites for ZORIQ Social;
- baseline browser security headers.

## Deployment configuration

`zoryq-web/vercel.json` contains the route rewrites and response security headers.

Current static prototype needs no secret environment variables. It reads the public ZORYQ network configuration from `zoryq-web/config.js`. Do not put private keys, mnemonics, admin signatures or privileged API credentials into the web bundle.

The browser CSP currently permits inline script/style because `zoriq-social.html` is a self-contained prototype. Before introducing third-party analytics, external image CDNs, embedded wallets or other origins, update the CSP deliberately rather than broadening it with `*`.

## Final deploy procedure

1. Checkout branch `zoryq-evm-testnet-node`.
2. Run `node zoryq-developer/scripts/check-zoriq-social-readiness.mjs` and require exit code 0.
3. Review `zoryq-web/config.js`; confirm chain ID, RPC and contract addresses match the intended ZORYQ testnet.
4. Deploy the **existing** ZORYQ web project with `zoryq-web` as the static web root/config scope according to the existing project settings.
5. After deploy, verify `/zoriq`, `/social`, `/start`, `/proof`, `/explorer` and `/config.js` return successfully.
6. Connect a disposable test wallet, confirm chain `5919065`, and verify the app never asks for or stores a seed phrase/private key.
7. Confirm social posts remain labeled demo/local until a persistent social backend is actually deployed.
8. Confirm the delegated-agent permission modal still says it is a UI prototype and not an active permission.

## Manual acceptance checklist

- Mobile width 360–430 px: navigation, composer, feed, right-side cards and modal remain usable.
- Desktop width 1280+ px: 3-column layout has no horizontal overflow.
- Keyboard: buttons and modal controls are reachable and usable.
- Wallet absent: app fails safely and explains that an injected EVM wallet is needed.
- Wrong chain: app can request/suggest ZORYQ Testnet without silently signing anything.
- Publish demo post: bounded by 500 characters; content remains local/demo.
- Follow/join UI: clearly local/demo, not represented as persisted network activity.
- Agent permission: target, methods, budget, time window and rate limit are visible before any future delegated authority.
- Proof/Explorer links resolve to ZORYQ evidence surfaces.
- Network failure: social UI remains understandable and does not label the network healthy.

## Security and product constraints

- Never store seed phrases or private keys.
- Explicit wallet confirmation is required before any future state-changing transaction.
- Treat external/user text as untrusted content; render as text, not arbitrary HTML.
- Add persistent moderation/report/block controls before opening unrestricted public posting.
- Add server-side anti-spam/rate limits and Sybil controls before public persistent social storage.
- Keep large social content off consensus-critical L1 state; anchor identity, proofs, permissions and economically meaningful attestations only when verification adds value.
- Do not market ZORYQ as decentralized, BFT-proven, permissionless, 1M TPS or production-ready until the corresponding evidence gates pass.

## Next productionization boundary

A real public social launch still needs a persistent social data layer, authentication/session model, moderation/reporting service, anti-spam/rate-limit enforcement, portable profile schema, durable follow/community graph, media storage policy and audited smart-account/paymaster/delegation implementation if those features are enabled. Until then, this package is a polished test/deployment-ready **social prototype**, not a production social network.
