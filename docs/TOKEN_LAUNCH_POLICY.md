# ZORYQ Future Token & Project Financing Readiness Policy

**Status:** no ZORYQ investment token, public token sale, private token sale, presale, ICO, IDO, IEO or other fundraising token offering is activated by this document.

This policy keeps ZORYQ technically ready for a future token-based financing path while requiring an explicit launch decision, legal review, tokenomics, security review and treasury controls before any sale is enabled.

## 1. Design objective

ZORYQ should be able to introduce a future ecosystem token or financing token without rebuilding the wallet, chain, launch tooling or public website. The architecture therefore separates:

- Testnet native ZQ, which has no financial value;
- ZORYQ Score / XP / Testnet points, which are participation and reputation signals;
- any future production ecosystem token;
- any future fundraising or distribution contract;
- treasury and vesting contracts;
- public sale interfaces.

No automatic conversion between Testnet ZQ, points/XP and a future token is promised.

## 2. Launch-ready modules

The production architecture should support, but keep disabled until approved:

1. **Token Factory** — fixed or capped supply ERC-20 deployment using reviewed templates.
2. **Allocation Manager** — configurable allocations for ecosystem, treasury, community, team, strategic participants and liquidity.
3. **Vesting** — cliff + linear vesting, beneficiary-specific schedules and public unlock visibility.
4. **Treasury** — multisig-controlled custody and auditable movement of project funds.
5. **Distribution / Claim** — Merkle or equivalent claim mechanism for eligible distributions.
6. **Sale Module** — configurable start/end, caps, per-wallet limits, accepted assets, pause/emergency controls and allowlist hooks.
7. **Compliance Hooks** — optional eligibility/allowlist providers, jurisdiction restrictions and terms acceptance where required.
8. **Launch Dashboard** — supply, allocation, vesting, sale status, treasury disclosures and contract addresses.

## 3. Hard launch gates

A financing token sale MUST remain disabled until all relevant gates are satisfied:

1. real product and documented use case;
2. clear token utility or financing rationale;
3. legal/regulatory analysis for target jurisdictions and sale structure;
4. documented tokenomics and dilution/unlock model;
5. reviewed/audited contracts appropriate to the value at risk;
6. treasury custody and signer policy;
7. vesting for team/insiders/strategic allocations;
8. public risk disclosures and terms;
9. incident response, pause and recovery procedures;
10. accounting/tax operational readiness;
11. anti-sybil/eligibility rules if rewards or community allocation are used;
12. explicit production launch approval recorded in the ZORYQ decision log.

## 4. Tokenomics principles

- Utility and sustainable demand before speculation.
- No guaranteed return, price or appreciation statements.
- Supply, allocations, vesting and unlocks must be transparent.
- Avoid unnecessary concentration and hidden insider allocations.
- Team/strategic allocations should use enforceable vesting rather than informal promises.
- Treasury funds should be segregated from founder/personal wallets.
- Upgrade/admin privileges must be publicly documented.
- Sale contracts should be pausable in emergencies, with clearly documented authority.
- Public dashboards should show the canonical contracts and relevant supply/vesting information.

## 5. Financing paths the architecture should preserve

ZORYQ may later evaluate one or more of these independently:

- traditional equity / strategic investment;
- grants and ecosystem funding;
- paid Launch Studio / AI Builder / RPC products;
- strategic token round;
- community token distribution;
- public token sale where legally and operationally appropriate.

The existence of a technical Sale Module does not mean a public token sale is the preferred path.

## 6. Testnet points and future token

ZORYQ Score and Testnet points may be considered as one input to a future community eligibility model, but there is no guaranteed conversion ratio, token quantity, snapshot date or entitlement. Validator/node contribution may receive greater participation weight than low-cost mobile activity, subject to anti-sybil and proof-of-contribution rules.

## 7. Production activation model

All future sale UI and contracts use an explicit `DISABLED_BY_DEFAULT` lifecycle:

`DESIGN -> TESTNET -> SECURITY_REVIEW -> LEGAL_REVIEW -> LAUNCH_APPROVAL -> PRODUCTION_ENABLED`

The website and APK must not expose a working purchase flow before `PRODUCTION_ENABLED`.

## 8. Security requirements

- Never embed treasury, deployer or admin private keys in the app, website, repository or CI artifacts.
- Prefer hardware-backed/multisig administration for production treasury and high-impact contracts.
- Separate deployer, treasury, pause/emergency and operational roles.
- Verify contracts and publish canonical addresses.
- Test caps, refunds (if applicable), vesting, pause paths, rounding, decimals and token transfer edge cases before production.

## 9. Documentation package required before a sale

Before activation, publish at minimum:

- current whitepaper;
- token utility/rationale;
- tokenomics and total supply;
- allocation table;
- vesting/unlock schedule;
- sale terms and eligibility rules;
- risk disclosures;
- canonical contract addresses;
- treasury/governance policy;
- security/audit information appropriate to the launch;
- post-sale use-of-funds framework and reporting cadence.

## 10. Communication

Until a formal launch decision is made, ZORYQ must not advertise a token sale, guaranteed airdrop, guaranteed token conversion, target price, guaranteed valuation or investment return. Public Testnet ZQ remains a test asset with no financial value.
