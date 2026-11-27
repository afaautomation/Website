-- Employer portal, part 5: applicants carry the same scoring evidence the HR console uses.
-- Safe to re-run. Run before publishing the updated employer.html.
--
-- This file includes everything from 20261126_employer_applicant_profile.sql and
-- 20261127_employer_applicant_contact.sql, so running only this one is enough:
--   * profile details for the "View profile" panel
--   * contact details and resume for everyone who applied to the company's own listings
--   * NEW: the skills/education snapshot (matching_evidence) and the job's rule snapshot, so the
--     employer page computes the same "Keyword match" score as the HR console
begin;

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
      'rejected', (select count(*) from base where employer_status = 'rejected'))
  ) into result;
  return result;
end;
$$;
revoke all on function public.employer_applicants(uuid, text, text, numeric, text, int, int) from public, anon;
grant execute on function public.employer_applicants(uuid, text, text, numeric, text, int, int) to authenticated;

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
