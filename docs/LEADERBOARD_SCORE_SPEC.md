# ZORYQ Testnet Leaderboard & Score Specification

Status: Product/Protocol specification for Testnet. XP/Score is participation and reputation, not a token, security, investment product, guaranteed airdrop, or promise of financial return.

## 1. Objective
The ZORYQ Leaderboard is the public reputation layer of the Testnet. It must make useful participation visible, comparable and verifiable without reducing the system to a simple click-farming table.

The same finalized score must be visible in:
- ZORYQ Wallet APK;
- ZORYQ Hub;
- ZORYQ Explorer;
- Node Operator dashboard;
- public wallet profile.

## 2. Ranking dimensions
Every wallet profile may expose:
- Global Rank;
- ZORYQ Score / XP total;
- Validator Score;
- Builder Score;
- Quest Score;
- Stake Score;
- Swap Score;
- Contributor Score;
- current level;
- badges;
- active streaks when applicable;
- current epoch score;
- all-time score;
- last finalized epoch;
- anti-sybil / eligibility status where public disclosure is appropriate.

## 3. Ranking philosophy
Infrastructure and useful contribution outweigh low-effort activity.

Indicative relative weighting:
- Validator / node operation: highest weight;
- deployed useful project / builder activity: highest weight;
- verified code/documentation contribution: high weight;
- staking participation: medium weight;
- meaningful swap usage: low-to-medium weight;
- quests: low-to-medium weight;
- faucet/check-in: minimal weight.

Validator rewards should normally be at least an order of magnitude above common mobile actions when uptime and health requirements are met.

## 4. Finalized vs pending points
Pending points may be calculated off-chain for UX, but must be visibly labeled `Pending`.

Finalized points are published per epoch to the chain through the ZORYQ reward/score registry and become the authoritative source for the official ranking.

The UI must never merge pending and finalized values without showing the distinction.

## 5. Public wallet profile
Example fields:

Global Rank: #18
Wallet: 0x12ab...89ef
Level: Pioneer III
Finalized Score: 18,450 XP
Pending: 820 XP
Validator: 12,000
Builder: 3,000
Quests: 1,850
Stake: 900
Swap: 700
Badges: Genesis Node, Early Builder, 7-Day Uptime

Profiles should link to relevant chain transactions/events and operator/project pages when available.

## 6. Leaderboard views
Required views:
- Global;
- Validators;
- Builders;
- Mobile / Quest participants;
- current epoch;
- all-time;
- weekly/monthly trend when enough data exists.

Optional filters:
- wallet search;
- level;
- badge;
- category;
- epoch;
- verified node status.

## 7. Levels
Initial non-financial reputation levels:
- Explorer;
- Pioneer;
- Builder;
- Operator;
- Architect;
- Vanguard.

Sub-levels (I, II, III) can be used to improve progression. Thresholds must be versioned and publicly documented.

## 8. Badges
Badges should represent meaningful accomplishments, e.g.:
- Genesis Participant;
- First Transaction;
- First Smart Contract;
- First Token Deployment;
- First NFT Deployment;
- Early Builder;
- Node Operator;
- 24h Node Uptime;
- 7-Day Node Uptime;
- 30-Day Node Uptime;
- Quest Pioneer;
- Security Contributor.

Badges may later be anchored/minted on-chain where useful.

## 9. Anti-abuse
The ranking engine must resist:
- sybil wallet farms;
- faucet loops;
- wash swaps;
- self-transfer farming;
- repeated trivial contract deployments;
- fake node heartbeats;
- scripted quest repetition;
- circular staking patterns.

Measures may include cooldowns, diminishing returns, unique-action checks, time-weighted node health, minimum economic/technical thresholds, graph-based heuristics, manual review for top ranks, and epoch-level exclusions.

## 10. Transparency
The public dashboard should disclose:
- score categories;
- current weights/rules;
- epoch identifier;
- last finalized block;
- last ranking update;
- whether a value is pending or finalized;
- material scoring-rule changes.

Historical epochs must remain queryable.

## 11. Privacy
Wallet addresses are public by nature, but no real-world identity should be required for the public leaderboard. Optional profile aliases must not expose private account information.

## 12. Product quality requirements
The leaderboard must feel like a first-class blockchain product:
- fast loading;
- responsive mobile/desktop design;
- clear top-3 visual hierarchy without casino-style design;
- wallet search;
- live network/epoch indicators;
- category tabs;
- profile drill-down;
- Explorer deep links;
- stable shareable wallet/profile URLs;
- accessible number formatting;
- empty/loading/error states;
- no fake data in production UI.

## 13. Source of truth
Finalized on-chain reward events and registries are authoritative. Indexers/APIs are read-optimized mirrors only and must be reconstructible from chain data plus published scoring metadata where applicable.

## 14. Future token separation
Leaderboard rank and XP do not guarantee token allocation, token amount, future price, investment return or airdrop. If a future token distribution uses Score as one input, the final methodology must be separately approved and published.
