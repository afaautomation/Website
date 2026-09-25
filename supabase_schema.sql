-- =========================================================================
-- KOMPETENZEN WEBSITE — SUPABASE SCHEMA
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.
--
-- SECURITY MODEL
-- ----------------------------------------------------------------------
-- The anon/publishable key is embedded in supabase-config.js and is visible
-- to anyone. Therefore the anon role is treated as HOSTILE:
--   * It may INSERT leads/applications (public forms) and nothing else.
--   * It may never SELECT anyone's personal data, payments or subscriptions.
--   * It may never write entitlement (`subscriptions`, `student_payments`).
-- Reading PII and granting paid access are done exclusively by the backend
-- using the SERVICE ROLE key, which bypasses RLS and never leaves the server.
-- =========================================================================

-- ---------------------------------------------------------------------
-- 0. ADMIN IDENTITY HELPERS
-- ---------------------------------------------------------------------
-- Staff are identified by profiles.role = 'admin'. This column can only be
-- set with the service role key (or from the Supabase SQL editor) — see the
-- column-level grants further down, which stop users editing their own role.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  phone text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists plan text not null default 'free';
alter table public.profiles add column if not exists role text not null default 'user';

-- is_admin() is SECURITY DEFINER so it can read profiles.role without the
-- caller needing select rights on other rows. Used by policies below.
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
-- ---------------------------------------------------------------------
-- 1. PROFILES
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

-- Row scoping for updates. Column scoping is enforced by the grants below:
-- WITH CHECK is added so a user cannot re-point the row at another user.
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- CRITICAL: without this, any logged-in user could run
--   update profiles set plan = 'pro' where id = auth.uid()
-- with the public anon key and grant themselves the ₹499 pass for free.
-- Column-level privileges are checked independently of RLS, so this is the
-- reliable place to lock `plan` and `role` down.
revoke update on public.profiles from anon, authenticated;
grant update (name, phone, avatar_url) on public.profiles to authenticated;

-- Auto-create a profile row whenever a new user signs up.
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

-- ---------------------------------------------------------------------
-- 2. COURSE ENROLLMENTS (leads from enroll.html)
-- ---------------------------------------------------------------------
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

-- Public may submit the form...
drop policy if exists "Public can submit enrollment" on public.course_enrollments;
create policy "Public can submit enrollment" on public.course_enrollments
  for insert with check (true);

-- ...but NOT read the lead list back. Previously this was `using (true)`,
-- which let anyone holding the public anon key dump every lead's name,
-- email and phone number.
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

-- ---------------------------------------------------------------------
-- 3. JOB APPLICATIONS (create-profile.html / job-details.html)
-- ---------------------------------------------------------------------
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

alter table public.job_applications enable row level security;

drop policy if exists "Public can submit application" on public.job_applications;
create policy "Public can submit application" on public.job_applications
  for insert with check (true);

-- Was `using (true)` — the entire candidate database (name, WhatsApp number,
-- email, degree, resume URL) was readable by anyone. Staff only from now on.
drop policy if exists "Public can view applications" on public.job_applications;

drop policy if exists "Admins can view applications" on public.job_applications;
create policy "Admins can view applications" on public.job_applications
  for select using (public.is_admin());

-- Staff housekeeping (the admin console removes duplicates after syncing).
drop policy if exists "Admins can update applications" on public.job_applications;
create policy "Admins can update applications" on public.job_applications
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins can delete applications" on public.job_applications;
create policy "Admins can delete applications" on public.job_applications
  for delete using (public.is_admin());

drop policy if exists "Public can delete applications" on public.job_applications;
drop policy if exists "Public can delete jobs" on public.hr_jobs;

-- ---------------------------------------------------------------------
-- 4. HR JOBS (listings shown on jobs.html / job-details.html)
-- ---------------------------------------------------------------------
-- The table was created ad hoc by the admin console and never had policies
-- defined here, so it ran on whatever defaults existed. Listings are a member
-- benefit: readable by signed-in users, writable only by staff.
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

alter table public.hr_jobs enable row level security;

-- Public listing view: any visitor can view the live job listings without signing in.
-- Full details require sign-in, and applying requires the Career Pro Pass.
drop policy if exists "Public can view jobs" on public.hr_jobs;
drop policy if exists "Members can view jobs" on public.hr_jobs;
create policy "Public can view jobs" on public.hr_jobs
  for select to public using (true);

drop policy if exists "Admins can manage jobs" on public.hr_jobs;
create policy "Admins can manage jobs" on public.hr_jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 5. REELS (admin-reels.html / admin.html)
-- ---------------------------------------------------------------------
create table if not exists public.reels (
  id uuid primary key default gen_random_uuid(),
  reel_id text,
  sort_order int,
  created_at timestamptz not null default now()
);

alter table public.reels enable row level security;

-- Was `for all using (true) with check (true)` — anyone could delete or
-- rewrite the site's reel content. Now: world-readable, staff-writable.
drop policy if exists "Public can manage reels" on public.reels;

drop policy if exists "Public can view reels" on public.reels;
create policy "Public can view reels" on public.reels
  for select using (true);

drop policy if exists "Admins can manage reels" on public.reels;
create policy "Admins can manage reels" on public.reels
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 6. STORAGE BUCKET for resume PDFs
-- ---------------------------------------------------------------------
-- Was public:true with world insert+select, so every uploaded resume was
-- readable by URL and the bucket could be used to host arbitrary files.
-- Now private: the backend hands out short-lived signed URLs instead.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;

drop policy if exists "Public can upload resumes" on storage.objects;
drop policy if exists "Public can read resumes" on storage.objects;

-- Job applicants are not required to hold an account, so the bucket acts as a
-- write-only drop box: anyone may PUT a file under applications/, nobody may
-- list or GET it. Staff read via short-lived signed URLs.
drop policy if exists "Anyone can drop an application resume" on storage.objects;
create policy "Anyone can drop an application resume" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = 'applications'
  );

-- Signed-in users may also keep resumes in their own folder: resumes/<uid>/<file>
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

-- Staff can read everything in the bucket, including the applications drop box.
drop policy if exists "Admins read all resumes" on storage.objects;
create policy "Admins read all resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.is_admin());

-- ---------------------------------------------------------------------
-- 7. RESUME BUILDER
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 8. PAYMENT ORDERS (₹499 Career Pro Pass — server-created Razorpay orders)
-- ---------------------------------------------------------------------
-- Every checkout must start here. Recording the order server-side with the
-- amount we intended is what makes amount-tampering detectable at verify time.
create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  razorpay_order_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  amount_paise integer not null,
  currency text not null default 'INR',
  status text not null default 'created',   -- created | paid | failed
  receipt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payment_orders_user on public.payment_orders(user_id);

alter table public.payment_orders enable row level security;

-- No anon/authenticated policies at all: only the service role (backend)
-- may read or write. Users learn their order id from the API response.
drop policy if exists "Users view own orders" on public.payment_orders;
create policy "Users view own orders" on public.payment_orders
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 9. STUDENT PAYMENTS (immutable ledger of verified ₹499 purchases)
-- ---------------------------------------------------------------------
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

-- Idempotency: replaying a captured payment (or a webhook arriving twice)
-- must not create a second paid record or extend access again.
create unique index if not exists uq_student_payments_txn
  on public.student_payments(transaction_id);

alter table public.student_payments enable row level security;

-- Was insert `with check (true)` + select `using (true)`:
--   * anyone could forge a "completed" ₹499 record, and
--   * anyone could dump every payer's name, email, phone and transaction id.
-- Both policies are removed. Only the backend (service role) writes here.
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

-- ---------------------------------------------------------------------
-- 9b. MANUAL UPI CLAIMS (staff-reconciled offline transfers)
-- ---------------------------------------------------------------------
-- A UTR cannot be validated programmatically, so these rows grant nothing on
-- their own — they are a work queue. Staff match each reference against the
-- bank statement and activate the pass by hand.
create table if not exists public.manual_payment_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text,
  user_name text,
  phone text,
  reference text not null,
  status text not null default 'pending',   -- pending | approved | rejected
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

-- ---------------------------------------------------------------------
-- 10. SUBSCRIPTIONS (the actual entitlement — one row per user)
-- ---------------------------------------------------------------------
-- This table, not localStorage and not profiles.plan, is the source of truth
-- for "is this user Pro right now". Written only by the backend after a
-- cryptographically verified payment.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'career_pro',
  status text not null default 'active',     -- active | expired | cancelled
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_payment_id text,
  amount numeric not null default 499,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

alter table public.subscriptions enable row level security;

-- Users may READ their own entitlement (so the UI can show status) but there
-- is deliberately no INSERT/UPDATE/DELETE policy — those are service-role only.
drop policy if exists "Users view own subscription" on public.subscriptions;
create policy "Users view own subscription" on public.subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "Admins view all subscriptions" on public.subscriptions;
create policy "Admins view all subscriptions" on public.subscriptions
  for select using (public.is_admin());

-- has_active_pass() is the single entitlement test used by policies and by the
-- job-details RPC. It reads `subscriptions`, which only the backend can write,
-- so a user cannot make this return true for themselves.
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

-- ---------------------------------------------------------------------
-- 10b. JOB LISTING TIERS — summary is free to members, detail is paid
-- ---------------------------------------------------------------------
-- Members browsing jobs.html see enough to decide (title, company, location,
-- pay band, skills). The fields that let someone actually act on a listing —
-- the full description, requirements and the apply URL — are the paid part.
--
-- Column-level grants are used rather than a second RLS policy because RLS
-- filters rows, not columns; this is the reliable way to withhold specific
-- fields from a role that can still read the row.
revoke select on public.hr_jobs from anon, authenticated;
-- Public summary columns for job listings (jobs.html)
grant select (
  id, title, category, company, location, job_type,
  experience, salary, skills, is_direct_link, created_at
) on public.hr_jobs to anon, authenticated;

/**
 * Full listing detail, readable by any signed-in candidate.
 * The apply_url is withheld unless the candidate has an active Career Pro Pass.
 */
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
         case when (public.has_active_pass() or public.is_admin()) then j.apply_url else null end as apply_url,
         j.is_direct_link, j.created_at
  from public.hr_jobs j
  where j.id = p_job_id
    and (auth.uid() is not null or public.is_admin());
$$;

revoke all on function public.job_details(uuid) from public;
grant execute on function public.job_details(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 10c. UNIFIED PAYMENT LEDGER
-- ---------------------------------------------------------------------
-- Every payment path — Razorpay checkout, the Razorpay webhook, and staff
-- activation of an offline transfer — already writes one row here through the
-- backend's grantCareerPro(). `source` records which path it came from so the
-- whole business reconciles from this one table.
alter table public.student_payments
  add column if not exists source text not null default 'razorpay';

create index if not exists idx_student_payments_created
  on public.student_payments(created_at desc);
create index if not exists idx_student_payments_email
  on public.student_payments(user_email);

-- One place for staff to see money in and access granted, side by side.
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

-- security_invoker means the view runs with the caller's rights, so the
-- student_payments / subscriptions policies above still apply: a normal user
-- sees only their own rows, staff see everything.
grant select on public.payments_overview to authenticated;

-- Convenience view for the current user's live Pro state.
create or replace view public.my_subscription
with (security_invoker = true)
as
  select user_id, plan, status, started_at, expires_at,
         (status = 'active' and expires_at > now()) as is_active
  from public.subscriptions
  where user_id = auth.uid();

grant select on public.my_subscription to authenticated;

-- =========================================================================
-- POST-INSTALL STEP (do this once, by hand):
--   Promote yourself to staff so admin.html will open for you.
--
--   update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'you@kompetenzen.in');
--
-- Verify the lockdown afterwards, signed out / with the anon key:
--   select * from student_payments;   -- must return 0 rows
--   select * from job_applications;   -- must return 0 rows
--   select * from course_enrollments; -- must return 0 rows
-- =========================================================================
