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
