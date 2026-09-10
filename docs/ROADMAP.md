# ZORYQ Product & Network Roadmap

**Roadmap model:** milestone-gated. Dates are announced only when capacity and evidence support them. A checked item means implemented and verified in its intended environment; code existence alone is not production readiness.

## North Star
Make ZORYQ the easiest credible path from **idea → autonomous organization → on-chain work → users → verifiable economic activity**.

## Strategic differentiator — Autonomous Economy Layer

ZORYQ's primary differentiator is the **ZORYQ Autonomous Economy Protocol**: infrastructure where humans, AI agents and autonomous organizations can coordinate with bounded authority, budgets, escrow, payments, reputation and an auditable on-chain history.

This sits above individual products such as Swap, Social and Launch Studio. Those products should progressively become services that autonomous organizations and agents can discover and use under explicit policy controls.

### Autonomous Economy v0.1 — Current Testnet objective
- Proof of Agent identity anchored to a ZORYQ wallet;
- agent capabilities metadata and economic reputation counters;
- Autonomous Organizations with native ZQ treasury;
- CEO, Finance, Marketing, Developer, Worker and Auditor role flags;
- per-transaction and rolling 30-day agent spending limits;
- organization-wide rolling budget limits;
- organization task creation and escrow;
- bids from registered agents;
- assignment, delivery hash and atomic settlement;
- direct Agent-to-Agent escrow/payment;
- indexed on-chain audit events;
- public testnet demo and explorer-verifiable proof.

**v0.1 exit gate:** a user can connect an ordinary EVM wallet to ZORYQ Testnet, register an agent, create/fund an organization or direct task, complete a task lifecycle and verify the resulting state/transactions in the ZORYQ Explorer.

### Autonomous Economy next gates
1. smart-agent accounts with scoped session keys, expirations and revocation;
2. service-delivery verification and challenge windows;
3. capability/service discovery marketplace;
4. machine-payable API adapter (including x402-style commerce where appropriate);
5. cross-chain intents with ZORYQ policy/audit as the control plane;
6. autonomous-organization templates and SDK;
7. independent contract/security audits before production-value use.

## Phase 0 — Foundation / Current Testnet Core
**Goal:** establish a reproducible EVM Testnet and a coherent product identity.

Deliverables:
- ZORYQ EVM Testnet, Chain ID 5919065;
- native test asset ZQ;
- protected public JSON-RPC gateway;
- health/network/faucet services;
- CI tests for native transfers, Solidity, ERC-20 and ERC-721;
- Hub, Explorer and developer documentation;
- mobile-wallet foundation;
- Quest Registry and Reward Registry contract foundations;
- security, incident and release documentation.

**Exit gate:** public node is reproducibly deployable, canonical RPC is stable, Hub/Explorer use the same network configuration, and critical CI is green.

## Phase 1 — Public Testnet Alpha
**Goal:** make joining ZORYQ useful and friction-light.

Deliverables:
- canonical public RPC with monitoring;
- Faucet with abuse controls;
- Explorer for blocks, transactions, addresses, contracts and reward events;
- Android ZORYQ Wallet APK;
- secure wallet create/import/send/receive flow;
- chain-sourced balances/history;
- quests screen synchronized with registered quests;
- ZORYQ Score pending/finalized distinction;
- downloadable node packages for Windows x64, Linux x64 and Docker;
- operator-wallet signed challenge enrollment;
- node health/heartbeat telemetry without operator private-key custody;
- reproducible builds and checksums.

**Exit gate:** independent users can install Wallet and node, transact, complete a verifiable quest and reconcile finalized score in Explorer.

## Phase 2 — Builder + Autonomous Economy Testnet Beta
**Goal:** prove that ZORYQ makes creating on-chain products and autonomous economic workflows easier.

Deliverables:
- Launch Studio v1;
- ZORYQ Autonomous Economy Protocol iteration;
- Agent/Organization developer SDK and examples;
- ERC-20 and ERC-721 reviewed templates;
- project registry/profile;
- quest campaign builder;
- generated integration snippets;
- AI Builder configuration assistant;
- mandatory transaction preview and wallet approval;
- Foundry/Hardhat/viem/ethers quickstarts;
- contract verification workflow;
- builder and agent analytics;
- public template/version registry.

**Exit gate:** a new builder can go from account to deployed demo project or autonomous organization without manual contract authoring, while understanding every transaction being signed.

## Phase 3 — Participation, Agents & Operator Network
**Goal:** reward technically useful contribution and measurable service quality rather than passive farming.

Deliverables:
- epoch-based reward finalization;
- validator/node class with highest reward weight;
- builder/contributor class;
- agent service/reputation evidence;
- lower-weight mobile class for eligible staking, swap and quests;
- evidence references for finalized rewards;
- anti-Sybil, rate limits and duplicate-node heuristics;
- operator dashboard and leaderboard;
- transparent reward-policy versioning;
- dispute/review mechanism for exceptional cases.

**Policy:** sustained healthy node contribution should normally receive materially greater score than routine mobile activity. Agent reputation must be based on verifiable work evidence rather than self-declared claims. Exact weights can change by published policy version. Score is not a token and carries no guaranteed monetary value.

**Exit gate:** rewards/reputation are reproducible from evidence, abuse is measurable, and Wallet/Explorer/operator dashboard agree on finalized state.

## Phase 4 — Smart Wallet & Smart Agent Accounts
**Goal:** hide unnecessary blockchain complexity without hiding risk, while allowing bounded autonomous execution.

Research/deliverables:
- smart-account architecture assessment;
- passkey-based authorization prototype;
- scoped agent/session keys;
- policy modules for method/value/time limits;
- immediate revocation and kill switch;
- recovery design;
- sponsored-gas/paymaster prototype;
- batched transaction UX;
- human-readable transaction simulation;
- phishing/risk warnings;
- privacy review and independent security assessment.

**Exit gate:** smart-wallet and agent-account flows meet defined threat-model, revocation and recovery tests. No production custody shortcuts.

## Phase 5 — Autonomous Service Marketplace
**Goal:** turn Launch Studio and ZORYQ services into a repeatable creator/agent economy.

Deliverables:
- agent capability/service discovery;
- task pricing and availability metadata;
- richer project templates;
- verified delivery/adjudication modules;
- machine-to-machine payment adapters;
- staking/vesting modules only after audits;
- project discovery;
- project/agent analytics;
- optional premium AI Builder tiers;
- partner integrations;
- transparent platform/service fees where applicable;
- creator/project/agent quality signals;
- SDK and APIs.

**Exit gate:** retained builders, autonomous organizations and service agents demonstrate repeat usage, successful settlement and product demand independent of incentives.

## Phase 6 — Decentralization & Mainnet Readiness Research
**Goal:** determine whether ZORYQ has earned the right to operate a production network.

Required work:
- consensus/validator architecture decision record;
- independent client/network security review;
- economic security model;
- state/data persistence and upgrade strategy;
- validator admission/decentralization plan;
- RPC/indexer redundancy;
- disaster recovery drills;
- multisig/timelock administrative controls;
- external contract/protocol audits;
- autonomous-agent key/policy security review;
- legal/regulatory review;
- load, adversarial and fault testing.

**Exit gate:** published readiness report with unresolved risks. Mainnet does not launch merely because Testnet activity is high.

## Phase 7 — Limited Mainnet (Conditional)
**Goal:** controlled production introduction if Phase 6 gates pass.

Possible scope:
- limited applications/assets;
- conservative limits for autonomous execution;
- continuous monitoring;
- bug bounty;
- incident-response on-call process;
- transparent network/admin status;
- staged increase of limits only after reliability evidence.

## Phase 8 — Token / Governance Evaluation (Optional, Separate Decision)
A production token is **not implied by this roadmap**.

Before any token launch:
- demonstrated product demand;
- independent tokenomics review;
- legal/regulatory analysis;
- audited contracts;
- distribution and Sybil analysis;
- treasury/multisig controls;
- vesting/unlock disclosure;
- governance threat model;
- clear distinction between historical Testnet score/reputation and any token allocation methodology.

No Testnet points guarantee an allocation or airdrop.

## Operating metrics
ZORYQ tracks quality before vanity volume:
- weekly/monthly retained builders;
- active registered agents and organizations;
- successfully settled autonomous tasks;
- agent-to-agent economic volume excluding test loops;
- policy-blocked unauthorized/over-budget attempts;
- dispute/failure rate once adjudication exists;
- 30/90-day active projects;
- median time to first deployment;
- wallet onboarding completion;
- healthy independent node count and uptime distribution;
- verified vs rejected reward claims;
- unique meaningful transactions excluding faucet loops;
- incidents and mean time to recovery;
- recurring product revenue when monetization begins.

## Near-term execution order
1. ship and verify Autonomous Economy Protocol v0.1 on the public ZORYQ Testnet;
2. publish a browser demo that creates/verifies Agent IDs, organizations, budgets, tasks and settlements;
3. expose explorer-verifiable live proof and developer instructions;
4. stabilize canonical public RPC and persistence under real usage;
5. publish and browser-verify premium Hub/Docs/Explorer;
6. produce signed/checksummed Android APK artifact;
7. produce checksummed Windows/Linux/Docker node packages;
8. deploy/wire remaining Quest/Reward registries;
9. implement operator enrollment + heartbeat evidence;
10. recruit a small cohort of real builders/operators/agent developers and measure repeat usage.
