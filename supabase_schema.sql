create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists role text not null default 'user';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

revoke update on public.profiles from anon, authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := 'user';
begin

  insert into public.profiles (id, name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone',
    v_role
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table if not exists public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  enrolled_course text,
  qualification text,
  learning_mode text,
  status text,
  batch_time text,
  comments text,
  page_url text,
  created_at timestamptz not null default now()
);

alter table public.course_enrollments enable row level security;

drop policy if exists "Public can submit enrollment" on public.course_enrollments;
create policy "Public can submit enrollment" on public.course_enrollments
  for insert with check (true);

drop policy if exists "Public can view enrollments" on public.course_enrollments;

drop policy if exists "Admins can view enrollments" on public.course_enrollments;
create policy "Admins can view enrollments" on public.course_enrollments
  for select using (public.is_admin());

drop policy if exists "Admins can manage enrollments" on public.course_enrollments;
create policy "Admins can manage enrollments" on public.course_enrollments
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete enrollments" on public.course_enrollments;
create policy "Admins can delete enrollments" on public.course_enrollments
  for delete using (public.is_admin());

create index if not exists idx_course_enrollments_created
  on public.course_enrollments(created_at desc);

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

drop trigger if exists guard_course_enrollment on public.course_enrollments;
create trigger guard_course_enrollment
  before insert on public.course_enrollments
  for each row execute function public.guard_course_enrollment();

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  name text,
  whatsapp text,
  email text,
  degree text,
  grad_year text,
  is_student text,
  course_name text,
  experience text,
  preferred_location text,
  work_mode text,
  skills text,
  job_role text,
  company text,
  page_url text,
  resume_url text,
  created_at timestamptz not null default now()
);

alter table public.job_applications add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.job_applications add column if not exists job_id uuid;
create unique index if not exists uq_job_applications_user_job
  on public.job_applications(user_id, job_id);

alter table public.job_applications enable row level security;

drop policy if exists "Public can submit application" on public.job_applications;
drop policy if exists "Admins can insert applications" on public.job_applications;
create policy "Admins can insert applications" on public.job_applications
  for insert with check (public.is_admin());

drop policy if exists "Public can view applications" on public.job_applications;

drop policy if exists "Admins can view applications" on public.job_applications;
create policy "Admins can view applications" on public.job_applications
  for select using (public.is_admin());

drop policy if exists "Admins can update applications" on public.job_applications;
create policy "Admins can update applications" on public.job_applications
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete applications" on public.job_applications;
create policy "Admins can delete applications" on public.job_applications
  for delete using (public.is_admin());

drop policy if exists "Public can delete applications" on public.job_applications;


create table if not exists public.hr_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text,
  company text,
  location text,
  job_type text,
  experience text,
  salary text,
  skills text,
  description text,
  responsibilities text,
  requirements text,
  about_company text,
  apply_url text,
  is_direct_link boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.hr_jobs add column if not exists responsibilities text;
alter table public.hr_jobs add column if not exists requirements text;
alter table public.hr_jobs add column if not exists about_company text;
alter table public.hr_jobs add column if not exists apply_url text;
alter table public.hr_jobs add column if not exists is_direct_link boolean not null default false;

alter table public.hr_jobs enable row level security;
revoke insert, update, delete, truncate on public.hr_jobs from anon;

drop policy if exists "Public can delete jobs" on public.hr_jobs;

drop policy if exists "Public can view jobs" on public.hr_jobs;
drop policy if exists "Members can view jobs" on public.hr_jobs;
create policy "Public can view jobs" on public.hr_jobs
  for select to public using (true);

drop policy if exists "Admins can manage jobs" on public.hr_jobs;
create policy "Admins can manage jobs" on public.hr_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  reel_id text,
  sort_order int,
  created_at timestamptz not null default now()
);

alter table public.reels enable row level security;
revoke insert, update, delete, truncate on public.reels from anon;

drop policy if exists "Public can manage reels" on public.reels;

drop policy if exists "Public can view reels" on public.reels;
create policy "Public can view reels" on public.reels
  for select using (true);

drop policy if exists "Admins can manage reels" on public.reels;
create policy "Admins can manage reels" on public.reels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id = 'resumes';

drop policy if exists "Public can upload resumes" on storage.objects;
drop policy if exists "Public can read resumes" on storage.objects;

drop policy if exists "Anyone can drop an application resume" on storage.objects;
create policy "Anyone can drop an application resume" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'applications'
  );

drop policy if exists "Users upload own resumes" on storage.objects;
create policy "Users upload own resumes" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users read own resumes" on storage.objects;
create policy "Users read own resumes" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Admins read all resumes" on storage.objects;
create policy "Admins read all resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.is_admin());

-- Homepage showcase images (marketing.html). Public URLs need no select policy.
insert into storage.buckets (id, name, public)
values ('site-media', 'site-media', true)
on conflict (id) do update set public = true;
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
where id = 'site-media';

drop policy if exists "Staff read site media" on storage.objects;
create policy "Staff read site media" on storage.objects
  for select to authenticated using (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff upload site media" on storage.objects;
create policy "Staff upload site media" on storage.objects
  for insert to authenticated with check (bucket_id = 'site-media' and public.is_admin());
drop policy if exists "Staff delete site media" on storage.objects;
create policy "Staff delete site media" on storage.objects
  for delete to authenticated using (bucket_id = 'site-media' and public.is_admin());

create table if not exists public.resume_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null default 'modern',
  layout text not null default 'single',
  thumbnail_url text,
  html_content text not null,
  css_content text not null,
  is_ats_safe boolean not null default true,
  is_premium boolean not null default false,
  tags jsonb not null default '[]'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.resume_templates enable row level security;
drop policy if exists "Public can view templates" on public.resume_templates;
create policy "Public can view templates" on public.resume_templates
  for select using (true);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.resume_templates(id),
  title text not null default 'Untitled Resume',
  slug text,
  content jsonb not null default '{}'::jsonb,
  design jsonb not null default '{}'::jsonb,
  section_order jsonb not null default '[]'::jsonb,
  ats_score int default 0,
  ats_feedback jsonb default '[]'::jsonb,
  is_public boolean not null default false,
  last_exported timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_resumes_user on public.resumes(user_id);
alter table public.resumes enable row level security;
drop policy if exists "Users manage own resumes" on public.resumes;
create policy "Users manage own resumes" on public.resumes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Public can view public resumes" on public.resumes;
create policy "Public can view public resumes" on public.resumes
  for select using (is_public = true);

create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes(id) on delete cascade,
  version_num int not null,
  snapshot jsonb not null,
  label text,
  created_at timestamptz not null default now()
);
create index if not exists idx_versions_resume on public.resume_versions(resume_id);
alter table public.resume_versions enable row level security;
drop policy if exists "Users manage own resume versions" on public.resume_versions;
create policy "Users manage own resume versions" on public.resume_versions
  for all
  using (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.resumes r where r.id = resume_id and r.user_id = auth.uid()));

create table if not exists public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  source_type text not null,
  status text not null default 'pending',
  extracted jsonb default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.import_jobs enable row level security;
drop policy if exists "Users manage own import jobs" on public.import_jobs;
create policy "Users manage own import jobs" on public.import_jobs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.writing_tips (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  tip text not null,
  example text,
  tags jsonb default '[]'::jsonb
);
alter table public.writing_tips enable row level security;
drop policy if exists "Public can view tips" on public.writing_tips;
create policy "Public can view tips" on public.writing_tips
  for select using (true);

revoke select on public.hr_jobs from anon, authenticated;
grant select (
  id, title, category, company, location, job_type,
  experience, salary, skills, is_direct_link, created_at
) on public.hr_jobs to anon, authenticated;


create table if not exists public.candidate_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 200),
  whatsapp text not null check (char_length(whatsapp) <= 30),
  email text check (char_length(email) <= 320),
  degree text check (char_length(degree) <= 200),
  grad_year text check (char_length(grad_year) <= 10),
  is_student boolean not null default false,
  course_name text check (char_length(course_name) <= 200),
  experience text check (char_length(experience) <= 100),
  preferred_location text check (char_length(preferred_location) <= 500),
  work_mode text check (char_length(work_mode) <= 50),
  skills text check (char_length(skills) <= 2000),
  resume_url text check (char_length(resume_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Career-stage onboarding fields (migrations/20261011_candidate_onboarding.sql)
alter table public.candidate_profiles
  add column if not exists career_stage text,
  add column if not exists qualification text,
  add column if not exists specialisation text,
  add column if not exists institution text,
  add column if not exists recent_role text,
  add column if not exists industry text,
  add column if not exists challenge_codes text[] not null default '{}',
  add column if not exists challenge_other text;

alter table public.candidate_profiles drop constraint if exists candidate_profiles_onboarding_check;
alter table public.candidate_profiles add constraint candidate_profiles_onboarding_check check (
  (career_stage is null or career_stage in ('studying', 'graduated', 'experienced'))
  and char_length(coalesce(qualification, '')) <= 120
  and char_length(coalesce(specialisation, '')) <= 120
  and char_length(coalesce(institution, '')) <= 200
  and char_length(coalesce(recent_role, '')) <= 80
  and char_length(coalesce(industry, '')) <= 80
  and char_length(coalesce(challenge_other, '')) <= 300
  -- "Select up to 2"
  and coalesce(cardinality(challenge_codes), 0) <= 2
  and char_length(array_to_string(challenge_codes, '|')) <= 100
);

alter table public.candidate_profiles enable row level security;

drop policy if exists "Users view own candidate profile" on public.candidate_profiles;
create policy "Users view own candidate profile" on public.candidate_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "Users create own candidate profile" on public.candidate_profiles;
create policy "Users create own candidate profile" on public.candidate_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own candidate profile" on public.candidate_profiles;
create policy "Users update own candidate profile" on public.candidate_profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Admins view all candidate profiles" on public.candidate_profiles;
create policy "Admins view all candidate profiles" on public.candidate_profiles
  for select using (public.is_admin());


-- ─── Remove the old payment / free-trial system ──────────────────────────────
-- Everything on the site is free now. These drops are safe to re-run. They run
-- after job_details() and apply_to_job() above have been replaced, because the
-- old versions of those called has_active_pass() and consume_trial_credit().
-- Views and functions go first, since they depend on the tables.
drop view if exists public.payments_overview;
drop view if exists public.my_subscription;
drop function if exists public.trial_status();
drop function if exists public.consume_trial_credit(uuid, text);
drop function if exists public.trial_limit(text);
drop function if exists public.has_active_pass();
drop table if exists public.trial_usage;
drop table if exists public.manual_payment_claims;
drop table if exists public.payment_orders;
drop table if exists public.student_payments;
drop table if exists public.subscriptions;
alter table public.profiles drop column if exists plan;

-- Staff access is explicitly granted using staff_emails; no hard-coded admins.


-- Shared admin publishing workflows
begin;
create table if not exists public.site_content (
  key text primary key check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students', 'kompetenzen_showcase')),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;
drop policy if exists "Read published content" on public.site_content;
create policy "Read published content" on public.site_content for select using (true);
drop policy if exists "Admins publish content" on public.site_content;
create policy "Admins publish content" on public.site_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_jobs()
returns setof public.hr_jobs language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return query select * from public.hr_jobs order by created_at desc;
end;
$$;
revoke all on function public.admin_jobs() from public;
grant execute on function public.admin_jobs() to authenticated;

create or replace function public.replace_reels(p_reels text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_reels is null or exists (select 1 from unnest(p_reels) r where r is null or r !~ '^[A-Za-z0-9_-]{6,64}$')
    then raise exception 'Invalid reel ID'; end if;
  -- Serialize complete replacements; an insert failure rolls back the delete.
  lock table public.reels in exclusive mode;
  delete from public.reels where true;
  insert into public.reels(reel_id, sort_order)
    select r, (ordinality - 1)::int from unnest(p_reels) with ordinality as t(r, ordinality);
end;
$$;
revoke all on function public.replace_reels(text[]) from public;
grant execute on function public.replace_reels(text[]) to authenticated;
commit;

-- Job-specific application requirements (migrations/20261011_application_requirements.sql).
-- job_details() and apply_to_job() are defined here.
-- 1. What each listing asks for. Shape:
--    { "resume": bool, "college": bool, "availability": bool, "skills": bool,
--      "portfolio": bool, "salary": bool, "location": bool,
--      "questions": ["...", ...] }   (at most 5 questions)
alter table public.hr_jobs
  add column if not exists application_requirements jsonb not null default '{}'::jsonb;
alter table public.hr_jobs drop constraint if exists hr_jobs_application_requirements_check;
alter table public.hr_jobs add constraint hr_jobs_application_requirements_check check (
  jsonb_typeof(application_requirements) = 'object'
  and (application_requirements->'questions' is null
       or (jsonb_typeof(application_requirements->'questions') = 'array'
           and jsonb_array_length(application_requirements->'questions') <= 5))
  and char_length(application_requirements::text) <= 3000
);

-- 2. The candidate's answers, stored on each application.
alter table public.job_applications
  add column if not exists college text,
  add column if not exists availability text,
  add column if not exists portfolio_url text,
  add column if not exists matched_skills text[] not null default '{}',
  add column if not exists screening_answers jsonb not null default '[]'::jsonb,
  add column if not exists expected_salary text,
  add column if not exists current_location text,
  add column if not exists willing_to_relocate boolean;

-- 3. Job details now include the requirements (return type changes, so recreate).
drop function if exists public.job_details(uuid);
create function public.job_details(p_job_id uuid)
returns table (
  id uuid, title text, category text, company text, location text, job_type text,
  experience text, salary text, skills text, description text, responsibilities text,
  requirements text, about_company text, apply_url text, is_direct_link boolean,
  created_at timestamptz, application_requirements jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.title, j.category, j.company, j.location, j.job_type,
         j.experience, j.salary, j.skills, j.description, j.responsibilities,
         j.requirements, j.about_company,
         case when (
           public.is_admin()
           or exists (select 1 from public.job_applications a
                      where a.user_id = auth.uid() and a.job_id = j.id)
         ) then j.apply_url else null end as apply_url,
         j.is_direct_link, j.created_at, j.application_requirements
  from public.hr_jobs j
  where j.id = p_job_id;
$$;
revoke all on function public.job_details(uuid) from public;
grant execute on function public.job_details(uuid) to anon, authenticated, service_role;

-- 4. Applying checks the listing's requirements on the server.
drop function if exists public.apply_to_job(uuid);
drop function if exists public.apply_to_job(uuid, jsonb);
create function public.apply_to_job(p_job_id uuid, p_responses jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.hr_jobs%rowtype;
  v_profile public.candidate_profiles%rowtype;
  v_req jsonb;
  v_resp jsonb := coalesce(p_responses, '{}'::jsonb);
  v_missing text[] := '{}';
  v_resume text;
  v_college text;
  v_availability text;
  v_portfolio text;
  v_salary text;
  v_location text;
  v_relocate boolean;
  v_skills text[] := '{}';
  v_questions jsonb;
  v_answers jsonb := '[]'::jsonb;
  v_answer text;
  v_application_id uuid;
  i int;
begin
  if v_uid is null then
    return jsonb_build_object('status', 'auth_required');
  end if;

  select * into v_job from public.hr_jobs where id = p_job_id;
  if not found then
    return jsonb_build_object('status', 'job_not_found');
  end if;

  if exists (select 1 from public.job_applications
             where user_id = v_uid and job_id = p_job_id) then
    return jsonb_build_object('status', 'already_applied', 'apply_url', v_job.apply_url);
  end if;

  select * into v_profile from public.candidate_profiles where user_id = v_uid;
  if not found then
    return jsonb_build_object('status', 'profile_required');
  end if;

  if jsonb_typeof(v_resp) <> 'object' then v_resp := '{}'::jsonb; end if;
  v_req := coalesce(v_job.application_requirements, '{}'::jsonb);

  -- Answers given now, falling back to what the profile already holds.
  v_resume := nullif(trim(coalesce(v_resp->>'resume_url', '')), '');
  if v_resume is not null and (v_resume !~ '^applications/[A-Za-z0-9_.-]+$' or char_length(v_resume) > 300) then
    v_resume := null;
  end if;
  v_resume := coalesce(v_resume, v_profile.resume_url);
  v_college := left(coalesce(nullif(trim(coalesce(v_resp->>'college', '')), ''), v_profile.institution), 200);
  v_availability := left(nullif(trim(coalesce(v_resp->>'availability', '')), ''), 100);
  v_portfolio := nullif(trim(coalesce(v_resp->>'portfolio_url', '')), '');
  if v_portfolio is not null and (v_portfolio !~* '^https?://[^\s<>"]+$' or char_length(v_portfolio) > 500) then
    v_portfolio := null;
  end if;
  v_salary := left(nullif(trim(coalesce(v_resp->>'expected_salary', '')), ''), 100);
  v_location := left(nullif(trim(coalesce(v_resp->>'current_location', '')), ''), 120);
  v_relocate := case v_resp->>'willing_to_relocate' when 'true' then true when 'false' then false else null end;
  if jsonb_typeof(v_resp->'matched_skills') = 'array' then
    select coalesce(array_agg(left(s, 60)), '{}') into v_skills
    from (select jsonb_array_elements_text(v_resp->'matched_skills') as s limit 30) t
    where trim(s) <> '';
  end if;

  if coalesce((v_req->>'resume')::boolean, false) and v_resume is null then v_missing := array_append(v_missing, 'resume'); end if;
  if coalesce((v_req->>'college')::boolean, false) and v_college is null then v_missing := array_append(v_missing, 'college'); end if;
  if coalesce((v_req->>'availability')::boolean, false) and v_availability is null then v_missing := array_append(v_missing, 'availability'); end if;
  if coalesce((v_req->>'skills')::boolean, false) and jsonb_typeof(v_resp->'matched_skills') is distinct from 'array' then
    v_missing := array_append(v_missing, 'skills');
  end if;
  if coalesce((v_req->>'portfolio')::boolean, false) and v_portfolio is null then v_missing := array_append(v_missing, 'portfolio'); end if;
  if coalesce((v_req->>'salary')::boolean, false) and v_salary is null then v_missing := array_append(v_missing, 'salary'); end if;
  if coalesce((v_req->>'location')::boolean, false) and (v_location is null or v_relocate is null) then v_missing := array_append(v_missing, 'location'); end if;

  v_questions := case when jsonb_typeof(v_req->'questions') = 'array' then v_req->'questions' else '[]'::jsonb end;
  if jsonb_array_length(v_questions) > 0 then
    for i in 0 .. jsonb_array_length(v_questions) - 1 loop
      v_answer := left(nullif(trim(coalesce(v_resp->'answers'->>i, '')), ''), 1000);
      if v_answer is null then
        v_missing := array_append(v_missing, 'questions');
        exit;
      end if;
      v_answers := v_answers || jsonb_build_array(jsonb_build_object('question', v_questions->>i, 'answer', v_answer));
    end loop;
  end if;

  if cardinality(v_missing) > 0 then
    return jsonb_build_object('status', 'responses_required', 'missing', to_jsonb(v_missing));
  end if;

  insert into public.job_applications (
    user_id, job_id, name, whatsapp, email, degree, grad_year, is_student,
    course_name, experience, preferred_location, work_mode, skills,
    job_role, company, page_url, resume_url,
    college, availability, portfolio_url, matched_skills, screening_answers,
    expected_salary, current_location, willing_to_relocate
  ) values (
    v_uid, p_job_id, v_profile.name, v_profile.whatsapp,
    coalesce(v_profile.email, (select email from auth.users where id = v_uid)),
    v_profile.degree, v_profile.grad_year,
    case when v_profile.is_student then 'Yes' else 'No' end,
    v_profile.course_name, v_profile.experience, v_profile.preferred_location,
    v_profile.work_mode, v_profile.skills, v_job.title, v_job.company,
    'job-details.html?id=' || p_job_id, v_resume,
    v_college, v_availability, v_portfolio, v_skills, v_answers,
    v_salary, v_location, v_relocate
  )
  on conflict (user_id, job_id) do nothing
  returning id into v_application_id;

  if v_application_id is null then
    raise exception 'Application already submitted for this job';
  end if;

  return jsonb_build_object('status', 'applied', 'apply_url', v_job.apply_url);
end;
$$;
revoke all on function public.apply_to_job(uuid, jsonb) from public, anon;
grant execute on function public.apply_to_job(uuid, jsonb) to authenticated, service_role;


-- Apply after 20261011_candidate_onboarding.sql, before publishing the profile form.
-- Total career experience stays in experience; obsolete company tenure was removed.
begin;
alter table public.candidate_profiles
  add column if not exists semester text;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_education_details_check;
alter table public.candidate_profiles add constraint candidate_profiles_education_details_check check (
  char_length(coalesce(semester, '')) <= 40
);
commit;
-- Apply before publishing the expanded step 3 of the candidate profile form.
begin;
alter table public.candidate_profiles
  add column if not exists career_preferences jsonb not null default '{}'::jsonb;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_career_preferences_check;
alter table public.candidate_profiles add constraint candidate_profiles_career_preferences_check
  check (jsonb_typeof(career_preferences) = 'object' and octet_length(career_preferences::text) <= 12000);
commit;

-- Invite-only staff console
-- Run after the existing website schema. This does not send invitations.
-- Existing staff_emails entries are preserved: review them before running.
begin;

create table if not exists public.staff_emails (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);
alter table public.staff_emails enable row level security;
revoke all on public.staff_emails from public, anon, authenticated;
grant all on public.staff_emails to service_role;

create or replace function public.normalize_staff_email()
returns trigger language plpgsql set search_path = public as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;
drop trigger if exists staff_emails_normalize on public.staff_emails;
create trigger staff_emails_normalize before insert or update on public.staff_emails
for each row execute function public.normalize_staff_email();

-- Authorization is checked against a protected list and a verified identity.
-- A domain, user metadata or a manually modified profiles.role is insufficient.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u
    join public.staff_emails s on s.email = lower(u.email)
    where u.id = auth.uid() and u.email_confirmed_at is not null
      and (u.banned_until is null or u.banned_until <= now())
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

-- No signup automatically grants staff access, regardless of email domain.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, phone, role)
  values (new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data->>'phone', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- The old mirrored role is no longer an authorization source.
drop trigger if exists staff_emails_sync_role on public.staff_emails;
drop function if exists public.sync_staff_role();
alter table public.profiles enable row level security;
revoke insert, update, delete on public.profiles from public, anon, authenticated;
revoke update (role), insert (role) on public.profiles from public, anon, authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

-- Defense in depth if broader table privileges are accidentally granted later.
create or replace function public.protect_profile_role()
returns trigger language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.role is distinct from 'user' then
      raise exception 'Role changes require the owner' using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.role is distinct from old.role then
      raise exception 'Role changes require the owner' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before insert or update on public.profiles
for each row execute function public.protect_profile_role();
commit;

-- Automatic applicant matching (20261015_applicant_matching.sql)
-- Run after 20261011_application_requirements.sql and candidate onboarding migrations.
-- Matching runs in the database, never in an applicant browser. No external worker needed.
begin;

alter table public.hr_jobs drop constraint if exists hr_jobs_application_requirements_check;
alter table public.hr_jobs add constraint hr_jobs_application_requirements_check check (
  jsonb_typeof(application_requirements) = 'object'
  and (application_requirements->'questions' is null or
    (jsonb_typeof(application_requirements->'questions') = 'array' and jsonb_array_length(application_requirements->'questions') <= 5))
  and char_length(application_requirements::text) <= 12000
);

create or replace function public.match_normalize(v text) returns text
language sql immutable set search_path = public as $$ select lower(regexp_replace(trim(coalesce(v, '')), '\s+', ' ', 'g')); $$;

-- Pure evaluator. Only these allowlisted evidence fields participate.
create or replace function public.evaluate_applicant_match(r jsonb, e jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  s jsonb; k text; options jsonb; actual text; hit boolean; confirmed boolean;
  failed boolean := false; unknown boolean := false; reasons jsonb := '[]';
  total_importance numeric := 0; matched_importance numeric := 0;
  academic_count int := 0; academic_hits int := 0;
  sw numeric; aw numeric; ew numeric; unused numeric := 0;
  sp numeric := 0; ap numeric := 0; ep numeric := 0;
  months numeric; minimum numeric; preferred numeric; status text;
begin
  if r is null or r = '{}'::jsonb then return jsonb_build_object('status','unconfigured','score',null,'reasons',jsonb_build_array('HR must configure structured matching requirements.')); end if;
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'skills') is distinct from 'array' or jsonb_array_length(r->'skills') > 30 then raise exception 'Invalid matching skills'; end if;
  sw := (r->'weights'->>'skills')::numeric; aw := (r->'weights'->>'academics')::numeric; ew := (r->'weights'->>'experience')::numeric;
  if sw is null or aw is null or ew is null or sw < 0 or aw < 0 or ew < 0 or sw+aw+ew <> 100 or trunc(sw) <> sw or trunc(aw) <> aw or trunc(ew) <> ew then raise exception 'Matching weights must total 100 and use whole numbers'; end if;
  minimum := (r->>'minimumMonths')::numeric; preferred := (r->>'preferredMonths')::numeric;
  if minimum is null or preferred is null or minimum < 0 or preferred < 0 or minimum > 600 or preferred > 600 or trunc(minimum) <> minimum or trunc(preferred) <> preferred then raise exception 'Invalid experience target'; end if;
  if (minimum > 0 or preferred > 0) and nullif(trim(r->>'experienceScope'),'') is null then raise exception 'Define relevant experience'; end if;
  if jsonb_typeof(e->'relevantMonths') = 'number' then months := (e->>'relevantMonths')::numeric; end if;
  -- Experience is valid only for the exact scope that the applicant confirmed.
  if months < 0 or months > 600 or trunc(months) <> months or e->>'experienceScope' is distinct from r->>'experienceScope' then months := null; end if;
  -- Academic eligibility before ranking; no institution, prestige or degree hierarchy.
  foreach k in array array['qualifications','specialisations','preferredQualifications','preferredSpecialisations'] loop
    options := r->k;
    if jsonb_typeof(options) is distinct from 'array' then raise exception 'Invalid academic criteria'; end if;
    actual := public.match_normalize(e->>case when k in ('qualifications','preferredQualifications') then 'qualification' else 'specialisation' end);
    if jsonb_array_length(options) > 0 then
      hit := actual <> '' and exists(select 1 from jsonb_array_elements_text(options) x where public.match_normalize(x) = actual);
      if k like 'preferred%' then
        academic_count := academic_count + 1;
        if hit then academic_hits := academic_hits + 1; end if;
        reasons := reasons || jsonb_build_array(k || ': ' || case when hit then 'demonstrated' else 'no demonstrated bonus' end);
      elsif actual = '' then unknown := true; reasons := reasons || jsonb_build_array(k || ': information missing');
      elsif not hit then failed := true; reasons := reasons || jsonb_build_array(k || ': does not meet accepted alternatives');
      else reasons := reasons || jsonb_build_array(k || ': requirement met'); end if;
    end if;
  end loop;
  if (select count(*) <> count(distinct public.match_normalize(x->>'name')) from jsonb_array_elements(r->'skills') x) then raise exception 'Duplicate matching skills'; end if;
  for s in select value from jsonb_array_elements(r->'skills') loop
    if nullif(public.match_normalize(s->>'name'),'') is null or jsonb_typeof(s->'essential') is distinct from 'boolean' or (s->>'importance')::numeric is null or (s->>'importance')::numeric <= 0 or (s->>'importance')::numeric > 100 then raise exception 'Invalid skill rule'; end if;
    total_importance := total_importance + (s->>'importance')::numeric;
    -- An explicit answer overrides the older profile. An unlisted skill alone is unknown.
    confirmed := exists(select 1 from jsonb_array_elements_text(coalesce(e->'confirmedSkills','[]')) x where public.match_normalize(x) = public.match_normalize(s->>'name'));
    hit := exists(select 1 from jsonb_array_elements_text(case when confirmed then coalesce(e->'selectedSkills','[]') else coalesce(e->'skills','[]') end) x where public.match_normalize(x) = public.match_normalize(s->>'name'));
    if hit then matched_importance := matched_importance + (s->>'importance')::numeric;
    elsif (s->>'essential')::boolean then
      if confirmed then failed := true; else unknown := true; end if;
    end if;
    reasons := reasons || jsonb_build_array((s->>'name') || ': ' || case when hit then 'self-declared skill present' when not (s->>'essential')::boolean then 'no demonstrated bonus' when confirmed then 'essential skill explicitly not selected' else 'essential skill needs confirmation' end);
  end loop;
  if minimum > 0 then
    if months is null then unknown := true; reasons := reasons || jsonb_build_array('Relevant experience: information missing');
    elsif months < minimum then failed := true; reasons := reasons || jsonb_build_array('Relevant experience: below essential ' || minimum || ' months');
    else reasons := reasons || jsonb_build_array('Relevant experience: essential minimum met'); end if;
  end if;
  -- Transfer inactive components to the first active component in this documented order.
  if total_importance = 0 then unused := unused + sw; sw := 0; end if;
  if academic_count = 0 then unused := unused + aw; aw := 0; end if;
  if preferred = 0 then unused := unused + ew; ew := 0; end if;
  if total_importance > 0 then sw := sw + unused;
  elsif academic_count > 0 then aw := aw + unused;
  elsif preferred > 0 then ew := ew + unused; end if;
  status := case when failed then 'not_matched' when unknown then 'needs_information' else 'matched' end;
  if status = 'matched' then
    if total_importance > 0 then sp := round(matched_importance / total_importance * sw, 1); end if;
    if academic_count > 0 then ap := round(academic_hits::numeric / academic_count * aw, 1); end if;
    if preferred > 0 and months is not null then ep := round(least(months / preferred, 1) * ew, 1); end if;
  end if;
  if preferred > 0 then reasons := reasons || jsonb_build_array('Preferred experience: ' || coalesce(months::text,'unknown') || ' / ' || preferred || ' relevant months; missing optional evidence earns no bonus'); end if;
  return jsonb_build_object('status',status,'score',case when status = 'matched' then sp+ap+ep else null end,
    'components',case when status = 'matched' then jsonb_build_object('skills',jsonb_build_object('points',sp,'weight',sw),'academics',jsonb_build_object('points',ap,'weight',aw),'experience',jsonb_build_object('points',ep,'weight',ew)) else '{}'::jsonb end,
    'reasons',reasons,'evidence','candidate_provided','profileUpdatedAt',e->'profileUpdatedAt','rules',r);
end; $$;

alter table public.job_applications add column if not exists matching_evidence jsonb not null default '{}',
  add column if not exists submitted_matching_evidence jsonb not null default '{}',
  add column if not exists match_result jsonb not null default '{"status":"pending"}',
  add column if not exists match_calculated_at timestamptz;
create index if not exists job_applications_match_order on public.job_applications(job_id, (match_result->>'status'), ((match_result->>'score')::numeric) desc, created_at, id);

create or replace function public.calculate_application_match() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; p jsonb;
begin
  select application_requirements->'matching' into r from public.hr_jobs where id = new.job_id for share;
  if tg_op = 'INSERT' or new.matching_evidence = '{}'::jsonb then
    select to_jsonb(c) into p from public.candidate_profiles c where user_id = new.user_id;
    new.matching_evidence := jsonb_build_object('qualification',coalesce(p->>'qualification',new.degree),'specialisation',p->>'specialisation',
      'skills',to_jsonb(regexp_split_to_array(coalesce(new.skills,''), '\s*,\s*')), 'snapshotAt',now());
  end if;
  new.match_result := public.evaluate_applicant_match(r,new.matching_evidence);
  if new.submitted_matching_evidence = '{}'::jsonb then new.submitted_matching_evidence := new.matching_evidence; end if;
  new.match_calculated_at := now();
  return new;
end; $$;
drop trigger if exists calculate_application_match on public.job_applications;
create trigger calculate_application_match before insert or update on public.job_applications
for each row execute function public.calculate_application_match();

create or replace function public.refresh_job_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.application_requirements->'matching' is distinct from old.application_requirements->'matching' then
    perform public.evaluate_applicant_match(new.application_requirements->'matching','{}');
    update public.job_applications set match_calculated_at = null where job_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_job_matches on public.hr_jobs;
create trigger refresh_job_matches after update of application_requirements on public.hr_jobs
for each row execute function public.refresh_job_matches();
create or replace function public.validate_job_matching() returns trigger
language plpgsql set search_path = public as $$
begin
  perform public.evaluate_applicant_match(new.application_requirements->'matching','{}');
  return new;
end; $$;
drop trigger if exists validate_job_matching on public.hr_jobs;
create trigger validate_job_matching before insert or update of application_requirements on public.hr_jobs
for each row execute function public.validate_job_matching();

-- Preserve existing submission validation, authentication and duplicate protection.
do $$ begin
  if to_regprocedure('public.apply_to_job_before_matching(uuid,jsonb)') is null then
    alter function public.apply_to_job(uuid,jsonb) rename to apply_to_job_before_matching;
  end if;
end $$;
revoke all on function public.apply_to_job_before_matching(uuid,jsonb) from public, anon, authenticated;
create or replace function public.apply_to_job(p_job_id uuid, p_responses jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; answer jsonb; result jsonb; m jsonb; existing uuid;
begin
  if auth.uid() is null then return jsonb_build_object('status','auth_required'); end if;
  select id into existing from public.job_applications where job_id = p_job_id and user_id = auth.uid();
  if existing is not null then return public.apply_to_job_before_matching(p_job_id,p_responses); end if;
  if not exists(select 1 from public.candidate_profiles where user_id = auth.uid()) then return jsonb_build_object('status','profile_required'); end if;
  select application_requirements->'matching' into r from public.hr_jobs where id = p_job_id for share;
  if r is not null and r <> '{}'::jsonb then
    answer := p_responses->'matching';
    if answer is null or jsonb_typeof(answer) <> 'object' or answer->'confirmed' is distinct from 'true'::jsonb or answer->'rules' is distinct from r then
      return jsonb_build_object('status','responses_required','missing',jsonb_build_array('matching'),'matching_rules',r);
    end if;
    if jsonb_typeof(answer->'selectedSkills') is distinct from 'array' or jsonb_array_length(answer->'selectedSkills') > 30 then raise exception 'Invalid skill confirmation'; end if;
    if answer->'relevantMonths' is not null and answer->'relevantMonths' <> 'null'::jsonb then
      if jsonb_typeof(answer->'relevantMonths') <> 'number' or (answer->>'relevantMonths')::numeric < 0 or (answer->>'relevantMonths')::numeric > 600 or trunc((answer->>'relevantMonths')::numeric) <> (answer->>'relevantMonths')::numeric then raise exception 'Invalid experience months'; end if;
    end if;
  end if;
  result := public.apply_to_job_before_matching(p_job_id,p_responses);
  -- Do not mutate a duplicate application, including concurrent duplicate submissions.
  if result->>'status' = 'applied' and answer is not null then
    m := jsonb_build_object('confirmedSkills',(select coalesce(jsonb_agg(x->>'name'),'[]') from jsonb_array_elements(r->'skills') x),
      'selectedSkills',answer->'selectedSkills','relevantMonths',answer->'relevantMonths','experienceScope',r->>'experienceScope');
    update public.job_applications set matching_evidence = matching_evidence || m, submitted_matching_evidence = matching_evidence || m where job_id = p_job_id and user_id = auth.uid();
  end if;
  return result;
end; $$;
revoke all on function public.apply_to_job(uuid,jsonb) from public;
grant execute on function public.apply_to_job(uuid,jsonb) to authenticated;

-- Server-side status filtering, score ordering and pagination. The caller must be staff.
create or replace function public.admin_matched_applicants(p_job_id uuid, p_status text default 'matched', p_offset int default 0, p_limit int default 25) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Staff access required'; end if;
  if p_status not in ('all','matched','needs_information','not_matched','unconfigured','pending') or p_offset < 0 or p_limit < 1 or p_limit > 100 then raise exception 'Invalid applicant query'; end if;
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(t)) from (
    select a.* from public.job_applications a where (a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id))) and (p_status = 'all' or a.match_result->>'status' = p_status)
    order by case when a.match_result->>'status' = 'matched' then 0 else 1 end, (a.match_result->>'score')::numeric desc nulls last, a.created_at, a.id
    offset p_offset limit p_limit) t),'[]'),
    'total',(select count(*) from public.job_applications a where (a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id))) and (p_status = 'all' or a.match_result->>'status' = p_status)),
    'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select a.match_result->>'status' status,count(*) n from public.job_applications a where a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id)) group by 1) c)) into result;
  return result;
end; $$;
revoke all on function public.admin_matched_applicants(uuid,text,int,int) from public;
grant execute on function public.admin_matched_applicants(uuid,text,int,int) to authenticated;

create or replace function public.admin_matching_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff access required'; end if;
  return jsonb_build_object('jobs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
    select j.*, (select count(*) from public.job_applications a where a.job_id = j.id) as applicant_count,
      (select count(*) from public.job_applications a where a.job_id = j.id and a.match_result->>'status' = 'matched') as matched_count,
      (select count(*) from public.job_applications a where a.job_id = j.id and a.match_result->>'status' = 'needs_information') as needs_information_count
    from public.hr_jobs j order by j.created_at desc) t),
    'total',(select count(*) from public.job_applications),
    'other',(select count(*) from public.job_applications a where not exists(select 1 from public.hr_jobs j where j.id = a.job_id)));
end; $$;
revoke all on function public.admin_matching_overview() from public;
grant execute on function public.admin_matching_overview() to authenticated;
revoke all on function public.calculate_application_match(), public.refresh_job_matches(), public.validate_job_matching() from public;

create or replace function public.refresh_profile_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.qualification,new.specialisation,new.skills) is distinct from (old.qualification,old.specialisation,old.skills) then
    update public.job_applications set matching_evidence =
      (case when new.skills is distinct from old.skills then matching_evidence - 'confirmedSkills' - 'selectedSkills' else matching_evidence end)
      || jsonb_build_object('qualification',new.qualification,'specialisation',new.specialisation,
          'skills',to_jsonb(regexp_split_to_array(coalesce(new.skills,''),'\s*,\s*')),'profileUpdatedAt',now())
    where user_id = new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_profile_matches on public.candidate_profiles;
create trigger refresh_profile_matches after update of qualification,specialisation,skills on public.candidate_profiles for each row execute function public.refresh_profile_matches();
revoke all on function public.refresh_profile_matches() from public;

-- Existing evidence is retained as a snapshot; unknown skills are never treated as a No.
update public.job_applications set match_calculated_at = null;
commit;

-- Career-profile matching (20261015_career_matching.sql)
-- Apply after 20261015_applicant_matching.sql. Replaces legacy skills as evidence.
begin;
alter table public.candidate_profiles add column if not exists career_preferences jsonb not null default '{}';

do $$ begin
  if to_regprocedure('public.evaluate_applicant_match_core(jsonb,jsonb)') is null then
    alter function public.evaluate_applicant_match(jsonb,jsonb) rename to evaluate_applicant_match_core;
  end if;
end $$;

create or replace function public.evaluate_applicant_match(r jsonb,e jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  career jsonb := coalesce(e->'career','{}');
  evidence jsonb; rules jsonb; result jsonb; skills jsonb; skill_rules jsonb;
  reasons jsonb := '[]'; k text; actual text; required text;
  failed boolean := false; unknown boolean := false;
begin
  if r is null or r = '{}'::jsonb then return public.evaluate_applicant_match_core(r,'{}'); end if;
  if jsonb_typeof(career) is distinct from 'object' then career := '{}'; end if;
  if r ? 'softSkills' and jsonb_typeof(r->'softSkills') is distinct from 'array' then raise exception 'Invalid soft skill rules'; end if;
  -- Namespaces prevent a technical skill and a soft skill being counted as one.
  select coalesce(jsonb_agg(x || jsonb_build_object('name','Soft skill: ' || (x->>'name'))),'[]') into skill_rules
  from jsonb_array_elements(coalesce(r->'softSkills','[]')) x;
  rules := r || jsonb_build_object('skills',coalesce(r->'skills','[]') || skill_rules);
  if jsonb_array_length(rules->'skills') > 30 then raise exception 'Use at most 30 technical and soft skill requirements combined'; end if;
  select coalesce(jsonb_agg(value),'[]') into skills from (
    select value from jsonb_array_elements_text(case when jsonb_typeof(career->'skills') = 'array' then career->'skills' else '[]' end)
    where public.match_normalize(value) not in ('','i don''t know yet','i don’t know yet')
    union all
    select 'Soft skill: ' || value from jsonb_array_elements_text(case when jsonb_typeof(career->'softSkills') = 'array' then career->'softSkills' else '[]' end)
    where public.match_normalize(value) not in ('','i don''t know yet','i don’t know yet')
  ) s;
  -- Only profile career selections count. Ignore legacy skills and job checkbox answers.
  evidence := (e - 'skills' - 'confirmedSkills' - 'selectedSkills') || jsonb_build_object('skills',skills);
  result := public.evaluate_applicant_match_core(rules,evidence);
  foreach k in array array['careerArea','careerField'] loop
    required := public.match_normalize(r->>k);
    actual := public.match_normalize(career->>case when k = 'careerArea' then 'area' else 'field' end);
    if required <> '' then
      if actual = '' or actual in ('i don''t know yet','i don’t know yet') then
        unknown := true; reasons := reasons || jsonb_build_array(case when k = 'careerArea' then 'Career interest' else 'Career field' end || ': information missing');
      elsif actual <> required then
        failed := true; reasons := reasons || jsonb_build_array(case when k = 'careerArea' then 'Career interest' else 'Career field' end || ': does not meet the configured requirement');
      else reasons := reasons || jsonb_build_array(case when k = 'careerArea' then 'Career interest' else 'Career field' end || ': requirement met'); end if;
    end if;
  end loop;
  if failed or result->>'status' = 'not_matched' then
    result := result || '{"status":"not_matched","score":null,"components":{}}';
  elsif unknown or result->>'status' = 'needs_information' then
    result := result || '{"status":"needs_information","score":null,"components":{}}';
  end if;
  return result || jsonb_build_object('rules',r,'reasons',reasons || (result->'reasons'),'source','career_preferences');
end; $$;

create or replace function public.calculate_application_match() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; p jsonb; career jsonb;
begin
  select application_requirements->'matching' into r from public.hr_jobs where id = new.job_id for share;
  select to_jsonb(c) into p from public.candidate_profiles c where user_id = new.user_id;
  career := coalesce(p->'career_preferences','{}');
  -- Keep only the four approved career fields, never experience/offer preference.
  career := jsonb_build_object('area',career->'area','field',career->'field','skills',career->'skills','softSkills',career->'softSkills');
  new.matching_evidence := (new.matching_evidence - 'skills' - 'confirmedSkills' - 'selectedSkills') || jsonb_build_object(
    'career',career,'qualification',p->>'qualification','specialisation',p->>'specialisation');
  new.match_result := public.evaluate_applicant_match(r,new.matching_evidence);
  if new.submitted_matching_evidence = '{}' then new.submitted_matching_evidence := new.matching_evidence; end if;
  new.match_calculated_at := now();
  return new;
end; $$;

create or replace function public.refresh_profile_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.qualification,new.specialisation,new.career_preferences->'area',new.career_preferences->'field',new.career_preferences->'skills',new.career_preferences->'softSkills')
    is distinct from (old.qualification,old.specialisation,old.career_preferences->'area',old.career_preferences->'field',old.career_preferences->'skills',old.career_preferences->'softSkills') then
    update public.job_applications set matching_evidence = matching_evidence || jsonb_build_object('profileUpdatedAt',now()) where user_id = new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_profile_matches on public.candidate_profiles;
create trigger refresh_profile_matches after update of qualification,specialisation,career_preferences on public.candidate_profiles
for each row execute function public.refresh_profile_matches();

-- Old application-form skill checkboxes must not affect new submissions.
update public.hr_jobs set application_requirements = (application_requirements - 'skills') ||
  case when application_requirements ? 'matching' then jsonb_build_object('matching',(application_requirements->'matching') || '{"source":"career_preferences","version":2}') else '{}' end;
update public.job_applications set match_calculated_at = null;
revoke all on function public.calculate_application_match(), public.refresh_profile_matches() from public;
commit;

-- Email and WhatsApp notification outbox (20261015_notifications.sql)
-- Run after 20261015_career_matching.sql. Network delivery runs separately.
begin;
create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  whatsapp_number text not null default '',
  job_digest text not null default 'off' check (job_digest in ('off','daily','weekly')),
  consent_at timestamptz not null default now(),
  digest_since timestamptz not null default now(),
  check (not whatsapp_enabled or whatsapp_number ~ '^\+[1-9][0-9]{7,14}$')
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
drop policy if exists "Read own notification preferences" on public.notification_preferences;
create policy "Read own notification preferences" on public.notification_preferences for select to authenticated using (user_id=auth.uid());
create or replace function public.save_notification_preferences(p_email boolean,p_whatsapp boolean,p_number text,p_digest text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  insert into public.notification_preferences(user_id,email_enabled,whatsapp_enabled,whatsapp_number,job_digest)
  values(auth.uid(),p_email,p_whatsapp,trim(p_number),p_digest)
  on conflict(user_id) do update set email_enabled=p_email,whatsapp_enabled=p_whatsapp,
    whatsapp_number=trim(p_number),job_digest=p_digest,consent_at=now();
end; $$;
revoke all on function public.save_notification_preferences(boolean,boolean,text,text) from public;
grant execute on function public.save_notification_preferences(boolean,boolean,text,text) to authenticated;

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  channel text not null check(channel in ('email','whatsapp')),
  payload jsonb not null,
  delivery jsonb,
  state text not null default 'pending' check(state in ('pending','sending','accepted','cancelled','failed','review')),
  attempts int not null default 0,
  available_at timestamptz not null default now(),
  started_at timestamptz,
  first_attempt_at timestamptz,
  provider_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(event_key,channel)
);
alter table public.notification_queue enable row level security;
revoke all on public.notification_queue from anon,authenticated;
grant all on public.notification_queue to service_role;
grant all on public.notification_preferences to service_role;
create index if not exists notification_pending on public.notification_queue(available_at) where state='pending';

create or replace function public.enqueue_notification(u uuid,k text,p jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.notification_queue(user_id,event_key,channel,payload)
  select u,k,c,p from public.notification_preferences n
  cross join lateral (select 'email' c where n.email_enabled union all select 'whatsapp' where n.whatsapp_enabled) channels
  where n.user_id=u on conflict(event_key,channel) do nothing;
end; $$;

alter table public.job_applications add column if not exists hr_status text not null default 'received'
  check(hr_status in ('received','under_review','shortlisted','interview','selected','rejected'));
create or replace function public.application_notifications() returns trigger
language plpgsql security definer set search_path=public as $$
declare p jsonb;
begin
  p:=jsonb_build_object('job_id',new.job_id,'title',coalesce(new.job_role,'your application'));
  if tg_op='INSERT' then
    perform public.enqueue_notification(new.user_id,new.id||':received',p||'{"event":"received"}');
  end if;
  if tg_op='INSERT' or new.match_result->>'status' is distinct from old.match_result->>'status' then
    if new.match_result->>'status' in ('matched','not_matched') then
      perform public.enqueue_notification(new.user_id,new.id||':'||(new.match_result->>'status'),
        p||jsonb_build_object('event',new.match_result->>'status','reasons',new.match_result->'reasons'));
    end if;
  end if;
  if tg_op='UPDATE' and new.hr_status is distinct from old.hr_status then
    perform public.enqueue_notification(new.user_id,new.id||':hr:'||gen_random_uuid(),
      p||jsonb_build_object('event','hr_status','status',new.hr_status));
  end if;
  return new;
end; $$;
drop trigger if exists application_notifications on public.job_applications;
create trigger application_notifications after insert or update on public.job_applications for each row execute function public.application_notifications();

-- Only new jobs that pass the same eligibility evaluator and score >=70 enter a digest.
-- Missing optional evidence earns no bonus; missing essential evidence never qualifies.
create or replace function public.queue_job_digests() returns void
language plpgsql security definer set search_path=public as $$
declare n record; jobs jsonb; cutoff timestamptz:=now();
begin
  for n in select pref.*,to_jsonb(p) profile from public.notification_preferences pref
    join public.candidate_profiles p using(user_id)
    where pref.job_digest<>'off' and (pref.email_enabled or pref.whatsapp_enabled)
    and pref.digest_since <= cutoff-case when pref.job_digest='daily' then interval '1 day' else interval '7 days' end
    order by pref.digest_since limit 100 for update of pref skip locked
  loop
    select jsonb_agg(jsonb_build_object('id',id,'title',title)) into jobs from (
      select j.id,j.title from public.hr_jobs j
      cross join lateral (select public.evaluate_applicant_match(j.application_requirements->'matching',
        jsonb_build_object('career',n.profile->'career_preferences','qualification',n.profile->>'qualification','specialisation',n.profile->>'specialisation')) result) m
      where j.created_at>n.digest_since and j.created_at<=cutoff
      and m.result->>'status'='matched' and (m.result->>'score')::numeric>=70
      and not exists(select 1 from public.job_applications a where a.user_id=n.user_id and a.job_id=j.id)
      order by (m.result->>'score')::numeric desc,j.created_at desc limit 10
    ) suitable;
    if jobs is not null then
      perform public.enqueue_notification(n.user_id,n.user_id||':digest:'||cutoff,
        jsonb_build_object('event','digest','jobs',jobs,'title','New opportunities matching your profile'));
    end if;
    update public.notification_preferences set digest_since=cutoff where user_id=n.user_id;
  end loop;
end; $$;

create or replace function public.notification_alternatives(p_user uuid,p_exclude uuid) returns jsonb
language sql security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title)),'[]') from (
    select j.id,j.title from public.hr_jobs j join public.candidate_profiles p on p.user_id=p_user
    cross join lateral (select public.evaluate_applicant_match(j.application_requirements->'matching',jsonb_build_object(
      'career',p.career_preferences,'qualification',p.qualification,'specialisation',p.specialisation)) result) m
    where j.id is distinct from p_exclude and m.result->>'status'='matched' and (m.result->>'score')::numeric>=70
    and not exists(select 1 from public.job_applications a where a.user_id=p_user and a.job_id=j.id)
    order by (m.result->>'score')::numeric desc,j.created_at desc limit 3
  ) suitable
$$;
revoke all on function public.notification_alternatives(uuid,uuid) from public,anon,authenticated;
grant execute on function public.notification_alternatives(uuid,uuid) to service_role;

create or replace function public.claim_notification() returns setof public.notification_queue
language plpgsql security definer set search_path=public as $$
begin
  -- A crashed sender may have reached its provider: never blindly send again.
  update public.notification_queue set state='review',last_error='Sender interrupted; reconcile with provider before retrying'
    where state='sending' and started_at<now()-interval '10 minutes';
  return query update public.notification_queue q set state='sending',attempts=attempts+1,started_at=now(),first_attempt_at=coalesce(first_attempt_at,now())
    where q.id=(select id from public.notification_queue where state='pending' and available_at<=now()
    order by created_at,id for update skip locked limit 1) returning q.*;
end; $$;
revoke all on function public.enqueue_notification(uuid,text,jsonb),public.application_notifications(),public.queue_job_digests(),public.claim_notification() from public,anon,authenticated;
grant execute on function public.queue_job_digests(),public.claim_notification() to service_role;
commit;

-- Internship profile answers (migrations/20261027_internship_profile.sql)
begin;
alter table public.candidate_profiles
  add column if not exists internship_preferences jsonb not null default '{}'::jsonb;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_internship_preferences_check;
alter table public.candidate_profiles add constraint candidate_profiles_internship_preferences_check
  check (jsonb_typeof(internship_preferences) = 'object' and octet_length(internship_preferences::text) <= 4000);
commit;

-- Career consultation bookings (see migrations/20261028_consultation_requests.sql).
create table if not exists public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  situation text not null,
  page_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);
create index if not exists idx_consultation_requests_created
  on public.consultation_requests(created_at desc);

alter table public.consultation_requests enable row level security;
revoke all on public.consultation_requests from anon, authenticated;
grant insert on public.consultation_requests to anon, authenticated;
grant select, update, delete on public.consultation_requests to authenticated;

drop policy if exists "Public can request a consultation" on public.consultation_requests;
create policy "Public can request a consultation" on public.consultation_requests
  for insert to anon, authenticated with check (true);
drop policy if exists "Staff view consultation requests" on public.consultation_requests;
create policy "Staff view consultation requests" on public.consultation_requests
  for select to authenticated using (public.is_admin());
drop policy if exists "Staff update consultation requests" on public.consultation_requests;
create policy "Staff update consultation requests" on public.consultation_requests
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "Staff delete consultation requests" on public.consultation_requests;
create policy "Staff delete consultation requests" on public.consultation_requests
  for delete to authenticated using (public.is_admin());

create table if not exists public.consultation_rate (
  ip text not null,
  at timestamptz not null default now()
);
create index if not exists idx_consultation_rate_ip_at on public.consultation_rate(ip, at);
alter table public.consultation_rate enable row level security;
revoke all on public.consultation_rate from anon, authenticated;

-- Validates every request and limits repeats and floods (same approach as guard_course_enrollment).
create or replace function public.guard_consultation_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_ip text := coalesce(split_part(v_headers->>'x-forwarded-for', ',', 1), v_headers->>'cf-connecting-ip', 'unknown');
begin
  new.created_at := now();
  new.name := btrim(coalesce(new.name, ''));
  if not public.is_admin() then new.status := 'new'; end if;

  if new.name = '' or char_length(new.name) > 100 then
    raise exception 'Please enter your name.';
  end if;
  if coalesce(new.phone, '') !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'Please enter a valid 10-digit mobile number.';
  end if;
  if new.situation is null or new.situation not in
     ('Final Year Student', 'Fresh Graduate', 'Job Seeker', 'Working Professional') then
    raise exception 'Please choose what best describes you.';
  end if;
  if char_length(coalesce(new.page_url, '')) > 500 then
    new.page_url := left(new.page_url, 500);
  end if;

  if public.is_admin() then
    return new;
  end if;

  if exists (
    select 1 from public.consultation_requests c
    where c.phone = new.phone and c.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'You have already requested a consultation. Our team will contact you soon.';
  end if;

  delete from public.consultation_rate where at < now() - interval '1 hour';
  if (select count(*) from public.consultation_rate r
      where r.ip = v_ip and r.at > now() - interval '10 minutes') >= 5 then
    raise exception 'Too many requests from your network. Please try again in a few minutes.';
  end if;
  insert into public.consultation_rate(ip) values (v_ip);

  -- Wide safety net against a distributed flood.
  if (select count(*) from public.consultation_requests c
      where c.created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Too many requests are being sent right now. Please try again in a minute.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_consultation_request on public.consultation_requests;
create trigger guard_consultation_request
  before insert on public.consultation_requests
  for each row execute function public.guard_consultation_request();

-- Applications no longer ask for a portfolio link or current location (20261029).
-- apply_to_job() still honours these flags, so clear them on every existing listing.
update public.hr_jobs
set application_requirements = application_requirements || '{"portfolio":false,"location":false}'::jsonb
where coalesce((application_requirements->>'portfolio')::boolean, false)
   or coalesce((application_requirements->>'location')::boolean, false);

-- Candidate age, asked next to the name on the profile forms (20261029).
alter table public.candidate_profiles add column if not exists age smallint;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_age_check;
alter table public.candidate_profiles add constraint candidate_profiles_age_check
  check (age is null or age between 15 and 70);
