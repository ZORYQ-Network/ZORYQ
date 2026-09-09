# ZORIQ Social — Product Strategy

Status: active product direction. This document describes product goals and planned capabilities. It does not imply that unimplemented features are live.

## Product goal

Build a social dApp that is enjoyable for normal users even if they do not care about crypto, while using ZORYQ underneath to make identity, reputation, payments, project history and agent actions verifiable when that matters.

ZORIQ should not be an X or Instagram clone with a wallet attached. Its core advantage should be that a user can discover a person, project or AI agent and immediately understand what they have actually built, contributed, earned, paid for or executed.

## The user problem

Today social identity, reputation, money, creator monetization, project history and AI agents live in separate products. Followers and likes are easy to fake, contributions are hard to verify, creators depend on platform-controlled monetization, and autonomous agents have no simple trust layer.

ZORIQ combines these into one user experience:

People + Projects + Agents + Communities + Proof + Payments.

## The simple promise

**Use social normally. Own your identity. Prove what matters. Get paid directly. Let agents help without giving them unlimited power.**

## Core product loops

### 1. Discover -> Trust -> Follow
Discovery is organized around People, Projects and Agents. Profiles show social content plus optional verifiable Proof Cards, project activity and reputation.

### 2. Create -> Engage -> Earn
Users publish text, media, project updates or Proof Cards. Creators can receive tips, memberships and paid-community revenue without making every social action an onchain transaction.

### 3. Build -> Prove -> Reputation
Builders connect deployed contracts, project registry entries, receipts and other evidence. Verified contributions become portable reputation rather than just engagement counters.

### 4. Ask agent -> Scope -> Simulate -> Approve -> Execute -> Prove
AI agents can help with onchain and social tasks, but permissions must be bounded by contract, method, value, time, rate and budget. High-impact actions preserve explicit authorization and evidence.

## What should make ZORIQ more desirable than a normal social network

1. **Proof Cards** — compact, shareable evidence that a meaningful action really happened.
2. **People / Projects / Agents** — discovery is not limited to individual accounts.
3. **Portable reputation** — useful history can survive beyond one feed or account.
4. **Direct economic layer** — tipping, memberships, paid communities and micropayments are native product concepts.
5. **Agent-native UX** — users can discover and use AI agents with inspectable permissions.
6. **Community ownership** — communities can have roles, reputation and optional treasury without forcing every user into DAO complexity.
7. **Less crypto friction** — passkeys/smart accounts and sponsorship are the target onboarding model; users should not need to understand gas to enjoy the product.
8. **Evidence over vanity metrics** — likes and followers remain useful, but verified contribution is a separate signal and should never be conflated with popularity.

## Feed principles

The feed should optimize for user value rather than raw engagement. Ranking inputs may include explicit follows, recency, topic affinity, conversation quality, hide/mute signals, diversity, verified contribution context and user-controlled preferences.

Do not make blockchain activity a hidden ranking privilege. Proof is an additional trust signal, not a pay-to-win distribution mechanic.

Users should have at least three understandable modes:
- For You
- Following
- Discover

A future advanced mode can expose ranking controls instead of forcing one opaque algorithm on everyone.

## Media and interaction direction

The product should support a richer media experience than the current prototype: image/video posts, full-screen media viewer, fast gestures on mobile, drafts, bookmarks, quote/repost, threaded replies, notifications, DMs or private conversations after a privacy design is completed, and frictionless sharing outside ZORIQ.

All interactions need optimistic UI, polished loading states, undo where safe, clear network/offline states, accessibility and excellent mobile responsiveness.

## Identity and onboarding

Target experience:
1. Sign in with passkey or familiar account flow.
2. A smart account is created or connected behind the scenes.
3. The user chooses handle/profile.
4. Optional external identities and wallet addresses can be linked.
5. First-use gas can be sponsored within abuse-resistant limits.

Until this stack is implemented and verified, the product must label passkey/paymaster experiences as prototypes rather than live capabilities.

## Storage architecture

Do not put the entire social graph and media stream directly on the L1.

Recommended split:
- L1: economically/security-relevant commitments, project identity, high-value permissions, selected reputation attestations, payment settlement and proof anchors.
- Offchain/indexed social layer: posts, replies, follows, reactions, notifications, feed indexes and moderation state.
- Object/media storage: images and video, with content hashes where useful.
- User export/portability: structured profile/social export plus verifiable anchors.

This keeps normal social UX fast and inexpensive while preserving verifiability for actions that matter.

## Safety, moderation and anti-spam

Required before open growth:
- report, mute and block
- rate limiting
- abuse and spam scoring
- account/reputation age signals
- community moderation roles
- transparent enforcement states
- appeal path for high-impact moderation actions
- scam/phishing warnings around wallet and agent actions
- no private keys or seed phrases requested or stored
- explicit wallet confirmation for state-changing actions unless a previously authorized bounded session policy applies

Sybil resistance should use layered signals rather than one identity gate: account history, proof/reputation, optional external attestations, economic friction only where appropriate, community trust and behavior analysis.

## Monetization

Avoid an ad-first business model. Preferred revenue surfaces:
- creator memberships
- paid communities
- tips/micropayments
- premium project profiles and analytics
- agent marketplace/service fees
- advanced creator/community tooling
- optional protocol/service fees on economic actions where clearly disclosed

## Product metrics

Do not optimize only for wallet connections.

Primary metrics:
- day-1 / day-7 / day-30 retention
- meaningful sessions per user
- reply/conversation rate
- creator earnings and number of earning creators
- successful first social action without crypto friction
- Proof Card creation/view-to-action rate
- project/agent discovery to follow/use conversion
- successful bounded agent executions
- report/block rates and spam prevalence
- median mobile interaction latency

## MVP execution order

P0 — Make the product enjoyable:
- polished mobile-first feed
- profile/follow/post/reply
- image/media posting
- notifications
- People / Projects / Agents discovery
- search
- bookmarks
- basic moderation
- fast optimistic interactions

P1 — Make it uniquely ZORIQ:
- Proof Cards
- project profiles connected to Project Registry
- Builder Reputation surfaces
- tips and micropayments
- communities
- agent profiles and scoped-permission UX

P2 — Remove Web3 friction:
- smart accounts/passkeys
- bounded paymaster/gas sponsorship
- recovery/session keys
- seamless wallet linking

P3 — Build network effects:
- creator memberships
- paid communities
- agent marketplace
- portable social/reputation export
- recommendation quality controls
- developer APIs and SDK

## Non-negotiable product rule

A normal user should be able to love ZORIQ without understanding blockchain. A technical user should be able to verify the important parts underneath.