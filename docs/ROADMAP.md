# ZORYQ Product & Network Roadmap

**Roadmap model:** milestone-gated. Dates are announced only when capacity and evidence support them. A checked item means implemented and verified in its intended environment; code existence alone is not production readiness.

## North Star
Make ZORYQ the easiest credible path from **idea → onchain product → users → verifiable participation**.

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

## Phase 2 — Builder Testnet Beta
**Goal:** prove that ZORYQ makes creating onchain products easier.

Deliverables:
- Launch Studio v1;
- ERC-20 and ERC-721 reviewed templates;
- project registry/profile;
- quest campaign builder;
- generated integration snippets;
- AI Builder configuration assistant;
- mandatory transaction preview and wallet approval;
- Foundry/Hardhat/viem/ethers quickstarts;
- contract verification workflow;
- builder analytics;
- public template/version registry.

**Exit gate:** a new builder can go from account to deployed demo project without manual contract authoring, while understanding every transaction being signed.

## Phase 3 — Participation & Operator Network
**Goal:** reward technically useful contribution rather than passive farming.

Deliverables:
- epoch-based reward finalization;
- validator/node class with highest reward weight;
- builder/contributor class;
- lower-weight mobile class for eligible staking, swap and quests;
- evidence references for finalized rewards;
- anti-Sybil, rate limits and duplicate-node heuristics;
- operator dashboard and leaderboard;
- transparent reward-policy versioning;
- dispute/review mechanism for exceptional cases.

**Policy:** sustained healthy node contribution should normally receive materially greater score than routine mobile activity. Exact weights can change by published policy version. Score is not a token and carries no guaranteed monetary value.

**Exit gate:** rewards are reproducible from evidence, abuse is measurable, and Wallet/Explorer/operator dashboard agree on finalized state.

## Phase 4 — Smart Wallet & Consumer UX
**Goal:** hide unnecessary blockchain complexity without hiding risk.

Research/deliverables:
- smart-account architecture assessment;
- passkey-based authorization prototype;
- recovery design;
- sponsored-gas/paymaster prototype;
- batched transaction UX;
- human-readable transaction simulation;
- phishing/risk warnings;
- privacy review and independent security assessment.

**Exit gate:** smart-wallet flows meet defined threat-model and recovery tests. No production custody shortcuts.

## Phase 5 — Launch Network Marketplace
**Goal:** turn Launch Studio into a repeatable creator economy.

Deliverables:
- richer project templates;
- staking/vesting modules after audits;
- project discovery;
- project analytics;
- optional premium AI Builder tiers;
- partner integrations;
- transparent platform/service fees where applicable;
- creator/project quality signals;
- SDK and APIs.

**Exit gate:** retained builders and projects demonstrate repeat usage and there is evidence of product demand independent of incentives.

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
- legal/regulatory review;
- load, adversarial and fault testing.

**Exit gate:** published readiness report with unresolved risks. Mainnet does not launch merely because Testnet activity is high.

## Phase 7 — Limited Mainnet (Conditional)
**Goal:** controlled production introduction if Phase 6 gates pass.

Possible scope:
- limited applications/assets;
- conservative limits;
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
- clear distinction between historical Testnet score and any token allocation methodology.

No Testnet points guarantee an allocation or airdrop.

## Operating metrics
ZORYQ tracks quality before vanity volume:
- weekly/monthly retained builders;
- 30/90-day active projects;
- median time to first deployment;
- wallet onboarding completion;
- healthy independent node count and uptime distribution;
- verified vs rejected reward claims;
- unique meaningful transactions excluding faucet loops;
- incidents and mean time to recovery;
- recurring product revenue when monetization begins.

## Near-term execution order
1. stabilize canonical public RPC;
2. publish and browser-verify premium Hub/Docs/Explorer;
3. produce signed/checksummed Android APK artifact;
4. produce checksummed Windows/Linux/Docker node packages;
5. deploy and wire Quest/Reward registries;
6. implement operator enrollment + heartbeat evidence;
7. synchronize Wallet, Explorer and node dashboard;
8. build Launch Studio v1;
9. add AI Builder only with explicit review/approval boundaries;
10. recruit a small cohort of real builders/operators and measure retention.