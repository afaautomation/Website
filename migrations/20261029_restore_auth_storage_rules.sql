-- Restores what the 29 Oct project move left behind (20261029).
-- `supabase db dump` skips the auth and storage schemas, so the new project had no
-- storage policies (every resume and showcase upload was refused) and no trigger
-- creating a profile for each new account. Definitions match supabase_schema.sql.
begin;

drop policy if exists "Anyone can drop an application resume" on storage.objects;
create policy "Anyone can drop an application resume" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = 'applications');

drop policy if exists "Users upload own resumes" on storage.objects;
create policy "Users upload own resumes" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users read own resumes" on storage.objects;
create policy "Users read own resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Admins read all resumes" on storage.objects;
create policy "Admins read all resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.is_admin());

drop policy if exists "Staff read site media" on storage.objects;
create policy "Staff read site media" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff upload site media" on storage.objects;
create policy "Staff upload site media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff delete site media" on storage.objects;
create policy "Staff delete site media" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- Accounts created while the trigger was missing get their profile now (same values as the trigger).
insert into public.profiles (id, name, phone, role)
select u.id,
  coalesce(u.raw_user_meta_data->>'name', split_part(coalesce(u.email, ''), '@', 1)),
  u.raw_user_meta_data->>'phone', 'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Candidate age, asked next to the name on the profile forms.
alter table public.candidate_profiles add column if not exists age smallint;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_age_check;
alter table public.candidate_profiles add constraint candidate_profiles_age_check
  check (age is null or age between 15 and 70);

commit;
