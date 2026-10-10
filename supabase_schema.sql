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
begin
  insert into public.profiles (id, name, phone)
  values (new.id, new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'phone')
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
revoke insert, update, delete, truncate on public.hr_jobs, public.reels from anon;

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

create or replace function public.job_details(p_job_id uuid)
returns table (
  id uuid,
  title text,
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
  is_direct_link boolean,
  created_at timestamptz
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
           or exists (
             select 1 from public.job_applications a
             where a.user_id = auth.uid() and a.job_id = j.id
           )
         ) then j.apply_url else null end as apply_url,
         j.is_direct_link, j.created_at
  from public.hr_jobs j
  where j.id = p_job_id;
$$;

revoke all on function public.job_details(uuid) from public;
grant execute on function public.job_details(uuid) to anon, authenticated, service_role;

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

create or replace function public.apply_to_job(p_job_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_job public.hr_jobs%rowtype;
  v_profile public.candidate_profiles%rowtype;
  v_application_id uuid;
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

  insert into public.job_applications (
    user_id, job_id, name, whatsapp, email, degree, grad_year, is_student,
    course_name, experience, preferred_location, work_mode, skills,
    job_role, company, page_url, resume_url
  ) values (
    v_uid, p_job_id, v_profile.name, v_profile.whatsapp,
    coalesce(v_profile.email, (select email from auth.users where id = v_uid)),
    v_profile.degree, v_profile.grad_year,
    case when v_profile.is_student then 'Yes' else 'No' end,
    v_profile.course_name, v_profile.experience, v_profile.preferred_location,
    v_profile.work_mode, v_profile.skills, v_job.title, v_job.company,
    'job-details.html?id=' || p_job_id, v_profile.resume_url
  )
  on conflict (user_id, job_id) do nothing
  returning id into v_application_id;

  if v_application_id is null then
    raise exception 'Application already submitted for this job';
  end if;

  return jsonb_build_object(
    'status', 'applied',
    'apply_url', v_job.apply_url
  );
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated, service_role;

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

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'afaautomations@gmail.com');


-- Shared admin publishing workflows
begin;
create table if not exists public.site_content (
  key text primary key check (key in ('kompetenzen_batch_dates', 'kompetenzen_placed_students')),
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
  delete from public.reels;
  insert into public.reels(reel_id, sort_order)
    select r, (ordinality - 1)::int from unnest(p_reels) with ordinality as t(r, ordinality);
end;
$$;
revoke all on function public.replace_reels(text[]) from public;
grant execute on function public.replace_reels(text[]) to authenticated;
commit;
