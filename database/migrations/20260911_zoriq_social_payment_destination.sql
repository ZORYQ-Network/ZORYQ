create or replace function public.social_payment_destination(p_profile_id uuid)
returns table(profile_id uuid, address text, chain_namespace text, chain_id text)
language sql
security definer
set search_path=public
as $$
  select p.id, w.address, w.chain_namespace, w.chain_id
  from public.profiles p
  join public.user_wallets w on w.user_id=p.id
  where p.id=p_profile_id
    and coalesce(p.show_wallet,false)=true
    and w.verified_at is not null
    and w.chain_namespace='eip155'
  order by w.is_primary desc, w.verified_at desc
  limit 1;
$$;

revoke all on function public.social_payment_destination(uuid) from public;
grant execute on function public.social_payment_destination(uuid) to authenticated;
