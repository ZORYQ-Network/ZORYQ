-- ZORIQ X growth quests: authenticated external proof queue.
-- Client actions never award XP. Approval/finalization stays backend/admin authoritative.

create table if not exists public.x_quest_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quest_key text not null check (quest_key in ('x_follow_zoriq','x_post_mention_zoriq')),
  x_username text not null check (x_username ~ '^[A-Za-z0-9_]{1,15}$'),
  proof_url text,
  xp_reward integer not null check (xp_reward in (100,250)),
  status text not null default 'pending_review' check (status in ('pending_review','approved','rejected','awarded')),
  review_note text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  awarded_at timestamptz,
  reward_tx_hash text,
  constraint x_quest_one_per_user unique (user_id, quest_key),
  constraint x_post_requires_status_url check (
    quest_key <> 'x_post_mention_zoriq'
    or proof_url ~* '^https://(www\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]+/status/[0-9]+([/?#].*)?$'
  )
);

alter table public.x_quest_submissions enable row level security;

drop policy if exists x_quest_submissions_self_read on public.x_quest_submissions;
create policy x_quest_submissions_self_read
on public.x_quest_submissions for select
to authenticated
using (user_id = auth.uid());

revoke all on public.x_quest_submissions from anon, authenticated;
grant select on public.x_quest_submissions to authenticated;
grant all on public.x_quest_submissions to service_role;

create or replace function public.submit_x_quest_proof(
  p_quest_key text,
  p_x_username text,
  p_proof_url text default null
)
returns public.x_quest_submissions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_username text := regexp_replace(trim(coalesce(p_x_username,'')), '^@', '');
  v_url text := nullif(trim(coalesce(p_proof_url,'')), '');
  v_reward integer;
  v_existing public.x_quest_submissions;
  v_row public.x_quest_submissions;
begin
  if v_user is null then raise exception 'auth_required'; end if;
  if p_quest_key not in ('x_follow_zoriq','x_post_mention_zoriq') then raise exception 'invalid_quest'; end if;
  if v_username !~ '^[A-Za-z0-9_]{1,15}$' then raise exception 'invalid_x_username'; end if;
  if p_quest_key = 'x_post_mention_zoriq' and (v_url is null or v_url !~* '^https://(www\.)?(x\.com|twitter\.com)/[A-Za-z0-9_]+/status/[0-9]+([/?#].*)?$') then
    raise exception 'invalid_x_post_url';
  end if;
  v_reward := case p_quest_key when 'x_follow_zoriq' then 100 else 250 end;

  select * into v_existing
  from public.x_quest_submissions
  where user_id = v_user and quest_key = p_quest_key;

  if found and v_existing.status in ('approved','awarded') then
    return v_existing;
  end if;

  insert into public.x_quest_submissions(user_id,quest_key,x_username,proof_url,xp_reward,status,submitted_at,updated_at,review_note,reviewed_at)
  values(v_user,p_quest_key,v_username,v_url,v_reward,'pending_review',now(),now(),null,null)
  on conflict (user_id,quest_key) do update set
    x_username = excluded.x_username,
    proof_url = excluded.proof_url,
    xp_reward = excluded.xp_reward,
    status = 'pending_review',
    submitted_at = now(),
    updated_at = now(),
    review_note = null,
    reviewed_at = null
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.submit_x_quest_proof(text,text,text) from public, anon;
grant execute on function public.submit_x_quest_proof(text,text,text) to authenticated;

comment on table public.x_quest_submissions is 'ZORIQ X growth quest proofs. Client submissions are pending only; approval/XP award is backend/admin authoritative.';
comment on function public.submit_x_quest_proof(text,text,text) is 'Submits/re-submits an authenticated X quest proof without granting XP. Follow is 100 XP target; tagged post is 250 XP target.';
