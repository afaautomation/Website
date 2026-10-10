-- Security hardening (audit 2026-10-10).
-- The live database had policies/grants that supabase_schema.sql does not create:
-- anonymous visitors could insert rows into public.hr_jobs. This migration drops
-- EVERY policy on the main-site tables and recreates exactly the intended set, so
-- unknown leftovers cannot survive. Safe to re-run. Existing data is preserved,
-- except the single blank listing created by the audit probe.
begin;

-- 1. Remove the blank listing created during testing.
delete from public.hr_jobs
where id = '4c6f5da9-4274-4205-aa6c-143610bb2d8c' and title is null;

-- 2. Drop all existing policies on main-site tables.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('profiles', 'course_enrollments', 'job_applications', 'hr_jobs',
                               'reels', 'candidate_profiles', 'site_content')
  loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- 3. Table privileges: visitors read; writes only where a policy below allows them.
revoke insert, update, delete, truncate, references, trigger on
  public.profiles, public.course_enrollments, public.job_applications, public.hr_jobs,
  public.reels, public.candidate_profiles, public.site_content
  from anon;
revoke truncate, references, trigger on
  public.profiles, public.course_enrollments, public.job_applications, public.hr_jobs,
  public.reels, public.candidate_profiles, public.site_content
  from authenticated;
grant insert on public.course_enrollments to anon, authenticated;
grant insert, update, delete on public.hr_jobs, public.reels, public.job_applications,
  public.site_content to authenticated;
grant insert, update on public.candidate_profiles to authenticated;

-- 4. Recreate the intended policies.
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
revoke update on public.profiles from anon, authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

alter table public.course_enrollments enable row level security;
create policy "Public can submit enrollment" on public.course_enrollments
  for insert with check (true);
create policy "Admins can view enrollments" on public.course_enrollments
  for select using (public.is_admin());
create policy "Admins can manage enrollments" on public.course_enrollments
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete enrollments" on public.course_enrollments
  for delete using (public.is_admin());

alter table public.job_applications enable row level security;
create policy "Admins can insert applications" on public.job_applications
  for insert with check (public.is_admin());
create policy "Admins can view applications" on public.job_applications
  for select using (public.is_admin());
create policy "Admins can update applications" on public.job_applications
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete applications" on public.job_applications
  for delete using (public.is_admin());

alter table public.hr_jobs enable row level security;
create policy "Public can view jobs" on public.hr_jobs
  for select using (true);
create policy "Admins can insert jobs" on public.hr_jobs
  for insert to authenticated with check (public.is_admin());
create policy "Admins can update jobs" on public.hr_jobs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins can delete jobs" on public.hr_jobs
  for delete to authenticated using (public.is_admin());
-- Detail columns stay behind job_details(); visitors only list the summary.
revoke select on public.hr_jobs from anon, authenticated;
grant select (id, title, category, company, location, job_type, experience, salary,
  skills, is_direct_link, created_at) on public.hr_jobs to anon, authenticated;

alter table public.reels enable row level security;
create policy "Public can view reels" on public.reels
  for select using (true);
create policy "Admins can manage reels" on public.reels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

alter table public.candidate_profiles enable row level security;
create policy "Users view own candidate profile" on public.candidate_profiles
  for select using (auth.uid() = user_id);
create policy "Users create own candidate profile" on public.candidate_profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update own candidate profile" on public.candidate_profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Admins view all candidate profiles" on public.candidate_profiles
  for select using (public.is_admin());

alter table public.site_content enable row level security;
create policy "Read published content" on public.site_content
  for select using (true);
create policy "Admins publish content" on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 5. A listing must have a title (only enforced once no blank rows remain).
do $$
begin
  if not exists (select 1 from public.hr_jobs where title is null) then
    alter table public.hr_jobs alter column title set not null;
  else
    raise notice 'hr_jobs still has rows without a title; NOT NULL was not added.';
  end if;
end $$;

-- 6. Enrollment flood control per client IP instead of one global cap that any
--    visitor could exhaust for everyone. IPs are kept for one hour only.
create table if not exists public.enrollment_rate (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists idx_enrollment_rate_ip_at on public.enrollment_rate(ip, at);
alter table public.enrollment_rate enable row level security;
revoke all on public.enrollment_rate from anon, authenticated;

create or replace function public.guard_course_enrollment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);
  v_email text := lower(trim(coalesce(new.email, '')));
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(split_part(v_headers->>'x-forwarded-for', ',', 1), v_headers->>'cf-connecting-ip', 'unknown');
begin
  new.created_at := now();

  if coalesce(trim(new.name), '') = '' or (v_phone = '' and v_email = '') then
    raise exception 'Name and a phone number or email are required.';
  end if;

  if coalesce(new.phone, '') <> '' and coalesce(new.phone, '') !~ '^[0-9+()\s-]{7,30}$' then
    raise exception 'Please enter a valid phone number.';
  end if;

  if char_length(coalesce(new.name, '')) > 200
     or char_length(coalesce(new.email, '')) > 320
     or char_length(coalesce(new.phone, '')) > 30
     or char_length(coalesce(new.enrolled_course, '')) > 200
     or char_length(coalesce(new.qualification, '')) > 200
     or char_length(coalesce(new.learning_mode, '')) > 50
     or char_length(coalesce(new.status, '')) > 100
     or char_length(coalesce(new.batch_time, '')) > 100
     or char_length(coalesce(new.comments, '')) > 2000
     or char_length(coalesce(new.page_url, '')) > 500 then
    raise exception 'Some fields are too long. Please shorten them and try again.';
  end if;

  if public.is_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.course_enrollments e
    where e.created_at > now() - interval '10 minutes'
      and ((v_phone <> '' and right(regexp_replace(coalesce(e.phone, ''), '\D', '', 'g'), 10) = v_phone)
        or (v_email <> '' and lower(trim(coalesce(e.email, ''))) = v_email))
  ) then
    raise exception 'You have already submitted an application. Our team will contact you soon.';
  end if;

  delete from public.enrollment_rate where at < now() - interval '1 hour';
  if (select count(*) from public.enrollment_rate r
      where r.ip = v_ip and r.at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many applications from your network. Please try again in a few minutes.';
  end if;
  insert into public.enrollment_rate(ip) values (v_ip);

  -- Wide safety net against a distributed flood.
  if (select count(*) from public.course_enrollments e
      where e.created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Too many applications are being submitted right now. Please try again in a minute.';
  end if;

  return new;
end;
$$;

-- 7. Resume uploads: cap size and type at the bucket (anonymous uploads are allowed
--    into applications/ only, by the existing storage policy).
update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'resumes';

commit;

-- Verify afterwards (should list only the policies above):
-- select tablename, policyname, cmd, roles from pg_policies where schemaname = 'public' order by 1, 2;
