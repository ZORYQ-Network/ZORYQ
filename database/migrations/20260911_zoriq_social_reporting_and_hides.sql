-- Applied to Supabase project juordakzclqefpuauzjq on 2026-09-11.

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post','comment','profile','message')),
  target_id uuid not null,
  reason text not null check (reason in ('spam','scam','harassment','hate','violence','sexual','impersonation','privacy','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewing','resolved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint content_reports_details_length check (details is null or length(details) <= 1000),
  unique(reporter_id,target_type,target_id)
);
alter table public.content_reports enable row level security;
revoke all on table public.content_reports from anon, authenticated;
grant select, insert on table public.content_reports to authenticated;
drop policy if exists content_reports_own_read on public.content_reports;
create policy content_reports_own_read on public.content_reports for select to authenticated using ((select auth.uid()) = reporter_id);
drop policy if exists content_reports_own_insert on public.content_reports;
create policy content_reports_own_insert on public.content_reports for insert to authenticated with check ((select auth.uid()) = reporter_id);

create table if not exists public.post_hides (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  reason text not null default 'not_interested' check (reason in ('not_interested','repetitive','irrelevant')),
  created_at timestamptz not null default now(),
  primary key(user_id,post_id)
);
alter table public.post_hides enable row level security;
revoke all on table public.post_hides from anon, authenticated;
grant select, insert, update, delete on table public.post_hides to authenticated;
drop policy if exists post_hides_own_read on public.post_hides;
create policy post_hides_own_read on public.post_hides for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists post_hides_own_insert on public.post_hides;
create policy post_hides_own_insert on public.post_hides for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists post_hides_own_update on public.post_hides;
create policy post_hides_own_update on public.post_hides for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists post_hides_own_delete on public.post_hides;
create policy post_hides_own_delete on public.post_hides for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists idx_content_reports_status_created on public.content_reports(status,created_at desc);
create index if not exists idx_content_reports_target on public.content_reports(target_type,target_id);
create index if not exists idx_post_hides_user_created on public.post_hides(user_id,created_at desc);
