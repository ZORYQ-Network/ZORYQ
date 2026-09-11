-- Keep client upserts compatible with RLS: users may update only their own mute/report rows.

grant update on table public.content_reports to authenticated;
grant update on table public.user_mutes to authenticated;

drop policy if exists content_reports_own_update on public.content_reports;
create policy content_reports_own_update on public.content_reports
for update to authenticated
using ((select auth.uid()) = reporter_id)
with check ((select auth.uid()) = reporter_id);

drop policy if exists user_mutes_own_update on public.user_mutes;
create policy user_mutes_own_update on public.user_mutes
for update to authenticated
using ((select auth.uid()) = muter_id)
with check (((select auth.uid()) = muter_id) and muter_id <> muted_id);
