-- Applied to Supabase project juordakzclqefpuauzjq on 2026-09-11.

alter table public.profiles add column if not exists show_reputation boolean not null default true;

alter table public.profiles drop constraint if exists profiles_human_score_range;
alter table public.profiles add constraint profiles_human_score_range check (human_score between 0 and 100);

alter table public.profiles drop constraint if exists profiles_dm_mode_valid;
alter table public.profiles add constraint profiles_dm_mode_valid check (dm_mode in ('everyone','following','nobody'));

alter table public.profiles drop constraint if exists profiles_power_key_valid;
alter table public.profiles add constraint profiles_power_key_valid check (power_key in ('electric','inferno','frost','galaxy','toxic','portal','crystal','glitch','prism','void'));

alter table public.profiles drop constraint if exists profiles_reputation_score_range;
alter table public.profiles add constraint profiles_reputation_score_range check (reputation_score between 0 and 100);

create index if not exists idx_profiles_discoverable_reputation on public.profiles(discoverable,reputation_score desc) where discoverable=true;
