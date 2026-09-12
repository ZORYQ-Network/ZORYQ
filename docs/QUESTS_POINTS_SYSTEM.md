# ZORYQ Quests + Points System

## Goal
Allow ZORYQ admins to create, activate, pause and retire quests without releasing a new APK. The mobile wallet downloads active quest definitions from the ZORYQ quest API and shows them in the Points/Quests area.

## Quest lifecycle
- draft
- scheduled
- active
- paused
- ended
- archived

## Quest fields
- id
- title
- shortDescription
- fullDescription
- category
- icon
- startAt
- endAt
- points
- maxCompletionsPerWallet
- globalCompletionCap (optional)
- cooldownSeconds (optional)
- verificationType
- verificationConfig
- requiresWalletSignature
- requiresOnChainProof
- status
- campaignId
- sortOrder
- createdAt
- updatedAt

## Supported verification types
1. onchain_tx
   - Verify a transaction on ZORYQ Testnet.
   - Conditions may include contract, method selector, value, token/NFT address or emitted event.
2. token_hold
   - Hold a minimum ERC-20 balance for a configured token.
3. nft_hold
   - Hold an ERC-721 from a configured collection.
4. faucet_claim
   - Successful ZQ faucet usage.
5. contract_interaction
   - Call a selected contract/method and receive a successful receipt.
6. wallet_activity
   - On-chain transaction count/volume/action thresholds.
7. daily_checkin
   - Signed wallet check-in; backend enforces one completion per configured period.
8. referral
   - Referral relationship with anti-sybil checks.
9. external_proof
   - External or social task validated by trusted backend/admin. Never trust client-only completion.
10. manual_review
   - Admin approves completion.

## Official X growth quests
The official X identity used by ZORIQ quests is **@ZORIQNetwork**.

### `x_follow_zoriq` — Follow ZORIQ on X
- Display reward: **+100 XP**.
- Verification type: `external_proof`.
- User opens the official follow intent and submits their X username while authenticated with the ZORIQ wallet/SIWE session.
- Submission state starts as `pending_review`.
- Clicking the link, checking a local box or merely claiming that the account was followed must never award XP.
- Final approval requires trusted X verification (OAuth/API) or an authorized review process.

### `x_post_mention_zoriq` — Publish a post tagging ZORIQ
- Display reward: **+250 XP**.
- Verification type: `external_proof`.
- The post must be public and tag **@ZORIQNetwork**.
- User submits a canonical `x.com/<user>/status/<id>` (or legacy `twitter.com`) URL while authenticated with the ZORIQ wallet/SIWE session.
- Submission state starts as `pending_review`.
- The client cannot set approval, reward amount, awarded state or reward transaction hash.
- Final approval requires trusted X verification (OAuth/API) or an authorized review process that confirms ownership and the required mention.

The current database queue is `public.x_quest_submissions`. Reward values are backend-authoritative (100/250), each user has at most one record per X quest, and the authenticated client receives read-only access to its own status plus the hardened `submit_x_quest_proof(...)` RPC. Approval/finalization remains privileged.

## Points model
- Quest completion creates PENDING points first.
- Pending points are not transferable tokens and have no guaranteed monetary value.
- Fraud/duplicate/sybil checks occur before finalization.
- At epoch close, eligible totals are committed on-chain.
- Recommended design: Merkle root per epoch + ZoryqPointsClaim smart contract.
- Each successful on-chain claim emits indexed events for the Explorer.

The UI may label campaign rewards as **XP**. XP shown on a quest is a target reward; it is not considered finalized score until the trusted verification/finalization path succeeds.

## Admin capabilities
The admin panel must allow:
- Create new quest
- Duplicate an existing quest
- Edit points before activation
- Schedule start/end
- Pause/resume
- Set wallet and global limits
- Choose verification mechanism
- Link contract/token/NFT addresses
- Review completions and suspicious activity
- Revoke unfinalized fraudulent completions
- Close an epoch
- Publish epoch root
- Monitor completion rate and points issued

## Mobile APK behavior
The APK must fetch quests dynamically and display:
- Active quests
- Upcoming quests
- Completed quests
- Claimable rewards
- Pending points
- On-chain finalized points/claims
- Quest progress where supported

The APK must never decide by itself that a high-value quest is completed. Completion must be proven by chain data or validated by the trusted quest backend.

## Chain / Explorer visibility
The Explorer should eventually expose:
- Quest campaign/epoch metadata hash or registry reference
- Finalized reward epoch
- Wallet claim status
- Claim transaction
- Points claimed
- Claim event logs

Quest descriptive copy can remain off-chain and be versioned by content hash. Finalized reward state must be verifiable on ZORYQ.

## Anti-abuse baseline
- Wallet signature challenge with nonce
- Server-side verification
- Per-wallet limits
- Per-device/IP heuristics as secondary signals only
- No seed/private-key collection
- Replay protection
- Idempotent completion records
- Rate limiting
- Duplicate transaction/event prevention
- Manual review for suspicious campaigns

## Example quests
- First ZORYQ transaction: +100 points
- Claim Testnet ZQ faucet: +50 points
- Deploy first contract: +500 points
- Create an ERC-20: +750 points
- Mint an NFT: +500 points
- Use ZORYQ Swap: +250 points
- 7-day check-in streak: +700 points
- Hold a campaign NFT: +300 points
- Follow @ZORIQNetwork on X: +100 XP, external proof
- Publish on X tagging @ZORIQNetwork: +250 XP, external proof

All point values are configurable by admins and must be versioned/auditable.
