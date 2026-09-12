-- ZORIQ Verified — annual subscription paid in native ETH on supported EVM networks.
-- Fixed price: USD 9.99 / 365 days. ETH amount is quoted at checkout and verified on-chain.

create table if not exists public.zoriq_verified_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wallet_address text not null,
  status text not null default 'active' check (status in ('active','expired','cancelled','suspended')),
  started_at timestamptz not null default now(),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null,
  last_payment_tx text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zoriq_verified_wallet_format check (wallet_address ~ '^0x[0-9a-fA-F]{40}$')
);

create table if not exists public.zoriq_verified_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_address text not null,
  chain_id text not null,
  network_name text,
  tx_hash text not null,
  amount_wei numeric not null,
  amount_eth numeric not null,
  usd_value numeric not null default 9.99,
  eth_usd_quote numeric,
  recipient_address text not null,
  status text not null default 'confirmed' check (status in ('confirmed','refunded','reversed')),
  paid_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint zoriq_verified_payment_wallet_format check (wallet_address ~ '^0x[0-9a-fA-F]{40}$'),
  constraint zoriq_verified_payment_tx_format check (tx_hash ~ '^0x[0-9a-fA-F]{64}$')
);

create unique index if not exists zoriq_verified_subscriptions_wallet_idx
  on public.zoriq_verified_subscriptions (lower(wallet_address));
create unique index if not exists zoriq_verified_payments_tx_idx
  on public.zoriq_verified_payments (lower(tx_hash));
create index if not exists zoriq_verified_payments_user_idx
  on public.zoriq_verified_payments (user_id, paid_at desc);

alter table public.zoriq_verified_subscriptions enable row level security;
alter table public.zoriq_verified_payments enable row level security;

drop policy if exists zoriq_verified_subscriptions_self_read on public.zoriq_verified_subscriptions;
create policy zoriq_verified_subscriptions_self_read
on public.zoriq_verified_subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists zoriq_verified_payments_self_read on public.zoriq_verified_payments;
create policy zoriq_verified_payments_self_read
on public.zoriq_verified_payments
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.zoriq_verified_subscriptions from anon, authenticated;
revoke all on public.zoriq_verified_payments from anon, authenticated;
grant select on public.zoriq_verified_subscriptions to authenticated;
grant select on public.zoriq_verified_payments to authenticated;
grant all on public.zoriq_verified_subscriptions to service_role;
grant all on public.zoriq_verified_payments to service_role;

-- The visible badge is backend-authoritative. A normal client must never be able
-- to self-assign profiles.verified / verified_tier / verified_until.
create or replace function public.zoriq_guard_verified_profile_fields()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user not in ('postgres','service_role','supabase_admin')
     and coalesce(auth.role(),'') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.verified := false;
      new.verified_tier := 'none';
      new.verified_until := null;
    else
      new.verified := old.verified;
      new.verified_tier := old.verified_tier;
      new.verified_until := old.verified_until;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists zoriq_guard_verified_profile_fields on public.profiles;
create trigger zoriq_guard_verified_profile_fields
before insert or update of verified, verified_tier, verified_until
on public.profiles
for each row execute function public.zoriq_guard_verified_profile_fields();

comment on table public.zoriq_verified_subscriptions is 'ZORIQ Verified annual subscription state; backend-authoritative.';
comment on table public.zoriq_verified_payments is 'Confirmed on-chain ETH payments for ZORIQ Verified annual subscriptions.';
comment on function public.zoriq_guard_verified_profile_fields() is 'Prevents anon/authenticated clients from self-assigning ZORIQ Verified fields.';
