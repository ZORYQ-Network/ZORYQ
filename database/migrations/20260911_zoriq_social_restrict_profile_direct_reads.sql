drop policy if exists profiles_public_read on public.profiles;

create policy profiles_self_read
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);
