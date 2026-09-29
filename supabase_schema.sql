create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan text not null default 'free';
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
drop policy if exists "Public can delete jobs" on public.hr_jobs;

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

drop policy if exists "Public can view jobs" on public.hr_jobs;
drop policy if exists "Members can view jobs" on public.hr_jobs;
create policy "Public can view jobs" on public.hr_jobs
  for select to public using (true);

drop policy if exists "Admins can manage jobs" on public.hr_jobs;
create policy "Admins can manage jobs" on public.hr_jobs
  for all using (public.is_admin()) with check (public.is_admin());

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
  for all using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

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

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null default 'created',
  receipt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_orders_user on public.payment_orders(user_id);

alter table public.payment_orders enable row level security;

drop policy if exists "Users view own orders" on public.payment_orders;
create policy "Users view own orders" on public.payment_orders
  for select using (auth.uid() = user_id);

create table if not exists public.student_payments (
  id uuid primary key default gen_random_uuid(),
  user_name text not null,
  user_email text not null,
  phone text,
  amount numeric not null default 499,
  payment_method text not null default 'upi',
  transaction_id text not null,
  status text not null default 'completed',
  features_unlocked text[] default array['resume_pro', 'jobs_unlimited', 'ai_scan', 'interview_prep'],
  page_source text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.student_payments add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.student_payments add column if not exists razorpay_order_id text;

create unique index if not exists uq_student_payments_txn
  on public.student_payments(transaction_id);

alter table public.student_payments enable row level security;

drop policy if exists "Public can submit payments" on public.student_payments;
drop policy if exists "Public can view payments" on public.student_payments;
drop policy if exists "Public can update payments" on public.student_payments;
drop policy if exists "Public can delete payments" on public.student_payments;

drop policy if exists "Users view own payments" on public.student_payments;
create policy "Users view own payments" on public.student_payments
  for select using (auth.uid() = user_id);

drop policy if exists "Admins view all payments" on public.student_payments;
create policy "Admins view all payments" on public.student_payments
  for select using (public.is_admin());

create table if not exists public.manual_payment_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  phone text,
  reference text not null,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);
create unique index if not exists uq_manual_claim_reference
  on public.manual_payment_claims(reference);
create index if not exists idx_manual_claims_status
  on public.manual_payment_claims(status);

alter table public.manual_payment_claims enable row level security;

drop policy if exists "Users view own claims" on public.manual_payment_claims;
create policy "Users view own claims" on public.manual_payment_claims
  for select using (auth.uid() = user_id);

drop policy if exists "Admins view all claims" on public.manual_payment_claims;
create policy "Admins view all claims" on public.manual_payment_claims
  for select using (public.is_admin());

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'career_pro',
  status text not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_payment_id text,
  amount numeric not null default 499,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Admins view all subscriptions" on public.subscriptions;
create policy "Admins view all subscriptions" on public.subscriptions
  for select using (public.is_admin());

create or replace function public.has_active_pass()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = auth.uid()
      and s.status = 'active'
      and s.expires_at > now()
  );
$$;

revoke all on function public.has_active_pass() from public;
grant execute on function public.has_active_pass() to authenticated, service_role;

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
           public.has_active_pass()
           or public.is_admin()
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

alter table public.student_payments
  add column if not exists source text not null default 'razorpay';

create index if not exists idx_student_payments_created
  on public.student_payments(created_at desc);
create index if not exists idx_student_payments_email
  on public.student_payments(user_email);

create or replace view public.payments_overview
with (security_invoker = true)
as
  select
    p.id,
    p.user_id,
    p.user_name,
    p.user_email,
    p.phone,
    p.amount,
    p.source,
    p.payment_method,
    p.transaction_id,
    p.razorpay_order_id,
    p.status            as payment_status,
    p.notes,
    p.created_at        as paid_at,
    s.status            as subscription_status,
    s.expires_at        as access_expires_at,
    (s.status = 'active' and s.expires_at > now()) as access_active
  from public.student_payments p
  left join public.subscriptions s on s.user_id = p.user_id
  order by p.created_at desc;

grant select on public.payments_overview to authenticated;

create or replace view public.my_subscription
with (security_invoker = true)
as
  select user_id, plan, status, started_at, expires_at,
         (status = 'active' and expires_at > now()) as is_active
  from public.subscriptions
  where user_id = auth.uid();

grant select on public.my_subscription to authenticated;

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

create table if not exists public.trial_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null check (feature in ('job_application', 'resume_download')),
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);

alter table public.trial_usage enable row level security;

drop policy if exists "Users view own trial usage" on public.trial_usage;
create policy "Users view own trial usage" on public.trial_usage
  for select using (auth.uid() = user_id);

drop policy if exists "Admins view all trial usage" on public.trial_usage;
create policy "Admins view all trial usage" on public.trial_usage
  for select using (public.is_admin());

create or replace function public.trial_limit(p_feature text)
returns integer
language sql
immutable
as $$
  select 3;
$$;

create or replace function public.consume_trial_credit(p_user_id uuid, p_feature text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used integer;
begin
  insert into public.trial_usage as t (user_id, feature, used, updated_at)
  values (p_user_id, p_feature, 1, now())
  on conflict (user_id, feature) do update
    set used = t.used + 1, updated_at = now()
    where t.used < public.trial_limit(p_feature)
  returning used into v_used;

  if v_used is null then
    return -1;
  end if;
  return public.trial_limit(p_feature) - v_used;
end;
$$;

revoke all on function public.consume_trial_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.consume_trial_credit(uuid, text) to service_role;

create or replace function public.trial_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'is_pro', public.has_active_pass(),
    'limit', public.trial_limit('job_application'),
    'applications_left', greatest(0, public.trial_limit('job_application') - coalesce(
      (select u.used from public.trial_usage u
        where u.user_id = auth.uid() and u.feature = 'job_application'), 0)),
    'downloads_left', greatest(0, public.trial_limit('resume_download') - coalesce(
      (select u.used from public.trial_usage u
        where u.user_id = auth.uid() and u.feature = 'resume_download'), 0)),
    'has_profile', exists (
      select 1 from public.candidate_profiles p where p.user_id = auth.uid())
  ) end;
$$;

revoke all on function public.trial_status() from public;
grant execute on function public.trial_status() to anon, authenticated, service_role;

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
  v_is_pro boolean;
  v_left integer;
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

  v_is_pro := public.has_active_pass() or public.is_admin();
  if not v_is_pro then
    v_left := public.consume_trial_credit(v_uid, 'job_application');
    if v_left < 0 then
      return jsonb_build_object('status', 'trial_exhausted', 'applications_left', 0);
    end if;
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
    'apply_url', v_job.apply_url,
    'is_pro', v_is_pro,
    'applications_left', case when v_is_pro then null else v_left end
  );
end;
$$;

revoke all on function public.apply_to_job(uuid) from public, anon;
grant execute on function public.apply_to_job(uuid) to authenticated, service_role;

update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'afaautomations@gmail.com');
