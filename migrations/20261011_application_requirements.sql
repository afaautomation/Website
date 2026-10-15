-- Job-specific application requirements (jobs and internships).
-- Staff choose per listing what to ask; candidates are asked only for that, and
-- apply_to_job() refuses an application until the required answers are given.
-- Run after 20261011_candidate_onboarding.sql. Safe to re-run; data is preserved.
begin;

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

commit;
