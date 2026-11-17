-- Staff can edit, extend and delete expired listings. Safe to re-run.
-- Run in the Supabase SQL Editor.
--
-- The migrations gave staff separate insert/update/delete policies on hr_jobs but no
-- select policy. Since 20261103_listing_expiry.sql, the only select policy shows open
-- listings, and an UPDATE/DELETE can only reach rows the user can select. So once a
-- listing expired, the HR Console reported "Changes were not saved" (0 rows updated).
begin;

drop policy if exists "Admins can view all jobs" on public.hr_jobs;
create policy "Admins can view all jobs" on public.hr_jobs
  for select to authenticated using (public.is_admin());

commit;
