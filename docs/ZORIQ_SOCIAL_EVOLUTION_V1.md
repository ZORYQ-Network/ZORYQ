# ZORIQ Social Evolution v1

## Product thesis

**Your social world evolves with you.**

ZORIQ Social is the consumer social surface of the ZORYQ ecosystem. The v1 experience is designed for both web and the Android/Expo application while keeping the existing ZORYQ wallet/testnet functionality intact.

## Implemented in this branch

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
- Local social companion experience available on web and APK.
- Can summarize local state, explain ZORIQ DNA, suggest Worlds and describe Pulse activity.
- **Important:** v1 does not send messages to an external AI provider. Production AI requires a consent-aware backend integration.

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
- Current participant counts are demonstrative in v1; production requires realtime presence infrastructure.

### Living posts
- Challenges with progress.
- Polls with interactive voting.
- Goals/support interactions.
- Collaborative posts with user contributions.

### Reputation Graph
- Reputation UI built around authenticity, originality, community, history and conversation signals.
- Designed explicitly to avoid follower count being the sole measure of social value.

### Human First
- Local heuristic detects unusually rapid actions and repeated text.
- This is a UX prototype, not identity proof and not a production moderation classifier.
- Production must combine server-side signals, transparent policies, rate limits, review/appeal paths and privacy safeguards.

### ZORIQ Worlds
- Community discovery and join/leave behavior.
- Initial worlds: Crypto, Technology, Gaming, Music, Builders and Football.
- Product model supports future World-specific feeds, Pulse rooms, chat, missions and rankings.

### ZORIQ DNA
- Visual identity derived from user-controlled interest weights.
- Changes locally as the user changes feed intent.
- Production should keep recommendation signals visible, user-configurable and privacy-aware.

## Wallet creation and Recovery

The APK exposes **Wallet / Recovery** as a primary product surface rather than hiding wallet onboarding behind the social experience.

### Create a new wallet
- Uses `Wallet.createRandom()` from ethers.
- Generates a standard BIP-39 recovery phrase and EVM private key locally on the device.
- The private key and mnemonic are stored with Expo SecureStore.
- The seed phrase is never sent to the ZORYQ backend.
- The user must be clearly warned that possession of the recovery phrase grants control of the wallet.

### Import / recover an existing EVM wallet
- Uses `Wallet.fromPhrase()` after normalizing the recovery phrase.
- Compatible with standard EVM wallets when the imported account uses the default Ethereum derivation path `m/44'/60'/0'/0/0`.
- This is intended to support recovery/import from common EVM wallets such as MetaMask, Rabby and similar wallets using the same account derivation.
- A valid imported phrase restores the same first EVM account/address for that derivation path.
- Invalid phrases are rejected locally.

## Biometric security

The APK includes a dedicated **ZORIQ Security** surface using `expo-local-authentication`.

### App unlock
- Supports secure fingerprint and secure facial recognition where provided by the device.
- Can require biometric authentication when the app opens and when it returns from the background.
- Device credential fallback is allowed by the operating-system authentication prompt when supported.
- The user can enable or disable app-lock biometrics in the Security surface.

### Transaction confirmation
- Can require biometric confirmation before every call that reaches the wallet signer `sendTransaction` path.
- This covers ZQ transfers, stake, unstake, swaps and token approvals in the current wallet implementation.
- When a swap needs both an ERC-20 approval and the swap transaction, each on-chain signature can require its own biometric confirmation.
- Cancelling or failing authentication prevents the signer from broadcasting the transaction.
- Biometric authentication never replaces the private key; it authorizes local use of the key for that action.

### Security rules
- Never ask for a seed phrase on a website, chat, support channel or backend form.
- Never transmit the phrase to analytics, crash reporting or an AI service.
- Keep signing local to the device.
- Recovery/import must always show a phishing warning before the user enters the phrase.
- Cloud backup of an unencrypted recovery phrase should not be treated as the preferred production backup method; encrypted backup or platform-secured recovery should replace plaintext export before production release.

## Web implementation

- `zoryq-web/zoriq-social-v2.html`
- `zoryq-web/zoriq-social-v2.css`
- `zoryq-web/zoriq-social-v2.js`
- `/zoriq`, `/social` and `/zoriq-social` route to the v2 page on this branch.
- Local demo persistence uses `localStorage` key `zoriq.social.v2`.

The previous social prototype remains in the repository as `zoryq-web/zoriq-social.html` for reference and rollback.

## APK implementation

- `zoryq-mobile/Social.tsx` contains the native social experience.
- `zoryq-mobile/index.js` is the new Expo entry point and biometric security gate.
- The APK opens with **ZORIQ Social** and includes top-level access to **Wallet / Recovery** and **ZORIQ Security**.
- Existing `zoryq-mobile/App.tsx` wallet logic is not replaced; it remains the signing, wallet creation, recovery, faucet, transfer, stake and swap surface.
- Social demo persistence uses AsyncStorage key `zoriq.social.v2.mobile`.
- Biometric security preferences use AsyncStorage key `zoriq.security.biometric.v1`.

## Production boundaries / next backend layer

The v1 branch intentionally separates functional client UX from capabilities that require shared infrastructure. Before calling the following features production-ready, implement:

1. Account/authentication service shared by web and APK.
2. PostgreSQL/Supabase-compatible social data model for users, follows, posts, replies, reactions, Worlds, memberships and achievements.
3. Realtime presence, Pulse rooms, chat and notification streams.
4. Media upload pipeline, image/video moderation and CDN delivery.
5. Server-authoritative XP/reputation event ledger with abuse controls and idempotency.
6. Human First trust-and-safety service with transparent enforcement and appeals.
7. AI gateway for ZORI with explicit privacy/consent controls, rate limits and audit logs.
8. Recommendation service where feed intent remains user-controlled.
9. Push notifications for APK and web notifications where supported.
10. Analytics, retention cohorts, feature flags and A/B experimentation.
11. Accessibility, localization, privacy controls and account deletion/export flows.
12. Automated web smoke tests, React Native typecheck/build checks and end-to-end tests.
13. Production-grade encrypted recovery/backup flow for wallet secrets.
14. Device-level tests for Android fingerprint/face flows and iOS Face ID/Touch ID using development/release builds.

## Naming

User-facing social product: **ZORIQ Social**.

Underlying network/wallet engineering brand remains **ZORYQ** where it refers to the chain, wallet, RPC, contracts or testnet.
