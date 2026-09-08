# ZORYQ Builder Reputation v0.1

Builder Reputation is a project-level quality signal derived from verifiable network evidence. It is not a token promise, financial rating, or popularity contest.

## Design goals

1. Reward real usage by independent wallets.
2. Reward repeat usage and retention more than one-off transactions.
3. Reward contracts that are actually used, not merely deployed.
4. Reward integrations with ZORYQ primitives when those interactions are verifiable.
5. Keep self-attested/social data outside the verified reputation score.
6. Make every component explainable and reproducible.

## Score (0-100)

The initial model has five components, each capped before aggregation:

- **Adoption — 30 points**: unique external wallets interacting with project contracts.
- **Retention — 25 points**: wallets returning in later activity windows.
- **Usage quality — 20 points**: successful interactions from independent wallets, with diminishing returns per wallet.
- **Ecosystem integration — 15 points**: verifiable interactions with approved ZORYQ primitives such as DEX, Stake and Lending when live.
- **Reliability — 10 points**: contract longevity, successful transaction ratio and absence of known integrity flags.

`reputation = adoption + retention + usageQuality + ecosystemIntegration + reliability`

## Anti-gaming rules

- Project owner/builder wallets do not count as external adoption.
- Repeated calls from one wallet have sharply diminishing weight.
- Contract deployments alone do not increase reputation.
- Self-attested X/social actions do not increase verified Builder Reputation.
- Activity must have successful receipts and target a contract declared by the project's versioned manifest.
- A contract can only contribute to one active project identity at a time unless an explicit shared-integration relationship is declared.
- Suspected circular/wash interaction clusters can be excluded from verified metrics while remaining visible in raw analytics.
- Reputation is recomputed from evidence; it is not an arbitrary administrator-editable number.

## Evidence tiers

- `onchain`: receipt/log/call evidence from ZORYQ.
- `external_verified`: independently verifiable identity or external proof.
- `self_attested`: displayed separately; never included in verified reputation.
- `pending`: submitted but not yet verified.

## Project Intelligence output

A project profile should eventually expose:

- project ID / slug / owner
- manifest hash + version
- declared contracts
- unique external wallets
- returning wallets
- successful interactions
- DEX volume generated
- protocol fees generated
- Stake/Lending interactions
- first/last observed activity
- integrity flags
- Builder Reputation total and component breakdown
- exact methodology version

## Status

Specification only. Project Registry is currently source-level and not deployed. Project-level indexation is not yet live. No current project should be advertised with a verified Builder Reputation until the evidence pipeline is implemented and validated.
