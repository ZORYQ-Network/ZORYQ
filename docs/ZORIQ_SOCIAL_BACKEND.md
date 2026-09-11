# ZORIQ Social Backend

## Status

The ZORIQ Social client is **offline-first** and the shared backend is built on the existing Supabase project used by the crypto/social product.

- Project URL is supplied to clients through `EXPO_PUBLIC_SUPABASE_URL`.
- Client authorization uses a **publishable key only** through `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Service-role or secret keys must never be embedded in the web application or APK.
- Local social state remains available when there is no authenticated Supabase session.

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

The Social Evolution migrations add:

### Profile evolution

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

### Private follow requests

`follow_requests` supports private/followers-only profiles without weakening the `user_follows` insert policy.

The target account can accept a request through `social_accept_follow_request`.

### Mute

`user_mutes` is private to the muting account and does not notify the muted profile.

### Content reports

`content_reports` lets an authenticated user report a post, comment, profile or message for:

- spam
- scam
- harassment
- hate
- violence
- sexual content
- impersonation
- privacy
- other

Users can read only their own report records. There is intentionally no client policy that lets a normal user change moderation status.

### Hide / not interested

`post_hides` records per-user local feed feedback such as:

- not interested
- repetitive
- irrelevant

The mobile backend adapter removes these posts from the authenticated feed.

## Row-Level Security

RLS is enabled across the principal social tables.

Important rules include:

- Public posts can be read without a session.
- A user can always read their own post.
- Followers-only posts require an authenticated follower relation.
- Comments and likes inherit visibility through the underlying post.
- Follow requests are visible only to the requester and target.
- Mutes are visible only to the muting user.
- Reports are visible only to the reporter from the normal client role.
- Message reads/writes use conversation membership checks.
- Blocks are checked by hardened social RPCs before follows, DMs or interaction with restricted posts.

## Hardened RPCs

The following SECURITY DEFINER RPCs are intentionally executable by `authenticated`, not by `anon`:

- `social_toggle_like`
- `social_toggle_bookmark`
- `social_toggle_repost`
- `social_set_reaction`
- `social_add_comment`
- `social_toggle_follow`
- `social_accept_follow_request`
- `start_direct_conversation`

`private.can_view_social_post` is not exposed to client roles. Interaction RPCs call it before changing social data.

This is important because SECURITY DEFINER functions can bypass table RLS internally; each public RPC must therefore perform its own authorization checks.

## Realtime

The social project publishes the relevant event tables to Supabase Realtime, including:

- posts
- comments
- post likes
- notifications
- follows
- direct-message events / messages where applicable
- follow requests
- achievements
- XP events

The client adapter exposes `subscribeSocial()` but the app must still enforce RLS and session ownership for personalized streams.

## Mobile adapter

`zoryq-mobile/socialBackend.ts` is the single mobile access layer for shared social state. It provides:

- backend/session state
- public discovery
- visible feed
- profile update
- create post
- follow / accept follow request
- like / bookmark / repost / reaction
- comment
- block / mute
- hide post
- report content
- start conversation / send message
- notifications
- Realtime subscription

UI components should call this adapter instead of making scattered direct Supabase queries.

## Wallet identity and Auth

The APK already creates/restores a self-custody EVM wallet and stores its secret material locally. The Supabase project also already contains wallet-link and authentication-challenge tables.

Supabase Auth supports EIP-4361 Sign-In With Ethereum through its Web3 authentication flow. This is the intended direction for ZORIQ Social so the wallet can become the account identity without asking the user to create another password.

However, **the clients must not claim wallet-based social login is live until the Web3 provider is confirmed enabled and tested in the Supabase Auth configuration**.

Until that configuration is verified:

- public social reads may use the publishable key under RLS;
- authenticated writes require a valid existing Supabase session;
- otherwise the UI must fall back to local/offline social state;
- never use a service-role key to fake a client session.

## Reproducible database history

Applied database changes are checked into:

- `database/migrations/20260911_zoriq_social_suite_security_and_privacy.sql`
- `database/migrations/20260911_zoriq_social_rpc_hardening.sql`
- `database/migrations/20260911_zoriq_social_profile_preferences_constraints.sql`
- `database/migrations/20260911_zoriq_social_reporting_and_hides.sql`

Future schema changes should be applied as new migrations and committed here rather than being made only in the dashboard.

## Remaining production work

1. Confirm/enable EIP-4361 Web3 Auth and test wallet sign-in end-to-end.
2. Bind the current local UI state to `socialBackend.ts` after authentication while retaining offline fallback.
3. Add push notification delivery and device tokens.
4. Add media storage/CDN pipeline and malware/content scanning.
5. Add a moderator/admin surface for reports; do not expose report status updates to normal clients.
6. Add rate limits and CAPTCHA/anti-automation at account creation and sensitive public actions.
7. Add encrypted multi-device messaging if end-to-end encryption is part of the product promise.
8. Add account export/delete and privacy workflows.
9. Add end-to-end tests for RLS, follows, private posts, block rules and DMs.
