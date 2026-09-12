alter table public.profiles add column if not exists theme_preference text not null default 'system';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='profiles_theme_preference_check') then
    alter table public.profiles add constraint profiles_theme_preference_check check (theme_preference in ('system','light','dark'));
  end if;
end $$;

drop function if exists public.social_public_profiles(text,uuid[],integer);
drop function if exists private.social_public_profiles(text,uuid[],integer);

create function private.social_public_profiles(p_search text default null,p_ids uuid[] default null,p_limit integer default 30)
returns table(
 id uuid,username text,display_name text,bio text,avatar_url text,reputation_score integer,interests text[],power_key text,human_score integer,
 profile_visibility text,discoverable boolean,show_reputation boolean,verified boolean,verified_tier text,verified_until timestamptz,
 can_receive_crypto boolean,receive_wallet_address text
)
language sql stable security definer
set search_path='public','pg_temp'
as $$
 select p.id,p.username,p.display_name,p.bio,p.avatar_url,
   case when coalesce(p.show_reputation,true) then p.reputation_score else null end,
   p.interests,p.power_key,
   case when coalesce(p.show_reputation,true) then p.human_score else null end,
   p.profile_visibility,p.discoverable,p.show_reputation,
   (coalesce(p.verified,false) and p.verified_until is not null and p.verified_until>now()) as verified,
   case when coalesce(p.verified,false) and p.verified_until is not null and p.verified_until>now() then p.verified_tier else 'none' end,
   case when coalesce(p.verified,false) and p.verified_until is not null and p.verified_until>now() then p.verified_until else null end,
   (coalesce(p.show_wallet,false) and rw.address is not null) as can_receive_crypto,
   case when coalesce(p.show_wallet,false) then rw.address else null end as receive_wallet_address
 from public.profiles p
 left join lateral (
   select lower(uw.address) as address
   from public.user_wallets uw
   where uw.user_id=p.id and uw.chain_namespace='eip155' and uw.verified_at is not null
   order by uw.is_primary desc,uw.verified_at desc,uw.created_at asc
   limit 1
 ) rw on true
 where ((p_ids is not null and cardinality(p_ids)>0 and p.id=any(p_ids)) or ((p_ids is null or cardinality(p_ids)=0) and coalesce(p.discoverable,true)))
   and (p_search is null or btrim(p_search)='' or p.username ilike '%'||btrim(p_search)||'%' or p.display_name ilike '%'||btrim(p_search)||'%' or p.bio ilike '%'||btrim(p_search)||'%')
 order by coalesce(p.reputation_score,0) desc,p.created_at desc
 limit least(greatest(coalesce(p_limit,30),1),50)
$$;

create function public.social_public_profiles(p_search text default null,p_ids uuid[] default null,p_limit integer default 30)
returns table(
 id uuid,username text,display_name text,bio text,avatar_url text,reputation_score integer,interests text[],power_key text,human_score integer,
 profile_visibility text,discoverable boolean,show_reputation boolean,verified boolean,verified_tier text,verified_until timestamptz,
 can_receive_crypto boolean,receive_wallet_address text
)
language sql stable
set search_path='private','public','pg_temp'
as $$ select * from private.social_public_profiles(p_search,p_ids,p_limit) $$;

grant execute on function public.social_public_profiles(text,uuid[],integer) to anon,authenticated;
