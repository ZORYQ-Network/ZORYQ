# ZORIQ Social Backend

## Status

The ZORIQ Social client is **offline-first** and the shared backend is built on the existing Supabase project used by the crypto/social product.

- Project URL is supplied to clients through `EXPO_PUBLIC_SUPABASE_URL`.
- Client authorization uses a **publishable key only** through `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Service-role or secret keys must never be embedded in the web application or APK.
- Local social state remains available when there is no authenticated Supabase session.
- Web and APK now share the same synchronized posts, profiles, follows, messages and notifications when a valid social session exists.

## Existing shared social model

The project already contains the core social tables used by this implementation, including:

- `profiles`
- `posts`
- `comments`
- `post_likes`
- `post_bookmarks`
- `post_reactions`
- `post_reposts`
- `notifications`
- `user_follows`
- `user_blocks`
- `achievements`
- `user_achievements`
- `xp_events`
- `communities`
- `community_members`
- `conversations`
- `conversation_members`
- `messages`
- `user_wallets`
- `wallet_link_challenges`
- `zoryq_auth_challenges`

The mature messaging path is `conversations / conversation_members / messages`. New social code should prefer this model instead of creating another DM schema.

## ZORIQ additions

### Profile evolution

The Social Evolution migrations add:

- `power_key`
- `human_score`
- `discoverable`
- `dm_mode`
- `allow_tagging`
- `hide_engagement_counts`
- `reduce_motion`
- `social_dna`
- `show_reputation`

Constraints restrict Human Score to 0–100, DM mode to a known set, reputation to 0–100 and Powers to the supported ZORIQ Power identifiers.

### Public profile cards

The complete `profiles` row is no longer publicly readable. Direct table reads are restricted to the authenticated profile owner.

Public discovery, post attribution and conversation display use `social_public_profiles`, which returns only the approved public card fields:

- id
- username
- display name
- bio
- avatar
- interests
- Power
- public profile visibility/discovery state
- reputation/Human Score only when the account allows reputation display

The public RPC is a `SECURITY INVOKER` wrapper around a helper in the non-exposed `private` schema. The helper is `SECURITY DEFINER` so it can produce the safe projection without reopening the whole `profiles` table.

### Private follow requests

`follow_requests` supports private/followers-only profiles without weakening the `user_follows` insert policy.

The target account can accept a request through `social_accept_follow_request`.

### Mute

`user_mutes` is private to the muting account and does not notify the muted profile.

### Content reports

`content_reports` lets an authenticated user report a post, comment, profile or message for spam, scam, harassment, hate, violence, sexual content, impersonation, privacy or other reasons.

Users can read only their own report records. There is intentionally no client policy that lets a normal user change moderation status.

### Hide / not interested

`post_hides` records per-user feed feedback such as not interested, repetitive or irrelevant. The mobile backend adapter removes these posts from the authenticated feed.

## Row-Level Security

RLS is enabled across the principal social tables.

Important rules include:

- Public posts can be read without a session.
- A user can always read their own post.
- Followers-only posts require an authenticated follower relation.
- Comments, likes, reactions and reposts inherit visibility through the underlying post.
- Full profile rows are readable only by the profile owner; other clients use the safe public-card RPC.
- Follow requests are visible only to the requester and target.
- Mutes are visible only to the muting user.
- Reports are visible only to the reporter from the normal client role.
- Message reads/writes use conversation membership checks.
- Blocks are checked by hardened social RPCs before follows, DMs or interaction with restricted posts.

## Hardened RPCs

The following `SECURITY DEFINER` RPCs are intentionally executable by `authenticated`, not by `anon`:

- `social_toggle_like`
- `social_toggle_bookmark`
- `social_toggle_repost`
- `social_set_reaction`
- `social_add_comment`
- `social_toggle_follow`
- `social_accept_follow_request`
- `start_direct_conversation`

`private.can_view_social_post` is not exposed to client roles. Interaction RPCs call it before changing social data.

This matters because `SECURITY DEFINER` functions can bypass table RLS internally; each public RPC must therefore perform its own authorization checks and have a fixed `search_path`.

## Realtime and notifications

The social project publishes the relevant event tables to Supabase Realtime, including posts, comments, post likes, notifications, follows, messages, follow requests, achievements and XP events.

The APK now exposes a **global notification center** at the shell level, not only inside the Social screen:

- the bell is visible from ZORIQ Social and Wallet / Recovery;
- unread social notifications are counted globally;
- a notification can be read/marked read while the user is in the wallet;
- the wallet can activate its social session through SIWE from the notification center;
- once authenticated, follows, comments, messages, achievements and other stored social notifications use the same wallet-linked session;
- returning to the foreground refreshes social notification state.

This is **in-app synchronized notification delivery**. Push delivery while the app is closed/backgrounded is still separate production work and requires device-token registration plus Android/iOS push credentials.

## Mobile adapter

`zoryq-mobile/socialBackend.ts` is the single mobile access layer for shared social state. It provides backend/session state, safe public discovery cards, visible feed, profile update, create post, follows, interactions, comments, block/mute, hide/report, conversations/messages, notifications and Realtime subscription.

UI components should call this adapter instead of making scattered direct Supabase queries.

## Wallet identity and Auth

The APK creates/restores a self-custody EVM wallet and stores its secret material locally. Supabase Auth supports EIP-4361 Sign-In With Ethereum through its Web3 authentication flow. This is the intended identity path for ZORIQ Social so the wallet can become the account identity without asking the user to create another password.

The mobile shell and Social Suite already call the SIWE client flow. Runtime sign-in still depends on the Supabase Web3 provider and allowed domain/redirect configuration being enabled correctly. The UI reports a real error instead of creating a fake session.

Rules:

- signing in is off-chain and should not spend gas;
- public social reads use the publishable key under RLS;
- authenticated writes require a valid Supabase session;
- otherwise the UI falls back to local/offline social state;
- never use a service-role key to fake a client session.

## Reproducible database history

Applied database changes are checked into `database/migrations/`, including:

- `20260911_zoriq_social_suite_security_and_privacy.sql`
- `20260911_zoriq_social_rpc_hardening.sql`
- `20260911_zoriq_social_profile_preferences_constraints.sql`
- `20260911_zoriq_social_reporting_and_hides.sql`
- `20260911_zoriq_social_upsert_update_policies.sql`
- `20260911_zoriq_social_public_profile_cards_and_interaction_visibility.sql`
- `20260911_zoriq_social_restrict_profile_direct_reads.sql`

Future schema changes should be applied as new migrations and committed here rather than being made only in the dashboard.

## Remaining production work

1. Confirm/enable EIP-4361 Web3 Auth in the Supabase project and test the complete wallet-login path on physical devices and the production web domain.
2. Add push notification delivery/device tokens for notifications when the app is closed or backgrounded; the global in-app notification center is already implemented.
3. Add media storage/CDN pipeline and malware/content scanning.
4. Add a moderator/admin surface for reports; do not expose report-status updates to normal clients.
5. Add rate limits and anti-automation at account creation and sensitive public actions.
6. Add encrypted multi-device messaging if end-to-end encryption is part of the product promise.
7. Add account export/delete and privacy workflows.
8. Add end-to-end tests for RLS, follows, private posts, public profile cards, block rules, DMs and notifications.
