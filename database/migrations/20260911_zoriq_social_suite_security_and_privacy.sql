-- Applied to Supabase project juordakzclqefpuauzjq on 2026-09-11.
-- ZORIQ Social: privacy fields, follow requests, mutes, RLS fixes, indexes and realtime.

alter table public.profiles add column if not exists power_key text not null default 'electric';
alter table public.profiles add column if not exists human_score integer not null default 100;
alter table public.profiles add column if not exists discoverable boolean not null default true;
alter table public.profiles add column if not exists dm_mode text not null default 'following';
alter table public.profiles add column if not exists allow_tagging boolean not null default true;
alter table public.profiles add column if not exists hide_engagement_counts boolean not null default false;
alter table public.profiles add column if not exists reduce_motion boolean not null default false;
alter table public.profiles add column if not exists social_dna jsonb not null default '{}'::jsonb;

create table if not exists public.follow_requests (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requester_id,target_id),
  constraint follow_requests_not_self check (requester_id <> target_id)
);
alter table public.follow_requests enable row level security;
revoke all on table public.follow_requests from anon, authenticated;
grant select, insert, delete on table public.follow_requests to authenticated;
drop policy if exists follow_requests_participants_read on public.follow_requests;
create policy follow_requests_participants_read on public.follow_requests for select to authenticated using ((select auth.uid()) = requester_id or (select auth.uid()) = target_id);
drop policy if exists follow_requests_self_insert on public.follow_requests;
create policy follow_requests_self_insert on public.follow_requests for insert to authenticated with check ((select auth.uid()) = requester_id and requester_id <> target_id);
drop policy if exists follow_requests_participants_delete on public.follow_requests;
create policy follow_requests_participants_delete on public.follow_requests for delete to authenticated using ((select auth.uid()) = requester_id or (select auth.uid()) = target_id);

create table if not exists public.user_mutes (
  muter_id uuid not null references public.profiles(id) on delete cascade,
  muted_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id,muted_id),
  constraint user_mutes_not_self check (muter_id <> muted_id)
);
alter table public.user_mutes enable row level security;
revoke all on table public.user_mutes from anon, authenticated;
grant select, insert, delete on table public.user_mutes to authenticated;
drop policy if exists user_mutes_own_read on public.user_mutes;
create policy user_mutes_own_read on public.user_mutes for select to authenticated using ((select auth.uid()) = muter_id);
drop policy if exists user_mutes_own_insert on public.user_mutes;
create policy user_mutes_own_insert on public.user_mutes for insert to authenticated with check ((select auth.uid()) = muter_id and muter_id <> muted_id);
drop policy if exists user_mutes_own_delete on public.user_mutes;
create policy user_mutes_own_delete on public.user_mutes for delete to authenticated using ((select auth.uid()) = muter_id);

-- Fix the old direct_conversation_members read policy that used a tautological
-- conversation_id comparison. A member can only read their own membership row.
drop policy if exists members_read_members on public.direct_conversation_members;
create policy members_read_members on public.direct_conversation_members for select to authenticated using ((select auth.uid()) = user_id);

-- Visibility-aware social graph reads.
drop policy if exists posts_public_read on public.posts;
drop policy if exists posts_visible_read on public.posts;
create policy posts_visible_read on public.posts for select to anon, authenticated using (
  visibility = 'public'::post_visibility
  or author_id = (select auth.uid())
  or (
    visibility = 'followers'::post_visibility
    and (select auth.uid()) is not null
    and exists (
      select 1 from public.user_follows uf
      where uf.follower_id = (select auth.uid())
        and uf.following_id = posts.author_id
    )
  )
);

drop policy if exists comments_public_read on public.comments;
drop policy if exists comments_visible_read on public.comments;
create policy comments_visible_read on public.comments for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id = comments.post_id)
);

drop policy if exists post_likes_public_read on public.post_likes;
drop policy if exists post_likes_visible_read on public.post_likes;
create policy post_likes_visible_read on public.post_likes for select to anon, authenticated using (
  exists (select 1 from public.posts p where p.id = post_likes.post_id)
);

-- The target of a private follow request may accept it without opening a broad insert policy.
drop policy if exists user_follows_accept_request on public.user_follows;
create policy user_follows_accept_request on public.user_follows for insert to authenticated with check (
  (select auth.uid()) = following_id
  and exists (
    select 1 from public.follow_requests fr
    where fr.requester_id = user_follows.follower_id
      and fr.target_id = user_follows.following_id
  )
);

create index if not exists idx_posts_author_created on public.posts(author_id,created_at desc);
create index if not exists idx_posts_community_created on public.posts(community_id,created_at desc) where community_id is not null;
create index if not exists idx_comments_post_created on public.comments(post_id,created_at);
create index if not exists idx_user_follows_following on public.user_follows(following_id,follower_id);
create index if not exists idx_notifications_user_unread on public.notifications(user_id,is_read,created_at desc);
create index if not exists idx_direct_messages_conversation_created on public.direct_messages(conversation_id,created_at);
create index if not exists idx_follow_requests_target_created on public.follow_requests(target_id,created_at desc);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_follows','direct_messages','user_achievements','xp_events','follow_requests']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('alter publication supabase_realtime add table public.%I', t);
    END IF;
  END LOOP;
END $$;
