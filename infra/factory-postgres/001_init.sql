-- ZORYQ AI App Factory PostgreSQL target schema
-- Production-target migration; not automatically applied to any existing Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.factory_apps (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{0,71}$'),
  name text not null,
  spec jsonb not null check (jsonb_typeof(spec)='object'),
  version integer not null default 1 check (version > 0),
  revision bigint not null default 1 check (revision > 0),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.factory_memberships (
  app_id uuid not null references public.factory_apps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (app_id,user_id)
);

create table if not exists public.factory_records (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.factory_apps(id) on delete cascade,
  module_id text not null check (module_id ~ '^[a-z0-9][a-z0-9_-]{0,47}$'),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data)='object'),
  revision bigint not null default 1 check (revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.factory_audit (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.factory_apps(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.factory_build_jobs (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.factory_apps(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  platform text not null check (platform in ('android-apk','android-aab','web-bundle')),
  status text not null default 'queued' check (status in ('queued','building','succeeded','failed','expired')),
  artifact_ref text,
  artifact_sha256 text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists factory_records_app_module_idx on public.factory_records(app_id,module_id,created_at desc);
create index if not exists factory_audit_app_created_idx on public.factory_audit(app_id,created_at desc);
create index if not exists factory_build_jobs_app_created_idx on public.factory_build_jobs(app_id,created_at desc);
create index if not exists factory_memberships_user_idx on public.factory_memberships(user_id,app_id);

create or replace function public.factory_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists factory_apps_touch on public.factory_apps;
create trigger factory_apps_touch before update on public.factory_apps for each row execute function public.factory_touch_updated_at();
drop trigger if exists factory_records_touch on public.factory_records;
create trigger factory_records_touch before update on public.factory_records for each row execute function public.factory_touch_updated_at();
drop trigger if exists factory_build_jobs_touch on public.factory_build_jobs;
create trigger factory_build_jobs_touch before update on public.factory_build_jobs for each row execute function public.factory_touch_updated_at();

create or replace function public.factory_has_role(target_app uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.factory_memberships m
    where m.app_id=target_app and m.user_id=auth.uid() and m.role=any(allowed_roles)
  ) or exists(
    select 1 from public.factory_apps a where a.id=target_app and a.owner_id=auth.uid()
  );
$$;
revoke all on function public.factory_has_role(uuid,text[]) from public;
grant execute on function public.factory_has_role(uuid,text[]) to authenticated;

alter table public.factory_apps enable row level security;
alter table public.factory_memberships enable row level security;
alter table public.factory_records enable row level security;
alter table public.factory_audit enable row level security;
alter table public.factory_build_jobs enable row level security;

create policy "factory_apps_select_member" on public.factory_apps for select to authenticated using (public.factory_has_role(id,array['owner','admin','editor','viewer']));
create policy "factory_apps_insert_owner" on public.factory_apps for insert to authenticated with check (owner_id=auth.uid());
create policy "factory_apps_update_admin" on public.factory_apps for update to authenticated using (public.factory_has_role(id,array['owner','admin'])) with check (public.factory_has_role(id,array['owner','admin']));

create policy "factory_memberships_select_member" on public.factory_memberships for select to authenticated using (public.factory_has_role(app_id,array['owner','admin','editor','viewer']));
create policy "factory_memberships_manage_admin" on public.factory_memberships for all to authenticated using (public.factory_has_role(app_id,array['owner','admin'])) with check (public.factory_has_role(app_id,array['owner','admin']));

create policy "factory_records_select_member" on public.factory_records for select to authenticated using (public.factory_has_role(app_id,array['owner','admin','editor','viewer']));
create policy "factory_records_insert_writer" on public.factory_records for insert to authenticated with check (public.factory_has_role(app_id,array['owner','admin','editor']) and (created_by is null or created_by=auth.uid()));
create policy "factory_records_update_writer" on public.factory_records for update to authenticated using (public.factory_has_role(app_id,array['owner','admin','editor'])) with check (public.factory_has_role(app_id,array['owner','admin','editor']));
create policy "factory_records_delete_writer" on public.factory_records for delete to authenticated using (public.factory_has_role(app_id,array['owner','admin','editor']));

create policy "factory_audit_select_admin" on public.factory_audit for select to authenticated using (public.factory_has_role(app_id,array['owner','admin']));
create policy "factory_build_jobs_select_member" on public.factory_build_jobs for select to authenticated using (public.factory_has_role(app_id,array['owner','admin','editor','viewer']));
create policy "factory_build_jobs_request_admin" on public.factory_build_jobs for insert to authenticated with check (public.factory_has_role(app_id,array['owner','admin']) and (requested_by is null or requested_by=auth.uid()));
