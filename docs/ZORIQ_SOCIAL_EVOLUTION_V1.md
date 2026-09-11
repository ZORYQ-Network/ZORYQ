# ZORIQ Social Evolution v1

## Product thesis

**Your social world evolves with you.**

ZORIQ Social is the consumer social surface of the ZORYQ ecosystem. The experience is designed for web and APK while preserving the existing self-custody ZORYQ wallet/testnet functionality.

## Social product implemented

### Evolving Profile
- XP and level progression.
- Streak, reputation, achievements, followers and following display.
- Visual progress to the next level.
- Shared visual language between web and APK.

### ZORIQ XP
- Participation-oriented XP.
- Raw likes do not automatically award XP.
- Publishing, collaboration, joining Worlds, Pulse participation and live-post actions can award limited XP in the local prototype.
- Repetitive/rapid activity contributes to a local Human First heuristic.

### ZORIQ Powers
- Electric, Inferno, Frost, Galaxy, Toxic, Portal, Crystal, Glitch, Prism and Void.
- XP gates for advanced Powers.
- Users can activate unlocked Powers as part of profile identity.

### ZORI
- Local social companion available on web and APK.
- Can summarize local state, explain ZORIQ DNA, suggest Worlds and describe Pulse activity.
- v1 does not send messages to an external AI provider. Production AI requires explicit privacy/consent and a backend gateway.

### User-controlled feed
Modes implemented:
- Explore
- Fun
- Learn
- Trends
- Meet people
- Technology
- Gaming
- Crypto
- Following

Feed-mode choices also adjust the local ZORIQ DNA demonstration.

### ZORIQ Pulse
- Live-room style discovery surface.
- Topic cards and participation actions.
- Demonstration counts are local; production presence is backed by shared realtime infrastructure.

### Living posts
- Challenges with progress.
- Polls with interactive voting.
- Goals/support interactions.
- Collaborative posts with user contributions.
- Comments and save/bookmark UI in the advanced suite.

### Reputation Graph
- Reputation UI built around authenticity, originality, community, history and conversation signals.
- Designed explicitly to avoid follower count being the sole measure of social value.

### Human First
- Local heuristic detects unusually rapid actions and repeated text.
- This is a UX prototype, not identity proof and not a production moderation classifier.
- Production enforcement must combine server signals, transparent policies, rate limits, review/appeal paths and privacy safeguards.

### ZORIQ Worlds
- Community discovery and join/leave behavior.
- Initial worlds: Crypto, Technology, Gaming, Music, Builders and Football.
- Product model supports World-specific feeds, Pulse rooms, chat, missions and rankings.

### ZORIQ DNA
- Visual identity derived from user-controlled interest weights.
- Changes locally as the user changes feed intent.
- Production should keep recommendation signals visible, configurable and privacy-aware.

## Advanced Social Suite

Web and APK also implement the broader social application surface:

- Discovery and people search.
- Follow / unfollow experience.
- User-profile preview.
- Suggested people and topics.
- Inbox / direct-message UX.
- Notification center and unread counts.
- Edit profile.
- Private account controls.
- Discoverability control.
- Reputation visibility preference.
- Mentions and tagging preferences.
- Hide engagement counts.
- Reduced-motion preference.
- Blocking.
- Achievements.
- Saved posts/bookmarks.
- Comment UI.
- Local "not interested" / mute / report affordances.

The client remains usable offline/local even when the shared social backend is unavailable.

## Shared Supabase backend

The existing social/crypto Supabase project is used rather than creating a parallel database.

The mobile adapter `zoryq-mobile/socialBackend.ts` provides one access layer for:

- public discovery;
- visible feed;
- profile update;
- posts;
- follow requests;
- comments, likes, bookmarks, reposts and reactions;
- blocks and mutes;
- content hide / not-interested signals;
- content reports;
- conversations and messages;
- notifications;
- Realtime subscriptions.

Only a Supabase **publishable key** is present in the client. Service-role/secret keys are prohibited by CI.

Detailed backend/RLS architecture is in `docs/ZORIQ_SOCIAL_BACKEND.md`.

## Social database security

Applied migrations are versioned under `database/migrations/` and include:

- profile evolution/privacy fields;
- private follow requests;
- user mutes;
- RLS fixes for social reads;
- visibility-aware posts/comments/likes;
- hardened SECURITY DEFINER RPCs;
- DM block/privacy checks;
- Realtime publication additions;
- profile-value constraints;
- content reports;
- per-user post hides/not-interested signals.

Authenticated interaction RPCs verify post visibility and blocks before performing writes. Anonymous users do not receive EXECUTE permission on hardened social RPCs.

## Wallet creation and Recovery

The APK exposes **Wallet / Recovery** as a primary product surface rather than hiding wallet onboarding behind social UX.

### Create a new wallet
- Uses `Wallet.createRandom()` from ethers.
- Generates a standard BIP-39 recovery phrase and EVM private key locally on the device.
- Private key and mnemonic are stored with Expo SecureStore.
- The seed phrase is never sent to the ZORYQ backend.
- Possession of the recovery phrase grants control of the wallet.

### Import / recover an existing EVM wallet
- Uses `Wallet.fromPhrase()` after normalizing the recovery phrase.
- Compatible with standard EVM wallets when the imported account uses the default Ethereum derivation path `m/44'/60'/0'/0/0`.
- Intended for common EVM wallets such as MetaMask, Rabby and similar wallets using that derivation.
- A valid imported phrase restores the same first EVM account/address for that path.
- Invalid phrases are rejected locally.

## Biometric security

The APK includes a dedicated **ZORIQ Security** surface using `expo-local-authentication`.

### App unlock
- Supports secure fingerprint and secure facial recognition where provided by the device.
- Can require biometric authentication when the app opens and when it returns from the background.
- Device credential fallback is allowed through the OS prompt when supported.
- The user can enable or disable app-lock biometrics.

### Transaction confirmation
- Can require biometric confirmation before every wallet signer `sendTransaction`.
- Covers ZQ transfers, stake, unstake, swaps and token approvals in the current wallet implementation.
- If a swap needs both an ERC-20 approval and a swap transaction, each signature can require its own confirmation.
- Cancelling/failing authentication prevents the signer from broadcasting the transaction.
- Biometrics authorize local use of the private key; they never replace the private key or seed phrase.

## Web implementation

- `zoryq-web/zoriq-social-v2.html`
- `zoryq-web/zoriq-social-v2.css`
- `zoryq-web/zoriq-social-v2.js`
- `zoryq-web/zoriq-social-suite.css`
- `zoryq-web/zoriq-social-suite.js`
- `/zoriq`, `/social` and `/zoriq-social` route to the v2 page on this branch.
- Local demo persistence remains available through `localStorage`.

The previous prototype remains as `zoryq-web/zoriq-social.html` for reference/rollback.

## APK implementation

- `zoryq-mobile/Social.tsx` contains the core native social experience.
- `zoryq-mobile/SocialSuite.tsx` adds discovery, messages, alerts, privacy and achievements.
- `zoryq-mobile/socialBackend.ts` is the shared backend adapter.
- `zoryq-mobile/index.js` is the root shell, backend health check and biometric security gate.
- The APK opens with **ZORIQ Social** and includes top-level access to **Wallet / Recovery** and **ZORIQ Security**.
- Existing `zoryq-mobile/App.tsx` remains the signing, wallet creation, recovery, faucet, transfer, stake and swap surface.

## Wallet identity / social authentication direction

Supabase Auth supports EIP-4361 Sign-In With Ethereum and the project already contains wallet-link/challenge tables. This is the intended identity path because the APK already has a self-custody EVM wallet.

The UI must **not** claim wallet-based Supabase login is live until the Web3 Auth provider and allowed redirect/domain configuration are confirmed and tested. Until then:

- public social reads can use the publishable key under RLS;
- authenticated writes require a valid existing Supabase session;
- otherwise the app remains in offline/local mode;
- service-role keys must never be embedded to bypass Auth/RLS.

## Security rules

- Never ask for a seed phrase on a website, chat, support channel or backend form.
- Never transmit the phrase to analytics, crash reporting, the social backend or an AI service.
- Keep transaction signing local to the device.
- Recovery/import must display a phishing warning before phrase entry.
- Plaintext cloud backup of a recovery phrase is not the preferred production backup design; encrypted/platform-secured recovery should replace it before production release.

## Remaining production work

1. Confirm/enable and test EIP-4361 Web3 Auth end-to-end.
2. Bind all advanced suite UI actions to `socialBackend.ts` after Auth while preserving offline fallback.
3. Add media storage/CDN, malware scanning and moderation pipeline.
4. Add push notifications and device-token lifecycle.
5. Add moderator/admin report-review tooling.
6. Add rate limiting/CAPTCHA/anti-automation at account creation and high-risk actions.
7. Add account export/delete and complete privacy workflows.
8. Add E2E tests for RLS, private posts, blocks, follow requests and DMs.
9. Add device-level biometric tests on Android and iOS release builds.
10. Add encrypted multi-device messaging before making any E2EE product claim.

## Naming

User-facing social product: **ZORIQ Social**.

Underlying network/wallet engineering brand remains **ZORYQ** when referring specifically to the chain, RPC, contracts or testnet.
