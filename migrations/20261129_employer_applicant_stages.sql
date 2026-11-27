-- Employer portal, part 6: three more hiring steps after shortlisting, "Contacted", "Interview" and "Selected".
-- Safe to re-run. Run before publishing the updated employer.html.
--
-- This file includes everything from 20261128_employer_applicant_scoring.sql (which itself includes
-- 20261126 and 20261127), so running only this one is enough:
--   * NEW: an applicant's status can be new, shortlisted, contacted, interview, selected or rejected
--   * NEW: the Applicants list filters and counts the new steps, and each row says when its status last changed
--   * NEW: a listing's "shortlisted" count includes people the company contacted, is interviewing or selected
--   * from 20261128: profile, contact details, resume and the scoring snapshot for each applicant
-- The statuses are only labels for the company's own workflow: candidates are not told, and each
-- change is still written to employer_events.
begin;

-- 1. The allowed statuses ------------------------------------------------------------------------
alter table public.job_applications drop constraint if exists job_applications_employer_status_check;
alter table public.job_applications add constraint job_applications_employer_status_check
  check (employer_status in ('new', 'shortlisted', 'contacted', 'interview', 'selected', 'rejected'));

-- 2. Move an applicant to any step -----------------------------------------------------------------
create or replace function public.employer_set_applicant_status(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  v_job uuid; v_old text;
begin
  if p_status is null or p_status not in ('new', 'shortlisted', 'contacted', 'interview', 'selected', 'rejected') then
    raise exception 'Invalid status.' using errcode = 'P0001';
  end if;
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

-- 3. The company's listings: "shortlisted" now counts everyone taken forward -----------------------
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
      'shortlisted', (select count(*) from public.job_applications a
                      where a.job_id = j.id and a.employer_status in ('shortlisted', 'contacted', 'interview', 'selected'))
    ) order by j.created_at desc)
    from public.hr_jobs j where j.employer_id = v_company), '[]'::jsonb);
end;
$$;
revoke all on function public.employer_my_jobs() from public, anon;
grant execute on function public.employer_my_jobs() to authenticated;

-- 4. Applicants of the company's own listings (as in 20261128, plus the new steps and status date) -
create or replace function public.employer_applicants(
  p_job uuid default null, p_status text default null, p_match text default null,
  p_min_score numeric default null, p_search text default null, p_offset int default 0, p_limit int default 25)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  c public.employer_companies := public.employer_approved_company();
  q text := lower(nullif(btrim(coalesce(p_search, '')), ''));
  result jsonb;
begin
  if p_status is not null and p_status not in ('new', 'shortlisted', 'contacted', 'interview', 'selected', 'rejected') then raise exception 'Invalid status filter.' using errcode = 'P0001'; end if;
  if p_match is not null and p_match not in ('matched', 'needs_information', 'not_matched', 'unconfigured', 'pending') then raise exception 'Invalid match filter.' using errcode = 'P0001'; end if;
  if p_min_score is not null and (p_min_score < 0 or p_min_score > 100) then raise exception 'The score must be between 0 and 100.' using errcode = 'P0001'; end if;
  if p_offset < 0 or p_limit < 1 or p_limit > 100 then raise exception 'Invalid page.' using errcode = 'P0001'; end if;
  if q is not null and char_length(q) > 80 then q := left(q, 80); end if;
  if p_job is not null and not exists (select 1 from public.hr_jobs where id = p_job and employer_id = c.id) then
    raise exception 'Listing not found.' using errcode = 'P0001';
  end if;

  with base as (
    select a.*, j.title as job_title, to_jsonb(cp) as cp
    from public.job_applications a join public.hr_jobs j on j.id = a.job_id
    left join public.candidate_profiles cp on cp.user_id = a.user_id
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
        f.employer_status_at as status_at,
        jsonb_build_object('status', f.match_result->>'status', 'score', f.match_result->'score',
                           'reasons', coalesce(f.match_result->'reasons', '[]'::jsonb),
                           'components', coalesce(f.match_result->'components', '{}'::jsonb),
                           'rules', coalesce(f.match_result->'rules', '{}'::jsonb)) as match,
        -- The skills and education snapshot the HR console scores ("Keyword match"), so the company
        -- sees the same number. Only these professional fields; nothing personal.
        jsonb_strip_nulls(jsonb_build_object(
          'career', f.matching_evidence->'career', 'skills', f.matching_evidence->'skills',
          'qualification', f.matching_evidence->'qualification', 'specialisation', f.matching_evidence->'specialisation',
          'semester', f.matching_evidence->'semester', 'graduationYear', f.matching_evidence->'graduationYear',
          'relevantMonths', f.matching_evidence->'relevantMonths', 'experienceScope', f.matching_evidence->'experienceScope')) as evidence,
        -- More of the candidate's own profile, for the "View profile" panel. Never contact details,
        -- the private "what holds you back" answers, salary history or career priorities.
        jsonb_build_object(
          'career_stage', f.cp->>'career_stage', 'qualification', f.cp->>'qualification',
          'specialisation', f.cp->>'specialisation', 'semester', f.cp->>'semester',
          'recent_role', f.cp->>'recent_role', 'industry', f.cp->>'industry',
          'preferred_roles', coalesce(f.cp->'preferred_roles', '[]'::jsonb),
          'career_area', f.cp->'career_preferences'->>'area', 'career_field', f.cp->'career_preferences'->>'field',
          'career_skills', coalesce(f.cp->'career_preferences'->'skills', '[]'::jsonb),
          'soft_skills', coalesce(f.cp->'career_preferences'->'softSkills', '[]'::jsonb),
          'portfolio_given', (f.portfolio_url is not null)) as profile,
        (f.resume_url is not null) as has_resume,
        jsonb_build_object('email', f.email, 'whatsapp', f.whatsapp, 'portfolio', f.portfolio_url, 'resume', f.resume_url) as contact
      from filtered f
      order by (f.match_result->>'score')::numeric desc nulls last, f.created_at desc, f.id
      offset p_offset limit p_limit) r), '[]'::jsonb),
    'total', (select count(*) from filtered),
    'counts', jsonb_build_object(
      'all', (select count(*) from base),
      'new', (select count(*) from base where employer_status = 'new'),
      'shortlisted', (select count(*) from base where employer_status = 'shortlisted'),
      'contacted', (select count(*) from base where employer_status = 'contacted'),
      'interview', (select count(*) from base where employer_status = 'interview'),
      'selected', (select count(*) from base where employer_status = 'selected'),
      'rejected', (select count(*) from base where employer_status = 'rejected'))
  ) into result;
  return result;
end;
$$;
revoke all on function public.employer_applicants(uuid, text, text, numeric, text, int, int) from public, anon;
grant execute on function public.employer_applicants(uuid, text, text, numeric, text, int, int) to authenticated;

-- 5. Resumes of everyone who applied to the company's own listings (unchanged from 20261128) --------
create or replace function public.employer_can_read_resume(p_name text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.job_applications a
    join public.hr_jobs j on j.id = a.job_id
    join public.employer_companies c on c.id = j.employer_id
    where c.owner_id = auth.uid() and c.status = 'approved' and a.resume_url = p_name);
$$;
revoke all on function public.employer_can_read_resume(text) from public, anon;
grant execute on function public.employer_can_read_resume(text) to authenticated;

drop policy if exists "Employers read shortlisted resumes" on storage.objects;
drop policy if exists "Employers read applicant resumes" on storage.objects;
create policy "Employers read applicant resumes" on storage.objects
  for select to authenticated
  using (bucket_id = 'resumes' and public.employer_can_read_resume(name));

commit;
