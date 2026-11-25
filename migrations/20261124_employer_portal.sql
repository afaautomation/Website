-- Employer portal: companies register, staff approve the company, then its jobs go live.
-- Safe to re-run. Run in the Supabase SQL Editor BEFORE publishing employer.html and admin.html.
--
-- Security model
--   * Companies and their audit trail are written ONLY through the security-definer functions
--     below. Browsers get no INSERT/UPDATE/DELETE on these tables, so a company can never set
--     its own status, edit another company, or write straight into hr_jobs.
--   * A company must be approved by staff before it can post. Suspending or rejecting it hides
--     every one of its listings at once (hr_jobs.held) and stops new applications to them.
--   * Applications still go through apply_to_job(): candidate details and resumes are stored in
--     our own job_applications table and private "resumes" bucket. Companies never receive
--     candidate data from this portal, and listings cannot carry an outside apply link.
--   * The company's contact email comes from the verified sign-in, never from the form.
begin;

-- 1. Companies ---------------------------------------------------------------------------------
create table if not exists public.employer_companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  website text,
  industry text,
  company_size text,
  city text,
  about text,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  registration_doc text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_companies_size_check check (
    char_length(name) between 2 and 120
    and char_length(coalesce(website, '')) <= 300
    and char_length(coalesce(industry, '')) <= 80
    and char_length(coalesce(company_size, '')) <= 40
    and char_length(coalesce(city, '')) <= 80
    and char_length(coalesce(about, '')) <= 1500
    and char_length(contact_name) between 2 and 80
    and char_length(contact_email) <= 200
    and char_length(contact_phone) <= 20
    and char_length(coalesce(registration_doc, '')) <= 300
    and char_length(coalesce(review_note, '')) <= 500
  )
);
create unique index if not exists uq_employer_companies_name on public.employer_companies (lower(name));

alter table public.employer_companies enable row level security;
revoke all on public.employer_companies from public, anon, authenticated;
grant select on public.employer_companies to authenticated;
grant all on public.employer_companies to service_role;

drop policy if exists "Owner reads own company" on public.employer_companies;
create policy "Owner reads own company" on public.employer_companies
  for select to authenticated using (owner_id = auth.uid());
drop policy if exists "Staff read all companies" on public.employer_companies;
create policy "Staff read all companies" on public.employer_companies
  for select to authenticated using (public.is_admin());

-- 2. Audit trail (staff read only) -------------------------------------------------------------
create table if not exists public.employer_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.employer_companies(id) on delete cascade,
  actor uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint employer_events_size_check check (char_length(action) <= 60 and octet_length(detail::text) <= 4000)
);
alter table public.employer_events enable row level security;
revoke all on public.employer_events from public, anon, authenticated;
grant select on public.employer_events to authenticated;
grant all on public.employer_events to service_role;
drop policy if exists "Staff read employer events" on public.employer_events;
create policy "Staff read employer events" on public.employer_events
  for select to authenticated using (public.is_admin());

-- 3. Listings: who posted them, and whether they are held back --------------------------------
alter table public.hr_jobs
  add column if not exists employer_id uuid references public.employer_companies(id) on delete cascade,
  add column if not exists held boolean not null default false;
create index if not exists idx_hr_jobs_employer on public.hr_jobs (employer_id) where employer_id is not null;

-- Visitors see only open listings that are not held. Staff see everything ("Admins can view all jobs").
drop policy if exists "Public can view jobs" on public.hr_jobs;
create policy "Public can view jobs" on public.hr_jobs
  for select to public using (public.hr_job_open(expires_on) and not held);
grant select (held) on public.hr_jobs to anon, authenticated;

-- Same columns as before; a held listing is returned only to staff and to candidates who applied.
create or replace function public.job_details(p_job_id uuid)
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
  where j.id = p_job_id
    and ((public.hr_job_open(j.expires_on) and not j.held)
         or public.is_admin()
         or exists (select 1 from public.job_applications a
                    where a.user_id = auth.uid() and a.job_id = j.id));
$$;
revoke all on function public.job_details(uuid) from public;
grant execute on function public.job_details(uuid) to anon, authenticated, service_role;

-- New applications to an expired or held listing are refused, whichever path inserts them.
create or replace function public.guard_listing_open()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.hr_jobs j
             where j.id = new.job_id and (j.held or not public.hr_job_open(j.expires_on)))
     and not public.is_admin() then
    raise exception 'This opening has closed and is no longer accepting applications.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_listing_open() from public;

-- 4. Approving or suspending a company shows or hides all of its listings ----------------------
create or replace function public.employer_sync_held()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    update public.hr_jobs set held = (new.status <> 'approved') where employer_id = new.id;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.employer_sync_held() from public, anon, authenticated;
drop trigger if exists employer_sync_held on public.employer_companies;
create trigger employer_sync_held before update on public.employer_companies
  for each row execute function public.employer_sync_held();

-- 5. Helpers -----------------------------------------------------------------------------------
-- Text from a browser: trimmed, angle brackets removed, length limited. Empty becomes null.
create or replace function public.employer_clean(p text, p_max int)
returns text language sql immutable set search_path = public as $$
  select nullif(left(btrim(regexp_replace(coalesce(p, ''), '[<>\x01-\x08\x0b\x0c\x0e-\x1f]', '', 'g')), p_max), '');
$$;
revoke all on function public.employer_clean(text, int) from public, anon, authenticated;

-- Signed in with a verified email, or fail.
create or replace function public.employer_user()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Please sign in first.' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users u where u.id = v and u.email_confirmed_at is not null and u.email is not null
                 and (u.banned_until is null or u.banned_until <= now())) then
    raise exception 'Please verify your email address first.' using errcode = '42501';
  end if;
  return v;
end;
$$;
revoke all on function public.employer_user() from public, anon, authenticated;

create or replace function public.employer_log(p_company uuid, p_action text, p_detail jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.employer_events (company_id, actor, action, detail) values (p_company, auth.uid(), p_action, coalesce(p_detail, '{}'::jsonb));
$$;
revoke all on function public.employer_log(uuid, text, jsonb) from public, anon, authenticated;

-- The signed-in user's approved company, or fail.
create or replace function public.employer_approved_company()
returns public.employer_companies language plpgsql stable security definer set search_path = public as $$
declare c public.employer_companies; v uuid := public.employer_user();
begin
  select * into c from public.employer_companies where owner_id = v;
  if not found then raise exception 'Register your company first.' using errcode = 'P0001'; end if;
  if c.status <> 'approved' then
    raise exception 'Your company is not approved yet. You can post jobs once our team approves it.' using errcode = 'P0001';
  end if;
  return c;
end;
$$;
revoke all on function public.employer_approved_company() from public, anon, authenticated;

-- 6. Register a company ------------------------------------------------------------------------
create or replace function public.employer_register(
  p_name text, p_website text, p_industry text, p_size text, p_city text, p_about text,
  p_contact_name text, p_contact_phone text, p_registration_doc text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.employer_user();
  v_email text;
  v_name text := public.employer_clean(p_name, 120);
  v_site text := public.employer_clean(p_website, 300);
  v_contact text := public.employer_clean(p_contact_name, 80);
  v_phone text := regexp_replace(coalesce(p_contact_phone, ''), '[\s\-()]', '', 'g');
  v_doc text := nullif(btrim(coalesce(p_registration_doc, '')), '');
  v_id uuid;
begin
  if exists (select 1 from public.employer_companies where owner_id = v) then
    raise exception 'This account has already registered a company.' using errcode = 'P0001';
  end if;
  if v_name is null or char_length(v_name) < 2 then raise exception 'Enter your company name.' using errcode = 'P0001'; end if;
  if v_contact is null or char_length(v_contact) < 2 then raise exception 'Enter the contact person''s name.' using errcode = 'P0001'; end if;
  if v_phone !~ '^\+?[0-9]{8,15}$' then raise exception 'Enter a valid phone number.' using errcode = 'P0001'; end if;
  if v_site is not null and v_site !~* '^https?://[^\s<>"]+\.[^\s<>"]+$' then
    raise exception 'The website must start with http:// or https://' using errcode = 'P0001';
  end if;
  if v_doc is not null and v_doc !~ ('^' || v::text || '/[A-Za-z0-9_.-]{1,120}$') then
    raise exception 'Invalid document reference.' using errcode = 'P0001';
  end if;
  select email into v_email from auth.users where id = v;
  insert into public.employer_companies (owner_id, name, website, industry, company_size, city, about,
                                        contact_name, contact_email, contact_phone, registration_doc)
  values (v, v_name, v_site, public.employer_clean(p_industry, 80), public.employer_clean(p_size, 40),
          public.employer_clean(p_city, 80), public.employer_clean(p_about, 1500),
          v_contact, lower(v_email), v_phone, v_doc)
  returning id into v_id;
  perform public.employer_log(v_id, 'registered', jsonb_build_object('name', v_name));
  return jsonb_build_object('id', v_id, 'status', 'pending');
exception when unique_violation then
  raise exception 'A company with this name is already registered. Contact us if it is yours.' using errcode = 'P0001';
end;
$$;
revoke all on function public.employer_register(text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.employer_register(text, text, text, text, text, text, text, text, text) to authenticated;

-- A company may update its details but not its name or status.
create or replace function public.employer_update_company(
  p_website text, p_industry text, p_size text, p_city text, p_about text, p_contact_name text, p_contact_phone text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v uuid := public.employer_user();
  v_site text := public.employer_clean(p_website, 300);
  v_contact text := public.employer_clean(p_contact_name, 80);
  v_phone text := regexp_replace(coalesce(p_contact_phone, ''), '[\s\-()]', '', 'g');
  v_id uuid;
begin
  if v_contact is null or char_length(v_contact) < 2 then raise exception 'Enter the contact person''s name.' using errcode = 'P0001'; end if;
  if v_phone !~ '^\+?[0-9]{8,15}$' then raise exception 'Enter a valid phone number.' using errcode = 'P0001'; end if;
  if v_site is not null and v_site !~* '^https?://[^\s<>"]+\.[^\s<>"]+$' then
    raise exception 'The website must start with http:// or https://' using errcode = 'P0001';
  end if;
  update public.employer_companies set website = v_site, industry = public.employer_clean(p_industry, 80),
    company_size = public.employer_clean(p_size, 40), city = public.employer_clean(p_city, 80),
    about = public.employer_clean(p_about, 1500), contact_name = v_contact, contact_phone = v_phone
  where owner_id = v returning id into v_id;
  if v_id is null then raise exception 'Register your company first.' using errcode = 'P0001'; end if;
  perform public.employer_log(v_id, 'company_updated');
end;
$$;
revoke all on function public.employer_update_company(text, text, text, text, text, text, text) from public, anon;
grant execute on function public.employer_update_company(text, text, text, text, text, text, text) to authenticated;

-- 7. Jobs --------------------------------------------------------------------------------------
-- Shared validation. Returns the cleaned row as jsonb, or raises a readable error.
create or replace function public.employer_job_fields(p jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  v_title text := public.employer_clean(p->>'title', 120);
  v_cat text := lower(coalesce(p->>'category', ''));
  v_type text := lower(coalesce(p->>'job_type', ''));
  v_loc text := public.employer_clean(p->>'location', 120);
  v_exp text := public.employer_clean(p->>'experience', 100);
  v_sal text := public.employer_clean(p->>'salary', 100);
  v_skills text := public.employer_clean(p->>'skills', 400);
  v_desc text := public.employer_clean(p->>'description', 4000);
  v_resp text := public.employer_clean(p->>'responsibilities', 3000);
  v_req text := public.employer_clean(p->>'requirements', 3000);
  v_exp_on date;
  v_questions jsonb := '[]'::jsonb;
  q text;
begin
  if p is null or jsonb_typeof(p) <> 'object' then raise exception 'Invalid listing.' using errcode = 'P0001'; end if;
  if v_title is null or char_length(v_title) < 3 then raise exception 'Enter a job title.' using errcode = 'P0001'; end if;
  if v_cat not in ('tech', 'hr', 'sales') then raise exception 'Choose a category.' using errcode = 'P0001'; end if;
  if v_type not in ('full-time', 'contract', 'part-time', 'remote', 'internship', 'internship-fulltime', 'internship-parttime', 'internship-remote') then
    raise exception 'Choose a job type.' using errcode = 'P0001';
  end if;
  if v_loc is null then raise exception 'Enter the job location.' using errcode = 'P0001'; end if;
  if v_desc is null or char_length(v_desc) < 30 then raise exception 'Describe the role in at least 30 characters.' using errcode = 'P0001'; end if;
  begin
    v_exp_on := (p->>'expires_on')::date;
  exception when others then
    raise exception 'Enter a valid last date to apply.' using errcode = 'P0001';
  end;
  if v_exp_on is null or v_exp_on < (now() at time zone 'Asia/Kolkata')::date
     or v_exp_on > (now() at time zone 'Asia/Kolkata')::date + 120 then
    raise exception 'The last date to apply must be within the next 120 days.' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p->'questions') = 'array' then
    if jsonb_array_length(p->'questions') > 3 then raise exception 'You can ask at most 3 questions.' using errcode = 'P0001'; end if;
    for q in select jsonb_array_elements_text(p->'questions') loop
      q := public.employer_clean(q, 200);
      if q is not null then v_questions := v_questions || to_jsonb(q); end if;
    end loop;
  end if;
  return jsonb_build_object('title', v_title, 'category', v_cat, 'job_type', v_type, 'location', v_loc,
    'experience', coalesce(v_exp, ''), 'salary', coalesce(v_sal, ''), 'skills', coalesce(v_skills, ''),
    'description', v_desc, 'responsibilities', coalesce(v_resp, ''), 'requirements', coalesce(v_req, ''),
    'expires_on', v_exp_on,
    -- Only these settings can come from a company. Matching rules stay with our staff.
    'application_requirements', jsonb_build_object('resume', true, 'questions', v_questions));
end;
$$;
revoke all on function public.employer_job_fields(jsonb) from public, anon, authenticated;

create or replace function public.employer_post_job(p_job jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  f jsonb := public.employer_job_fields(p_job);
  v_id uuid;
begin
  -- Serialize one company's posts so the limits below cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(c.id::text, 0));
  if (select count(*) from public.hr_jobs where employer_id = c.id and created_at > now() - interval '1 day') >= 10 then
    raise exception 'You can post up to 10 jobs a day. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.hr_jobs where employer_id = c.id and public.hr_job_open(expires_on)) >= 50 then
    raise exception 'You have 50 open listings. Close one to post another.' using errcode = 'P0001';
  end if;
  insert into public.hr_jobs (title, category, company, location, job_type, experience, salary, skills,
                              description, responsibilities, requirements, about_company,
                              apply_url, is_direct_link, application_requirements, expires_on, employer_id, held)
  values (f->>'title', f->>'category', c.name, f->>'location', f->>'job_type', f->>'experience', f->>'salary', f->>'skills',
          f->>'description', f->>'responsibilities', f->>'requirements', coalesce(c.about, ''),
          null, false, f->'application_requirements', (f->>'expires_on')::date, c.id, false)
  returning id into v_id;
  perform public.employer_log(c.id, 'job_posted', jsonb_build_object('job', v_id, 'title', f->>'title'));
  return v_id;
end;
$$;
revoke all on function public.employer_post_job(jsonb) from public, anon;
grant execute on function public.employer_post_job(jsonb) to authenticated;

create or replace function public.employer_update_job(p_id uuid, p_job jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  f jsonb := public.employer_job_fields(p_job);
  v_old jsonb;
begin
  select application_requirements into v_old from public.hr_jobs where id = p_id and employer_id = c.id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  update public.hr_jobs set title = f->>'title', category = f->>'category', job_type = f->>'job_type',
    location = f->>'location', experience = f->>'experience', salary = f->>'salary', skills = f->>'skills',
    description = f->>'description', responsibilities = f->>'responsibilities', requirements = f->>'requirements',
    expires_on = (f->>'expires_on')::date,
    -- keep any matching rules our staff added; replace only what the company controls
    application_requirements = coalesce(v_old, '{}'::jsonb) || (f->'application_requirements')
  where id = p_id and employer_id = c.id;
  perform public.employer_log(c.id, 'job_updated', jsonb_build_object('job', p_id));
end;
$$;
revoke all on function public.employer_update_job(uuid, jsonb) from public, anon;
grant execute on function public.employer_update_job(uuid, jsonb) to authenticated;

-- Close a listing now (new applications stop; existing ones stay with us).
create or replace function public.employer_close_job(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v uuid := public.employer_user(); v_company uuid; v_n int;
begin
  select id into v_company from public.employer_companies where owner_id = v;
  update public.hr_jobs set expires_on = (now() at time zone 'Asia/Kolkata')::date - 1
    where id = p_id and employer_id = v_company and v_company is not null;
  get diagnostics v_n = row_count;
  if v_n <> 1 then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  perform public.employer_log(v_company, 'job_closed', jsonb_build_object('job', p_id));
end;
$$;
revoke all on function public.employer_close_job(uuid) from public, anon;
grant execute on function public.employer_close_job(uuid) to authenticated;

-- The company's own listings with how many people applied (a count, never who).
create or replace function public.employer_my_jobs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v uuid := public.employer_user(); v_company uuid;
begin
  select id into v_company from public.employer_companies where owner_id = v;
  if v_company is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', j.id, 'title', j.title, 'category', j.category, 'job_type', j.job_type, 'location', j.location,
      'experience', j.experience, 'salary', j.salary, 'skills', j.skills, 'description', j.description,
      'responsibilities', j.responsibilities, 'requirements', j.requirements,
      'expires_on', j.expires_on, 'created_at', j.created_at, 'held', j.held,
      'open', public.hr_job_open(j.expires_on) and not j.held,
      'questions', coalesce(j.application_requirements->'questions', '[]'::jsonb),
      'applicants', (select count(*) from public.job_applications a where a.job_id = j.id)
    ) order by j.created_at desc)
    from public.hr_jobs j where j.employer_id = v_company), '[]'::jsonb);
end;
$$;
revoke all on function public.employer_my_jobs() from public, anon;
grant execute on function public.employer_my_jobs() to authenticated;

-- 8. Staff review ------------------------------------------------------------------------------
create or replace function public.admin_employer_list(p_status text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(r) order by r.sort_key, r.created_at desc) from (
      select c.id, c.name, c.website, c.industry, c.company_size, c.city, c.about, c.contact_name, c.contact_email,
             c.contact_phone, c.registration_doc, c.status, c.review_note, c.reviewed_at, c.created_at,
             case c.status when 'pending' then 0 when 'approved' then 1 when 'suspended' then 2 else 3 end as sort_key,
             (select count(*) from public.hr_jobs j where j.employer_id = c.id) as jobs,
             (select count(*) from public.job_applications a join public.hr_jobs j on j.id = a.job_id where j.employer_id = c.id) as applicants
      from public.employer_companies c
      where p_status is null or c.status = p_status) r), '[]'::jsonb);
end;
$$;
revoke all on function public.admin_employer_list(text) from public, anon;
grant execute on function public.admin_employer_list(text) to authenticated;

create or replace function public.admin_employer_review(p_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  if not public.is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
  if p_status not in ('approved', 'rejected', 'suspended', 'pending') then raise exception 'Invalid status.' using errcode = 'P0001'; end if;
  select status into v_old from public.employer_companies where id = p_id for update;
  if not found then raise exception 'Company not found.' using errcode = 'P0001'; end if;
  update public.employer_companies set status = p_status, review_note = public.employer_clean(p_note, 500),
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  perform public.employer_log(p_id, 'status_' || p_status, jsonb_build_object('from', v_old, 'note', public.employer_clean(p_note, 500)));
end;
$$;
revoke all on function public.admin_employer_review(uuid, text, text) from public, anon;
grant execute on function public.admin_employer_review(uuid, text, text) to authenticated;

-- 9. Registration documents: private, small, a few per account -----------------------------------
insert into storage.buckets (id, name, public) values ('company-docs', 'company-docs', false)
on conflict (id) do update set public = false;
update storage.buckets set file_size_limit = 5242880,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'company-docs';

create or replace function public.employer_doc_quota_ok(p_uid uuid)
returns boolean language sql stable security definer set search_path = public, storage as $$
  select (select count(*) from storage.objects o
          where o.bucket_id = 'company-docs' and (storage.foldername(o.name))[1] = p_uid::text) < 5;
$$;
revoke all on function public.employer_doc_quota_ok(uuid) from public, anon;
grant execute on function public.employer_doc_quota_ok(uuid) to authenticated;

drop policy if exists "Employers upload own company document" on storage.objects;
create policy "Employers upload own company document" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text
              and public.employer_doc_quota_ok(auth.uid()));
drop policy if exists "Employers read own company document" on storage.objects;
create policy "Employers read own company document" on storage.objects
  for select to authenticated
  using (bucket_id = 'company-docs' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "Staff read company documents" on storage.objects;
create policy "Staff read company documents" on storage.objects
  for select to authenticated using (bucket_id = 'company-docs' and public.is_admin());

commit;
