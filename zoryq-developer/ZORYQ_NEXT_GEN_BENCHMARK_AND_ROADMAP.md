# ZORYQ — Next-Generation Chain Benchmark & Execution Roadmap

> Strategic product document. Last reviewed: 2026-09-09.
>
> This document separates **verified public evidence**, **current ZORYQ implementation**, and **target architecture**. Targets are not claims of live capability.

## North star

**ZORYQ = Real-Time Agentic Social & Financial Chain**

ZORYQ should not try to win with a single TPS headline. The differentiated product thesis is the combination of:

- very-low-latency EVM execution;
- first-class AI agents with bounded authority;
- SocialFi and portable reputation;
- native DEX / PerpDEX surfaces;
- human + agent payments and micropayments;
- wallet-native identity;
- account abstraction, passkeys and sponsored gas UX;
- verifiable project / builder reputation and Proof Cards;
- explicit security, MEV and permission boundaries.

The execution standard is: **code → node → devnet → public testnet → external validators → reproducible benchmarks → audit → applications → users**.

## Benchmark context

The scores below are strategic estimates, not scientific measurements. Differences of 1–2 points should not be treated as objective ranking precision.

| Chain | Current public stage | Performance / architecture | Security | Dev / UX | Differentiation | Execution evidence | Strategic score |
|---|---|---:|---:|---:|---:|---:|---:|
| MegaETH | Mainnet / continuing evolution | 98 | 91 | 95 | 95 | 93 | 95/100 |
| Monad | Public network / launch-era ecosystem | 95 | 92 | 96 | 91 | 91 | 93/100 |
| Somnia | Mainnet | 97 | 89 | 92 | 95 | 91 | 93/100 |
| RISE | Mainnet | 96 | 88 | 93 | 94 | 91 | 92/100 |
| Tempo | Mainnet | 89 | 92 | 94 | 98 | 92 | 93/100 |
| **ZORYQ — current architecture target** | Development / testnet work | **94** | **89** | **94** | **98** | **55** | **86/100 current strategic estimate** |
| **ZORYQ — roadmap target** | Target only | **98** | **96** | **99** | **99** | **95** | **97/100 potential target** |

### Evidence notes

- **MegaETH:** its public material describes a real-time EVM, public explorer/faucet ecosystem, sub-10 ms block-time positioning and high-throughput execution. Historical public testnet material demonstrated ~1 GGAS/s and 10 ms blocks; later public material describes higher mainnet targets/metrics. Do not copy competitor marketing numbers into ZORYQ claims without independently reproducible ZORYQ benchmarks.
- **RISE:** its public site states mainnet is live and positions the chain for real markets with millisecond execution, including 1 ms order-book updates, ~50k peak TPS and 5 GGAS/s claims.
- **Somnia:** its public site positions Somnia as an **Agentic L1**. Somnia's own 2026 update says Agents and Reactivity shipped to mainnet and reports 1.05M TPS demonstrated with sub-500 ms finality. Treat those as Somnia-reported results, not independent ZORYQ benchmarks.
- **Tempo:** Tempo's public testnet launched 2025-12-09 with deterministic ~0.5 s finality, stablecoin gas, sponsorship/passkeys and payment lanes. Multiple infrastructure partners reported Tempo mainnet live on 2026-03-18. Tempo is a strong reference for stablecoin-native, passkey, sponsored-gas and agentic payment UX.
- **Monad:** maintain as a benchmark for parallel-EVM developer experience and execution. Re-verify current public stage before publishing external comparisons.

Public reference URLs used for periodic verification:

- https://www.megaeth.com/
- https://testnet.megaeth.com/
- https://risechain.com/
- https://somnia.network/
- https://blog.somnia.network/
- https://tempo.xyz/blog/testnet
- https://docs.tempo.xyz/
- https://www.quicknode.com/blog/quicknode-launches-support-for-tempo-mainnet

## Why TPS is not the product

The competitive frontier has moved beyond generic “fast EVM” positioning. ZORYQ should use performance as an enabler for a product category where **social, financial and agentic actions feel real-time and remain inspectable**.

The defensible experience is not “another chain with a higher TPS number.” It is a coherent system where a person, project or AI agent can:

1. establish identity and reputation;
2. discover people, projects and agents;
3. publish / prove contributions;
4. grant an agent narrowly-scoped authority;
5. pay or tip with minimal friction;
6. trade through protected financial surfaces;
7. carry reputation and permissions across applications;
8. verify important actions through proofs / explorer;
9. revoke delegated authority instantly;
10. use the same primitives through simple SDKs.

## Priority execution roadmap

Status vocabulary:

- **VERIFIED:** evidence gate passed in the repository / public network.
- **PARTIAL:** some implementation exists, but the complete production property is not proven.
- **PROTOTYPE:** UX / architecture boundary exists without production enforcement.
- **TARGET:** roadmap item only.

| # | Deliverable | Priority | ZORYQ status | Evidence gate before “live” claim |
|---:|---|---|---|---|
| 1 | Public ZORYQ testnet | P0 | PARTIAL | Public RPC + independent external access + sustained uptime |
| 2 | Public Explorer + RPC + Faucet | P0 | PARTIAL | All three publicly reachable, documented and smoke-tested |
| 3 | Parallel execution | P0 | TARGET | Reproducible implementation + benchmark + correctness tests |
| 4 | Sub-second finality | P0 | TARGET | Public benchmark methodology + independent reproducibility |
| 5 | Permissionless validators | P0 | TARGET | External validator can join from docs without privileged allowlist |
| 6 | Native AA + passkeys | P0 | PROTOTYPE | Audited smart-account path + recovery/session design + browser tests |
| 7 | Gas sponsorship / paymasters | P0 | PROTOTYPE | Enforced policy, quotas, abuse protection and audited contracts |
| 8 | MEV protection | P0 | TARGET | Documented threat model + protected routing/order-flow implementation |
| 9 | AI Agent protocol | P0 | PROTOTYPE | Capability schema + signed permissions + simulation + revocation + receipts |
| 10 | Agent wallets | P1 | PROTOTYPE | Budget/method/time/rate limits enforced on-chain or by audited account policy |
| 11 | Social graph | P1 | PROTOTYPE | Durable follow/community graph + privacy/moderation + portable identity schema |
| 12 | Native DEX | P1 | PARTIAL / ecosystem surface | Audited contracts, liquidity, oracle/slippage safety and public docs |
| 13 | Native PerpDEX | P1 | TARGET / product surface | Audited risk engine, oracle, liquidation and insurance/funding design |
| 14 | Stablecoin / payment layer | P1 | PROTOTYPE | Stable-value transfer path + micropayment policy + predictable fee UX |
| 15 | Ethereum interoperability | P1 | TARGET | Audited canonical bridge/interoperability model + failure-mode docs |
| 16 | Simple SDKs: TS / Rust / Python | P1 | PARTIAL | Versioned packages + examples + CI + typed API stability |
| 17 | Multi-client | P1 | TARGET | Independent client implementation passing conformance tests |
| 18 | Independent audit | P1 | TARGET | Published scope/report + remediations |
| 19 | Bug bounty | P2 | TARGET | Public program + severity / payout / disclosure policy |
| 20 | Reproducible public benchmarks | P2 / evidence gate | TARGET | Open harness + hardware/network specs + raw results + repeatability |

## Product requirements for ZORIQ Social

ZORIQ Social is the consumer-facing expression of the chain thesis and should make advanced crypto primitives feel understandable rather than expose protocol complexity directly.

### Identity & onboarding

- Wallet connection must remain optional for browsing.
- Existing injected EVM wallets are supported where safe.
- Smart-account / passkey onboarding is shown as a clearly labeled **prototype boundary** until audited and live.
- Never request, collect or persist a seed phrase or private key.
- Network switching must be explicit and non-signing.

### People / Projects / Agents

Discovery must distinguish actor type visually and semantically:

- **People:** identity, contribution/reputation, communities, verified proofs.
- **Projects:** registry identity, builder reputation, activity and evidence.
- **Agents:** capabilities, owner/operator, permission model, budgets and execution receipts.

No demo follower count, adoption count or agent action may be represented as live external activity.

### Reputation & Proof Cards

Reputation should be evidence-aware, not a single opaque score. Surfaces should distinguish:

- registry presence;
- builder/project evidence;
- contribution history;
- successful verified actions;
- endorsements/attestations;
- warnings / moderation state;
- demo/local reputation signals.

### Tips / micropayments

The UI may prototype tips and human/agent micropayments, but must show:

- asset;
- amount;
- estimated fee / sponsorship state;
- recipient;
- network;
- final confirmation boundary;
- whether action is demo, simulated or a real transaction.

### Smart account, passkey and sponsorship

The ideal flow is “use the app first, understand blockchain complexity later.” Production requirements include:

- passkey-based authentication;
- recoverability model;
- bounded session keys;
- paymaster / sponsorship policy;
- per-user and per-agent quotas;
- abuse controls;
- explicit fallback to a standard wallet;
- transparent failure states.

Until those requirements are implemented and audited, UI surfaces must say **Prototype / Not active authority**.

### Scoped AI agent permissions

Every delegated action must be inspectable before authorization. Minimum permission envelope:

- agent identity;
- target contract/application;
- method/function allowlist;
- asset allowlist;
- spend / value budget;
- time window / expiry;
- action count / rate limit;
- slippage / price constraints where financial;
- simulation result;
- revocation control;
- receipt/audit trail.

Agents must never inherit blanket wallet authority from a convenience UI.

## Security, anti-spam and Sybil boundaries

Before persistent public social posting, production requires:

- server-side rate limiting and abuse heuristics;
- report, block, mute and moderation workflows;
- content-size and attachment limits;
- input validation / output encoding;
- safe URL and media handling;
- wallet-signature replay protection;
- CSRF protections where sessions exist;
- CSP/security headers;
- no secrets in browser bundles;
- optional reputation-weighted posting limits without creating an irreversible identity trap;
- Sybil friction for economic incentives (proof-of-personhood/reputation/stake should be modular, not mandatory for basic reading);
- privacy-preserving defaults for profile and social graph visibility where appropriate.

## Execution score: what moves ZORYQ from ~86 to 93–95

The largest score gain now comes from **proof of execution**, not feature count. Priority evidence:

1. stable public network access;
2. public faucet + explorer + RPC;
3. external validators;
4. reproducible latency/finality/throughput benchmarks;
5. audited account / agent permission path;
6. polished applications using those primitives;
7. real external builders and users.

A 97+ strategic score should be reserved for demonstrated decentralization, security, stability and adoption. It cannot be reached by adding UI features or roadmap bullets alone.

## Claim policy

Do **not** publish any of the following as facts until their evidence gates pass:

- “1M TPS” or any unverified ZORYQ TPS figure;
- “sub-second finality” as a production property;
- “permissionless validators live”;
- “decentralized production network”;
- “passkeys are live”;
- “gasless is live”;
- “MEV protected”;
- “audited”;
- “production-ready social network.”

Use language such as **target**, **prototype**, **planned**, **under validation**, or **verified** according to the evidence state above.
