-- Employer portal, part 3: a fuller candidate profile in the applicant list.
-- Safe to re-run. Run after 20261125_employer_applicants.sql, before publishing the updated employer.html.
-- Adds a "profile" object to each applicant row (career stage, qualification, specialisation, semester,
-- recent role, industry, preferred roles, career interest and the skills the candidate chose).
-- Contact details and the resume are still released only after the company shortlists the candidate.
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
                           'components', coalesce(f.match_result->'components', '{}'::jsonb)) as match,
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

commit;
