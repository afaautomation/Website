-- Run after 20261011_application_requirements.sql and candidate onboarding migrations.
-- Matching runs in the database, never in an applicant browser. No external worker needed.
begin;

alter table public.hr_jobs drop constraint if exists hr_jobs_application_requirements_check;
alter table public.hr_jobs add constraint hr_jobs_application_requirements_check check (
  jsonb_typeof(application_requirements) = 'object'
  and (application_requirements->'questions' is null or
    (jsonb_typeof(application_requirements->'questions') = 'array' and jsonb_array_length(application_requirements->'questions') <= 5))
  and char_length(application_requirements::text) <= 12000
);

create or replace function public.match_normalize(v text) returns text
language sql immutable set search_path = public as $$ select lower(regexp_replace(trim(coalesce(v, '')), '\s+', ' ', 'g')); $$;

-- Pure evaluator. Only these allowlisted evidence fields participate.
create or replace function public.evaluate_applicant_match(r jsonb, e jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare
  s jsonb; k text; options jsonb; actual text; hit boolean; confirmed boolean;
  failed boolean := false; unknown boolean := false; reasons jsonb := '[]';
  total_importance numeric := 0; matched_importance numeric := 0;
  academic_count int := 0; academic_hits int := 0;
  sw numeric; aw numeric; ew numeric; unused numeric := 0;
  sp numeric := 0; ap numeric := 0; ep numeric := 0;
  months numeric; minimum numeric; preferred numeric; status text;
begin
  if r is null or r = '{}'::jsonb then return jsonb_build_object('status','unconfigured','score',null,'reasons',jsonb_build_array('HR must configure structured matching requirements.')); end if;
  if jsonb_typeof(r) is distinct from 'object' or jsonb_typeof(r->'skills') is distinct from 'array' or jsonb_array_length(r->'skills') > 30 then raise exception 'Invalid matching skills'; end if;
  sw := (r->'weights'->>'skills')::numeric; aw := (r->'weights'->>'academics')::numeric; ew := (r->'weights'->>'experience')::numeric;
  if sw is null or aw is null or ew is null or sw < 0 or aw < 0 or ew < 0 or sw+aw+ew <> 100 or trunc(sw) <> sw or trunc(aw) <> aw or trunc(ew) <> ew then raise exception 'Matching weights must total 100 and use whole numbers'; end if;
  minimum := (r->>'minimumMonths')::numeric; preferred := (r->>'preferredMonths')::numeric;
  if minimum is null or preferred is null or minimum < 0 or preferred < 0 or minimum > 600 or preferred > 600 or trunc(minimum) <> minimum or trunc(preferred) <> preferred then raise exception 'Invalid experience target'; end if;
  if (minimum > 0 or preferred > 0) and nullif(trim(r->>'experienceScope'),'') is null then raise exception 'Define relevant experience'; end if;
  if jsonb_typeof(e->'relevantMonths') = 'number' then months := (e->>'relevantMonths')::numeric; end if;
  -- Experience is valid only for the exact scope that the applicant confirmed.
  if months < 0 or months > 600 or trunc(months) <> months or e->>'experienceScope' is distinct from r->>'experienceScope' then months := null; end if;
  -- Academic eligibility before ranking; no institution, prestige or degree hierarchy.
  foreach k in array array['qualifications','specialisations','preferredQualifications','preferredSpecialisations'] loop
    options := r->k;
    if jsonb_typeof(options) is distinct from 'array' then raise exception 'Invalid academic criteria'; end if;
    actual := public.match_normalize(e->>case when k in ('qualifications','preferredQualifications') then 'qualification' else 'specialisation' end);
    if jsonb_array_length(options) > 0 then
      hit := actual <> '' and exists(select 1 from jsonb_array_elements_text(options) x where public.match_normalize(x) = actual);
      if k like 'preferred%' then
        academic_count := academic_count + 1;
        if hit then academic_hits := academic_hits + 1; end if;
        reasons := reasons || jsonb_build_array(k || ': ' || case when hit then 'demonstrated' else 'no demonstrated bonus' end);
      elsif actual = '' then unknown := true; reasons := reasons || jsonb_build_array(k || ': information missing');
      elsif not hit then failed := true; reasons := reasons || jsonb_build_array(k || ': does not meet accepted alternatives');
      else reasons := reasons || jsonb_build_array(k || ': requirement met'); end if;
    end if;
  end loop;
  if (select count(*) <> count(distinct public.match_normalize(x->>'name')) from jsonb_array_elements(r->'skills') x) then raise exception 'Duplicate matching skills'; end if;
  for s in select value from jsonb_array_elements(r->'skills') loop
    if nullif(public.match_normalize(s->>'name'),'') is null or jsonb_typeof(s->'essential') is distinct from 'boolean' or (s->>'importance')::numeric is null or (s->>'importance')::numeric <= 0 or (s->>'importance')::numeric > 100 then raise exception 'Invalid skill rule'; end if;
    total_importance := total_importance + (s->>'importance')::numeric;
    -- An explicit answer overrides the older profile. An unlisted skill alone is unknown.
    confirmed := exists(select 1 from jsonb_array_elements_text(coalesce(e->'confirmedSkills','[]')) x where public.match_normalize(x) = public.match_normalize(s->>'name'));
    hit := exists(select 1 from jsonb_array_elements_text(case when confirmed then coalesce(e->'selectedSkills','[]') else coalesce(e->'skills','[]') end) x where public.match_normalize(x) = public.match_normalize(s->>'name'));
    if hit then matched_importance := matched_importance + (s->>'importance')::numeric;
    elsif (s->>'essential')::boolean then
      if confirmed then failed := true; else unknown := true; end if;  
    end if;
    reasons := reasons || jsonb_build_array((s->>'name') || ': ' || case when hit then 'self-declared skill present' when not (s->>'essential')::boolean then 'no demonstrated bonus' when confirmed then 'essential skill explicitly not selected' else 'essential skill needs confirmation' end);
  end loop;
  if minimum > 0 then
    if months is null then unknown := true; reasons := reasons || jsonb_build_array('Relevant experience: information missing');
    elsif months < minimum then failed := true; reasons := reasons || jsonb_build_array('Relevant experience: below essential ' || minimum || ' months');
    else reasons := reasons || jsonb_build_array('Relevant experience: essential minimum met'); end if;
  end if;
  -- Transfer inactive components to the first active component in this documented order.
  if total_importance = 0 then unused := unused + sw; sw := 0; end if;
  if academic_count = 0 then unused := unused + aw; aw := 0; end if;
  if preferred = 0 then unused := unused + ew; ew := 0; end if;
  if total_importance > 0 then sw := sw + unused;
  elsif academic_count > 0 then aw := aw + unused;
  elsif preferred > 0 then ew := ew + unused; end if;
  status := case when failed then 'not_matched' when unknown then 'needs_information' else 'matched' end;
  if status = 'matched' then
    if total_importance > 0 then sp := round(matched_importance / total_importance * sw, 1); end if;
    if academic_count > 0 then ap := round(academic_hits::numeric / academic_count * aw, 1); end if;
    if preferred > 0 and months is not null then ep := round(least(months / preferred, 1) * ew, 1); end if;
  end if;
  if preferred > 0 then reasons := reasons || jsonb_build_array('Preferred experience: ' || coalesce(months::text,'unknown') || ' / ' || preferred || ' relevant months; missing optional evidence earns no bonus'); end if;
  return jsonb_build_object('status',status,'score',case when status = 'matched' then sp+ap+ep else null end,
    'components',case when status = 'matched' then jsonb_build_object('skills',jsonb_build_object('points',sp,'weight',sw),'academics',jsonb_build_object('points',ap,'weight',aw),'experience',jsonb_build_object('points',ep,'weight',ew)) else '{}'::jsonb end,
    'reasons',reasons,'evidence','candidate_provided','profileUpdatedAt',e->'profileUpdatedAt','rules',r);
end; $$;

alter table public.job_applications add column if not exists matching_evidence jsonb not null default '{}',
  add column if not exists submitted_matching_evidence jsonb not null default '{}',
  add column if not exists match_result jsonb not null default '{"status":"pending"}',
  add column if not exists match_calculated_at timestamptz;
create index if not exists job_applications_match_order on public.job_applications(job_id, (match_result->>'status'), ((match_result->>'score')::numeric) desc, created_at, id);

create or replace function public.calculate_application_match() returns trigger
language plpgsql security definer set search_path = public as $$
declare r jsonb; p jsonb;
begin
  select application_requirements->'matching' into r from public.hr_jobs where id = new.job_id for share;
  if tg_op = 'INSERT' or new.matching_evidence = '{}'::jsonb then
    select to_jsonb(c) into p from public.candidate_profiles c where user_id = new.user_id;
    new.matching_evidence := jsonb_build_object('qualification',coalesce(p->>'qualification',new.degree),'specialisation',p->>'specialisation',
      'skills',to_jsonb(regexp_split_to_array(coalesce(new.skills,''), '\s*,\s*')), 'snapshotAt',now());
  end if;
  new.match_result := public.evaluate_applicant_match(r,new.matching_evidence);
  if new.submitted_matching_evidence = '{}'::jsonb then new.submitted_matching_evidence := new.matching_evidence; end if;
  new.match_calculated_at := now();
  return new;
end; $$;
drop trigger if exists calculate_application_match on public.job_applications;
create trigger calculate_application_match before insert or update on public.job_applications
for each row execute function public.calculate_application_match();

create or replace function public.refresh_job_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.application_requirements->'matching' is distinct from old.application_requirements->'matching' then
    perform public.evaluate_applicant_match(new.application_requirements->'matching','{}');
    update public.job_applications set match_calculated_at = null where job_id = new.id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_job_matches on public.hr_jobs;
create trigger refresh_job_matches after update of application_requirements on public.hr_jobs
for each row execute function public.refresh_job_matches();
create or replace function public.validate_job_matching() returns trigger
language plpgsql set search_path = public as $$
begin
  perform public.evaluate_applicant_match(new.application_requirements->'matching','{}');
  return new;
end; $$;
drop trigger if exists validate_job_matching on public.hr_jobs;
create trigger validate_job_matching before insert or update of application_requirements on public.hr_jobs
for each row execute function public.validate_job_matching();

-- Preserve existing submission validation, authentication and duplicate protection.
do $$ begin
  if to_regprocedure('public.apply_to_job_before_matching(uuid,jsonb)') is null then
    alter function public.apply_to_job(uuid,jsonb) rename to apply_to_job_before_matching;
  end if;
end $$;
revoke all on function public.apply_to_job_before_matching(uuid,jsonb) from public, anon, authenticated;
create or replace function public.apply_to_job(p_job_id uuid, p_responses jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; answer jsonb; result jsonb; m jsonb; existing uuid;
begin
  if auth.uid() is null then return jsonb_build_object('status','auth_required'); end if;
  select id into existing from public.job_applications where job_id = p_job_id and user_id = auth.uid();
  if existing is not null then return public.apply_to_job_before_matching(p_job_id,p_responses); end if;
  if not exists(select 1 from public.candidate_profiles where user_id = auth.uid()) then return jsonb_build_object('status','profile_required'); end if;
  select application_requirements->'matching' into r from public.hr_jobs where id = p_job_id for share;
  if r is not null and r <> '{}'::jsonb then
    answer := p_responses->'matching';
    if answer is null or jsonb_typeof(answer) <> 'object' or answer->'confirmed' is distinct from 'true'::jsonb or answer->'rules' is distinct from r then
      return jsonb_build_object('status','responses_required','missing',jsonb_build_array('matching'),'matching_rules',r);
    end if;
    if jsonb_typeof(answer->'selectedSkills') is distinct from 'array' or jsonb_array_length(answer->'selectedSkills') > 30 then raise exception 'Invalid skill confirmation'; end if;
    if answer->'relevantMonths' is not null and answer->'relevantMonths' <> 'null'::jsonb then
      if jsonb_typeof(answer->'relevantMonths') <> 'number' or (answer->>'relevantMonths')::numeric < 0 or (answer->>'relevantMonths')::numeric > 600 or trunc((answer->>'relevantMonths')::numeric) <> (answer->>'relevantMonths')::numeric then raise exception 'Invalid experience months'; end if;
    end if;
  end if;
  result := public.apply_to_job_before_matching(p_job_id,p_responses);
  -- Do not mutate a duplicate application, including concurrent duplicate submissions.
  if result->>'status' = 'applied' and answer is not null then
    m := jsonb_build_object('confirmedSkills',(select coalesce(jsonb_agg(x->>'name'),'[]') from jsonb_array_elements(r->'skills') x),
      'selectedSkills',answer->'selectedSkills','relevantMonths',answer->'relevantMonths','experienceScope',r->>'experienceScope');
    update public.job_applications set matching_evidence = matching_evidence || m, submitted_matching_evidence = matching_evidence || m where job_id = p_job_id and user_id = auth.uid();
  end if;
  return result;
end; $$;
revoke all on function public.apply_to_job(uuid,jsonb) from public;
grant execute on function public.apply_to_job(uuid,jsonb) to authenticated;

-- Server-side status filtering, score ordering and pagination. The caller must be staff.
create or replace function public.admin_matched_applicants(p_job_id uuid, p_status text default 'matched', p_offset int default 0, p_limit int default 25) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'Staff access required'; end if;
  if p_status not in ('all','matched','needs_information','not_matched','unconfigured','pending') or p_offset < 0 or p_limit < 1 or p_limit > 100 then raise exception 'Invalid applicant query'; end if;
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(t)) from (
    select a.* from public.job_applications a where (a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id))) and (p_status = 'all' or a.match_result->>'status' = p_status)
    order by case when a.match_result->>'status' = 'matched' then 0 else 1 end, (a.match_result->>'score')::numeric desc nulls last, a.created_at, a.id
    offset p_offset limit p_limit) t),'[]'),
    'total',(select count(*) from public.job_applications a where (a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id))) and (p_status = 'all' or a.match_result->>'status' = p_status)),
    'counts',(select coalesce(jsonb_object_agg(status,n),'{}') from (select a.match_result->>'status' status,count(*) n from public.job_applications a where a.job_id = p_job_id or (p_job_id is null and not exists(select 1 from public.hr_jobs j where j.id = a.job_id)) group by 1) c)) into result;
  return result;
end; $$;
revoke all on function public.admin_matched_applicants(uuid,text,int,int) from public;
grant execute on function public.admin_matched_applicants(uuid,text,int,int) to authenticated;

create or replace function public.admin_matching_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Staff access required'; end if;
  return jsonb_build_object('jobs',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (
    select j.*, (select count(*) from public.job_applications a where a.job_id = j.id) as applicant_count,
      (select count(*) from public.job_applications a where a.job_id = j.id and a.match_result->>'status' = 'matched') as matched_count,
      (select count(*) from public.job_applications a where a.job_id = j.id and a.match_result->>'status' = 'needs_information') as needs_information_count
    from public.hr_jobs j order by j.created_at desc) t),
    'total',(select count(*) from public.job_applications),
    'other',(select count(*) from public.job_applications a where not exists(select 1 from public.hr_jobs j where j.id = a.job_id)));
end; $$;
revoke all on function public.admin_matching_overview() from public;
grant execute on function public.admin_matching_overview() to authenticated;
revoke all on function public.calculate_application_match(), public.refresh_job_matches(), public.validate_job_matching() from public;

create or replace function public.refresh_profile_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.qualification,new.specialisation,new.skills) is distinct from (old.qualification,old.specialisation,old.skills) then
    update public.job_applications set matching_evidence =
      (case when new.skills is distinct from old.skills then matching_evidence - 'confirmedSkills' - 'selectedSkills' else matching_evidence end)
      || jsonb_build_object('qualification',new.qualification,'specialisation',new.specialisation,
          'skills',to_jsonb(regexp_split_to_array(coalesce(new.skills,''),'\s*,\s*')),'profileUpdatedAt',now())
    where user_id = new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_profile_matches on public.candidate_profiles;
create trigger refresh_profile_matches after update of qualification,specialisation,skills on public.candidate_profiles for each row execute function public.refresh_profile_matches();
revoke all on function public.refresh_profile_matches() from public;

-- Existing evidence is retained as a snapshot; unknown skills are never treated as a No.
update public.job_applications set match_calculated_at = null;
commit;
