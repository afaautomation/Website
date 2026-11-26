-- Employer portal, part 2: companies see who applied to THEIR jobs, with the fit score and filters.
-- Safe to re-run. Run in the Supabase SQL Editor after 20261124_employer_portal.sql and
-- the applicant matching migrations, and BEFORE publishing the updated employer.html.
--
-- Privacy model (candidates are told this in the apply form and the privacy policy)
--   * A company sees only applicants to its own listings, and only while it is approved.
--   * Before it shortlists someone it sees a summary: name, education, college, experience,
--     skills, answers to its own screening questions and the fit score with the reasons.
--   * Email, WhatsApp number, portfolio link and the resume are released only after the company
--     shortlists that applicant. Resumes stay in the private bucket and are opened through
--     one-minute links; storage allows it only for shortlisted applicants of the company's jobs.
--   * Companies cannot see another company's applicants, and cannot read anything in bulk:
--     at most 100 rows per request, every shortlist or rejection is logged.
begin;

alter table public.job_applications
  add column if not exists employer_status text not null default 'new',
  add column if not exists employer_status_at timestamptz;
alter table public.job_applications drop constraint if exists job_applications_employer_status_check;
alter table public.job_applications add constraint job_applications_employer_status_check
  check (employer_status in ('new', 'shortlisted', 'rejected'));
create index if not exists idx_job_applications_job_employer on public.job_applications (job_id, employer_status);

-- 1. Companies can set up the same screening rules (and so the same score) that our staff use.
-- Only the known rule fields are kept; anything else a browser sends is dropped.
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
  v_match jsonb := p->'matching';
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

  -- Screening and scoring rules (optional). Empty or null means "no automatic scoring".
  if v_match is null or v_match = 'null'::jsonb or v_match = '{}'::jsonb then
    v_match := null;
  else
    if jsonb_typeof(v_match) <> 'object' or octet_length(v_match::text) > 8000 or v_match::text ~ '[<>]' then
      raise exception 'The screening rules are not valid.' using errcode = 'P0001';
    end if;
    select jsonb_object_agg(k, v_match->k) into v_match
    from unnest(array['version', 'careerArea', 'careerField', 'skills', 'softSkills', 'weights', 'semesters', 'graduationYears',
                      'qualifications', 'specialisations', 'preferredQualifications', 'preferredSpecialisations',
                      'minimumMonths', 'preferredMonths', 'experienceScope']) k
    where v_match ? k;
    v_match := coalesce(v_match, '{}'::jsonb) || jsonb_build_object('source', 'career_preferences');
  end if;

  return jsonb_build_object('title', v_title, 'category', v_cat, 'job_type', v_type, 'location', v_loc,
    'experience', coalesce(v_exp, ''), 'salary', coalesce(v_sal, ''), 'skills', coalesce(v_skills, ''),
    'description', v_desc, 'responsibilities', coalesce(v_resp, ''), 'requirements', coalesce(v_req, ''),
    'expires_on', v_exp_on, 'replace_matching', p ? 'matching',
    'application_requirements', jsonb_build_object('resume', true, 'questions', v_questions)
      || case when v_match is null then '{}'::jsonb else jsonb_build_object('matching', v_match) end);
end;
$$;
revoke all on function public.employer_job_fields(jsonb) from public, anon, authenticated;

-- Editing keeps rules our staff added unless the company sent a "matching" value (including an empty one to clear it).
create or replace function public.employer_update_job(p_id uuid, p_job jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  f jsonb := public.employer_job_fields(p_job);
  v_old jsonb;
  v_req jsonb;
begin
  select application_requirements into v_old from public.hr_jobs where id = p_id and employer_id = c.id for update;
  if not found then raise exception 'Listing not found.' using errcode = 'P0001'; end if;
  v_req := case when (f->>'replace_matching')::boolean
                then (coalesce(v_old, '{}'::jsonb) - 'matching') || (f->'application_requirements')
                else coalesce(v_old, '{}'::jsonb) || ((f->'application_requirements') - 'matching') end;
  update public.hr_jobs set title = f->>'title', category = f->>'category', job_type = f->>'job_type',
    location = f->>'location', experience = f->>'experience', salary = f->>'salary', skills = f->>'skills',
    description = f->>'description', responsibilities = f->>'responsibilities', requirements = f->>'requirements',
    expires_on = (f->>'expires_on')::date, application_requirements = v_req
  where id = p_id and employer_id = c.id;
  perform public.employer_log(c.id, 'job_updated', jsonb_build_object('job', p_id));
end;
$$;
revoke all on function public.employer_update_job(uuid, jsonb) from public, anon;
grant execute on function public.employer_update_job(uuid, jsonb) to authenticated;

-- The company's listings now also carry their screening rules (so the form can show them) and the shortlist count.
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
      'matching', j.application_requirements->'matching',
      'applicants', (select count(*) from public.job_applications a where a.job_id = j.id),
      'shortlisted', (select count(*) from public.job_applications a where a.job_id = j.id and a.employer_status = 'shortlisted')
    ) order by j.created_at desc)
    from public.hr_jobs j where j.employer_id = v_company), '[]'::jsonb);
end;
$$;
revoke all on function public.employer_my_jobs() from public, anon;
grant execute on function public.employer_my_jobs() to authenticated;

-- 2. Applicants of the company's own listings -----------------------------------------------------
create or replace function public.employer_applicants(
  p_job uuid default null, p_status text default null, p_match text default null,
  p_min_score numeric default null, p_search text default null, p_offset int default 0, p_limit int default 25)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  q text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  result jsonb;
begin
  if p_status is not null and p_status not in ('new', 'shortlisted', 'rejected') then raise exception 'Invalid status filter.' using errcode = 'P0001'; end if;
  if p_match is not null and p_match not in ('matched', 'needs_information', 'not_matched', 'unconfigured', 'pending') then raise exception 'Invalid match filter.' using errcode = 'P0001'; end if;
  if p_min_score is not null and (p_min_score < 0 or p_min_score > 100) then raise exception 'The score must be between 0 and 100.' using errcode = 'P0001'; end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 100 then raise exception 'Invalid page.' using errcode = 'P0001'; end if;
  if q is not null and char_length(q) > 80 then q := left(q, 80); end if;
  if p_job is not null and not exists (select 1 from public.hr_jobs where id = p_job and employer_id = c.id) then
    raise exception 'Listing not found.' using errcode = 'P0001';
  end if;

  with base as (
    select a.*, j.title as job_title
    from public.job_applications a join public.hr_jobs j on j.id = a.job_id
    where j.employer_id = c.id and (p_job is null or a.job_id = p_job)
  ), filtered as (
    select * from base b
    where (p_status is null or b.employer_status = p_status)
      and (p_match is null or b.match_result->>'status' = p_match)
      and (p_min_score is null or coalesce((b.match_result->>'score')::numeric, -1) >= p_min_score)
      and (q is null or position(q in lower(concat_ws(' ', b.name, b.college, b.skills, b.degree, b.course_name, b.job_title))) > 0)
  )
  select jsonb_build_object(
    'rows', coalesce((select jsonb_agg(r order by r.sort_score desc nulls last, r.applied_at desc, r.id) from (
      select f.id, f.job_id, f.job_title, f.created_at as applied_at, (f.match_result->>'score')::numeric as sort_score,
        f.name, f.degree, f.course_name as course, f.college, f.grad_year, f.experience,
        coalesce(f.current_location, f.preferred_location) as location, f.work_mode, f.availability,
        f.expected_salary, f.skills, f.matched_skills, f.screening_answers as answers, f.employer_status as status,
        jsonb_build_object('status', f.match_result->>'status', 'score', f.match_result->'score',
                           'reasons', coalesce(f.match_result->'reasons', '[]'::jsonb),
                           'components', coalesce(f.match_result->'components', '{}'::jsonb)) as match,
        (f.resume_url is not null) as has_resume,
        case when f.employer_status = 'shortlisted' then
          jsonb_build_object('email', f.email, 'whatsapp', f.whatsapp, 'portfolio', f.portfolio_url, 'resume', f.resume_url)
        else null end as contact
      from filtered f
      order by (f.match_result->>'score')::numeric desc nulls last, f.created_at desc, f.id
      offset p_offset limit p_limit) r), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'counts', jsonb_build_object(
      'all', (select count(*) from base),
      'new', (select count(*) from base where employer_status = 'new'),
      'shortlisted', (select count(*) from base where employer_status = 'shortlisted'),
      'rejected', (select count(*) from base where employer_status = 'rejected'))
  ) into result;
  return result;
end;
$$;
revoke all on function public.employer_applicants(uuid, text, text, numeric, text, int, int) from public, anon;
grant execute on function public.employer_applicants(uuid, text, text, numeric, text, int, int) to authenticated;

-- 3. Shortlist, reject or reset an applicant ----------------------------------------------------
create or replace function public.employer_set_applicant_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  v_job uuid; v_old text;
begin
  if p_status not in ('new', 'shortlisted', 'rejected') then raise exception 'Invalid status.' using errcode = 'P0001'; end if;
  select a.job_id, a.employer_status into v_job, v_old
  from public.job_applications a join public.hr_jobs j on j.id = a.job_id
  where a.id = p_id and j.employer_id = c.id for update of a;
  if not found then raise exception 'Applicant not found.' using errcode = 'P0001'; end if;
  update public.job_applications set employer_status = p_status, employer_status_at = now() where id = p_id;
  perform public.employer_log(c.id, 'applicant_' || p_status, jsonb_build_object('application', p_id, 'job', v_job, 'from', v_old));
end;
$$;
revoke all on function public.employer_set_applicant_status(uuid, text) from public, anon;
grant execute on function public.employer_set_applicant_status(uuid, text) to authenticated;

-- 4. Resumes: readable by a company only for applicants it shortlisted ----------------------------
create or replace function public.employer_can_read_resume(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.job_applications a
    join public.hr_jobs j on j.id = a.job_id
    join public.employer_companies c on c.id = j.employer_id
    where c.owner_id = auth.uid() and c.status = 'approved'
      and a.employer_status = 'shortlisted' and a.resume_url = p_name);
$$;
revoke all on function public.employer_can_read_resume(text) from public, anon;
grant execute on function public.employer_can_read_resume(text) to authenticated;

drop policy if exists "Employers read shortlisted resumes" on storage.objects;
create policy "Employers read shortlisted resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.employer_can_read_resume(name));

commit;
