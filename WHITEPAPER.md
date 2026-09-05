# ZORYQ — Whitepaper v0.2

> **Status:** working technical/product paper for the ZORYQ Testnet. This document is not an offer of securities, a promise of token value, an investment solicitation, or a guarantee of an airdrop.

## 1. Executive summary
ZORYQ is an AI-assisted Web3 launch network designed to make creating, testing and participating in onchain products substantially easier. Instead of competing as another generic EVM network, ZORYQ combines an EVM-compatible execution environment with a mobile wallet, Launch Studio, AI Builder, verifiable participation score, quests and a node/operator program.

**North Star:** make the path from an idea to a usable onchain application understandable to a person who is not a blockchain engineer.

## 2. The problem
Web3 product creation remains fragmented. A creator commonly needs a wallet, RPC, contract tooling, token/NFT contracts, frontend, explorer, indexing, distribution, community incentives and security knowledge before a useful product exists. End users face seed phrases, gas, approvals, network configuration and fragmented identities.

ZORYQ treats this fragmentation as the product problem.

## 3. Product thesis
ZORYQ is a **product-led network**. The chain is infrastructure; adoption must come from useful applications.

The core loop is:
1. **Create** — use Launch Studio / AI Builder to configure an onchain project.
2. **Deploy** — audited templates deploy tokens, NFTs, quests and supported modules.
3. **Distribute** — projects gain a page, wallet integration and participation tools.
4. **Participate** — users use the mobile wallet, complete verifiable quests and build reputation.
5. **Secure & operate** — node operators contribute infrastructure and receive the highest participation weight.
6. **Verify** — important finalized state is queryable on ZORYQ and visible through the Explorer.

## 4. ZORYQ Testnet
- Network: **ZORYQ EVM Testnet**
- Chain ID: **5919065** (`0x5a5159`)
- Native test asset: **ZQ**
- VM: EVM / Solidity compatible
- Purpose: development, integration, experimentation and community testing

Testnet ZQ has no promised financial value.

## 5. Launch Studio
Launch Studio is intended to be the primary demand engine for ZORYQ. A creator should be able to configure a project without assembling an entire Web3 stack manually.

Planned modules include:
- ERC-20 creation;
- ERC-721 collections;
- vesting and distribution templates;
- staking templates;
- quests and campaigns;
- project profile/page;
- analytics and Explorer links;
- supported swap/liquidity integrations;
- generated integration snippets and documentation.

Every template that can control assets must go through explicit security review before production use.

## 6. ZORYQ AI Builder
AI Builder translates natural-language product intent into **reviewable configuration**, never silent irreversible deployment.

Example: a creator can describe a game token, allocation, vesting and quest campaign. AI Builder produces a structured proposal, highlights risks, generates supported templates and requires explicit wallet approval for onchain actions.

AI must not receive seed phrases/private keys and must not bypass transaction review.

## 7. ZORYQ Wallet
The mobile wallet is the primary user access layer. It should provide:
- create/import wallet with secure local key handling;
- send/receive ZQ and supported assets;
- transaction history sourced from chain/indexer;
- tokens and NFTs;
- faucet access on Testnet;
- quests and ZORYQ Score;
- staking/swap interfaces when contracts are deployed and verified;
- Launch Studio access;
- clear Testnet/Mainnet separation.

Future smart-account work may add passkeys, recovery, sponsored gas and batched actions after threat modeling and audit.

## 8. ZORYQ Score — Proof of Participation
ZORYQ Score is a reputation/participation system, not a token balance and not a promise of future monetary reward.

Activities can generate pending points only when evidence is verifiable. Finalized epochs are anchored onchain through reward records/events so the Wallet, Explorer and operator dashboard can reconcile the same finalized state.

Reward classes:
- **Validator / Node Operator** — highest weight;
- **Builder / Contributor** — high weight;
- **Mobile Participant** — lower weight for quests, supported staking and swap activity.

The economic principle is **contribution over clicking**. Sustained, healthy infrastructure should normally earn materially more score than routine mobile activity. Exact weights are versioned, capped and subject to anti-abuse rules.

Points do not guarantee tokens, allocation, cash value or an airdrop.

## 9. Node/operator network
The node program is designed to create a technically useful early community rather than a passive farming campaign.

Operator scoring should consider:
- cryptographically linked operator wallet;
- uptime windows;
- valid chain/network identity;
- heartbeat freshness;
- unique node identity;
- version compliance;
- anti-Sybil / duplicate-host heuristics;
- objective service-health evidence.

A downloadable Windows/Linux/Docker node experience is a product requirement. Private wallet keys must never be required by the node daemon merely to prove operator identity; wallet ownership should be established with signed challenges.

## 10. Quests
Quest definitions are versioned and can be registered onchain. A quest includes identity, description/metadata reference, points, eligibility window and active status.

Quests should prefer objective onchain evidence: first transaction, contract deployment, NFT mint, supported swap, staking interaction, node milestone or builder contribution. Social/offchain quests require stronger anti-fraud controls.

## 11. Security model
ZORYQ follows least privilege and explicit trust boundaries:
- no seed/private key in frontend, repository, telemetry or AI prompts;
- public RPC blocks unsafe administrative namespaces;
- production contracts require tests, review and independent audit before meaningful value is at risk;
- admin capabilities are documented and progressively moved toward multisig/timelock controls;
- rate limits and anti-Sybil protections apply to faucet/rewards;
- Testnet and production credentials remain isolated;
- incident response and release runbooks are maintained.

## 12. Architecture
The intended product architecture is:

```text
ZORYQ Wallet / Web Hub / SDK
          |
   Launch Studio + AI Builder
          |
Quests / Score / Project Registry
          |
      ZORYQ EVM Chain
          |
 RPC / Indexer / Explorer
          |
 Node & Operator Network
```

Offchain services may improve indexing, anti-abuse and UX, but finalized reward state and asset ownership must remain independently reconcilable against onchain records wherever the protocol claims onchain verifiability.

## 13. Developer experience
ZORYQ should support familiar EVM workflows: Solidity, ethers, viem, Foundry, Hardhat and Remix. Documentation must include network configuration, RPC reference, contract examples, event/log retrieval, receipts, deployment, token/NFT examples, security guidance and troubleshooting.

## 14. Sustainable economics
Before any native-token economic launch, ZORYQ can pursue product revenue through transparent service fees and optional products, such as:
- Launch Studio premium templates/services;
- AI Builder usage tiers;
- project analytics;
- hosted developer/RPC services;
- supported marketplace or swap integration fees where legally and technically appropriate;
- partner/integration revenue.

Revenue must be separated from Testnet points. Testnet score is not revenue share.

## 15. Token policy
No token launch should precede product validation. A future token, if any, requires a separate tokenomics design, legal/regulatory review, security audit, distribution analysis, treasury controls, unlock schedule and public risk disclosures.

## 16. Governance
Early Testnet governance is intentionally operationally centralized so a small team can ship and respond to incidents. Administrative powers must be documented. Decentralization is a staged engineering objective, not a marketing claim.

## 17. Adoption strategy
ZORYQ will prioritize a narrow wedge:
1. make Testnet onboarding unusually easy;
2. attract operators and builders with verifiable contribution programs;
3. let early creators launch useful demo projects through Launch Studio;
4. turn successful templates into reusable products;
5. publish metrics: active builders, deployed projects, retained wallets, healthy nodes and meaningful transactions;
6. expand only after evidence of retention.

Vanity transaction counts and faucet farming are not primary success metrics.

## 18. Success metrics
Core metrics:
- weekly retained builders;
- projects deployed and still active after 30/90 days;
- successful wallet onboarding rate;
- time from project creation to first deployment;
- healthy independent nodes;
- percentage of rewards backed by verifiable evidence;
- contract/security incident rate;
- recurring product revenue when monetization begins.

## 19. Roadmap principle
ZORYQ ships by **gates**, not hype dates. A phase advances only when its security, reliability and product criteria are met. See `docs/ROADMAP.md`.

## 20. Vision
ZORYQ aims to become the easiest credible path from **idea → onchain product → users → verifiable participation**. The network succeeds only if people build and repeatedly use products that are easier to create because ZORYQ exists.