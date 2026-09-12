create schema if not exists private;

create or replace function private.social_public_profiles(
  p_search text default null,
  p_ids uuid[] default null,
  p_limit integer default 30
)
returns table(
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  reputation_score integer,
  interests text[],
  power_key text,
  human_score integer,
  profile_visibility text,
  discoverable boolean,
  show_reputation boolean
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.bio,
    p.avatar_url,
    case when coalesce(p.show_reputation,true) then p.reputation_score else null end,
    p.interests,
    p.power_key,
    case when coalesce(p.show_reputation,true) then p.human_score else null end,
    p.profile_visibility,
    p.discoverable,
    p.show_reputation
  from public.profiles p
  where
    (
      (p_ids is not null and cardinality(p_ids) > 0 and p.id = any(p_ids))
      or
      ((p_ids is null or cardinality(p_ids) = 0) and coalesce(p.discoverable,true))
    )
    and (
      p_search is null or btrim(p_search) = ''
      or p.username ilike '%' || btrim(p_search) || '%'
      or p.display_name ilike '%' || btrim(p_search) || '%'
      or p.bio ilike '%' || btrim(p_search) || '%'
    )
  order by coalesce(p.reputation_score,0) desc, p.created_at desc
  limit least(greatest(coalesce(p_limit,30),1),50)
$$;

revoke all on function private.social_public_profiles(text,uuid[],integer) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.social_public_profiles(text,uuid[],integer) to anon, authenticated;

create or replace function public.social_public_profiles(
  p_search text default null,
  p_ids uuid[] default null,
  p_limit integer default 30
)
returns table(
  id uuid,
  username text,
  display_name text,
  bio text,
  avatar_url text,
  reputation_score integer,
  interests text[],
  power_key text,
  human_score integer,
  profile_visibility text,
  discoverable boolean,
  show_reputation boolean
)
language sql
stable
security invoker
set search_path = private, public, pg_temp
as $$
  select * from private.social_public_profiles(p_search,p_ids,p_limit)
$$;

revoke all on function public.social_public_profiles(text,uuid[],integer) from public;
grant execute on function public.social_public_profiles(text,uuid[],integer) to anon, authenticated;

drop policy if exists post_reactions_public_read on public.post_reactions;
create policy post_reactions_visible_read
on public.post_reactions
for select
to anon, authenticated
using (exists (select 1 from public.posts p where p.id = post_reactions.post_id));

drop policy if exists reposts_read_public on public.post_reposts;
create policy post_reposts_visible_read
on public.post_reposts
for select
to anon, authenticated
using (exists (select 1 from public.posts p where p.id = post_reposts.post_id));
