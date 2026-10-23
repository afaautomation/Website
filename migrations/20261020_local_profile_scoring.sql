-- Apply after career matching and profile education migrations. No external services.
begin;
alter table public.candidate_profiles add column if not exists semester text;
create or replace function public.match_normalize(v text) returns text
language sql immutable set search_path = public as $$
 select case lower(regexp_replace(trim(coalesce(v,'')), '[.[:space:]]+', '', 'g'))
 when 'btech' then 'btech' when 'bca' then 'bca' when 'bsc' then 'bsc'
 when 'mtech' then 'mtech' when 'mca' then 'mca' when 'msc' then 'msc'
 when 'ballb' then 'ballb'
 else lower(regexp_replace(trim(coalesce(v,'')), '\s+', ' ', 'g')) end;
$$;
create or replace function public.evaluate_applicant_match_core(r jsonb, e jsonb) returns jsonb
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
      academic_count := academic_count + 1;
      if hit then academic_hits := academic_hits + 1; end if;
      if k like 'preferred%' then
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
  -- Fit is calculated independently of eligibility.
    if total_importance > 0 then sp := round(matched_importance / total_importance * sw, 1); end if;
    if academic_count > 0 then ap := round(academic_hits::numeric / academic_count * aw, 1); end if;
    if preferred > 0 and months is not null then ep := round(least(months / preferred, 1) * ew, 1); end if;
  if preferred > 0 then reasons := reasons || jsonb_build_array('Preferred experience: ' || coalesce(months::text,'unknown') || ' / ' || preferred || ' relevant months; missing optional evidence earns no bonus'); end if;
  return jsonb_build_object('status',status,'score',sp+ap+ep,
    'components',jsonb_build_object('skills',jsonb_build_object('points',sp,'weight',sw),'academics',jsonb_build_object('points',ap,'weight',aw),'experience',jsonb_build_object('points',ep,'weight',ew)),
    'reasons',reasons,'evidence','candidate_provided','profileUpdatedAt',e->'profileUpdatedAt','rules',r);
end; $$;

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
    result := result || '{"status":"not_matched","reviewRequired":true}';
  elsif unknown or result->>'status' = 'needs_information' then
    result := result || '{"status":"needs_information","reviewRequired":true}';
  end if;
  foreach k in array array['semesters','graduationYears'] loop
    if r ? k and jsonb_typeof(r->k) is distinct from 'array' then raise exception 'Invalid education criteria'; end if;
    if exists(select 1 from jsonb_array_elements_text(coalesce(r->k,'[]')) x
      where case when k = 'semesters' then x !~ '^(1[0-9]|20|[1-9])$' else x !~ '^(19|20|21)[0-9]{2}$' end)
      then raise exception 'Invalid semester or completion year'; end if;
    if jsonb_array_length(coalesce(r->k,'[]')) > 0 then
      actual := public.match_normalize(e->>case when k = 'semesters' then 'semester' else 'graduationYear' end);
      if actual = '' then
        if result->>'status' <> 'not_matched' then result := result || '{"status":"needs_information"}'; end if;
        reasons := reasons || jsonb_build_array(k || ': information missing');
      elsif not exists(select 1 from jsonb_array_elements_text(r->k) x where public.match_normalize(x) = actual) then
        result := result || '{"status":"not_matched"}';
        reasons := reasons || jsonb_build_array(k || ': outside configured intake');
      else reasons := reasons || jsonb_build_array(k || ': requirement met'); end if;
    end if;
  end loop;
  return result || jsonb_build_object('engine','local-rules-v3','reviewRequired',true,'scoreMeaning','Fit from available self-reported evidence; not a hiring decision','rules',r,'reasons',reasons || (result->'reasons'),'source','career_preferences');
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
    'career',career,'qualification',p->>'qualification','specialisation',p->>'specialisation','college',p->>'institution','semester',p->>'semester','graduationYear',p->>'grad_year');
  new.match_result := public.evaluate_applicant_match(r,new.matching_evidence);
  if new.submitted_matching_evidence = '{}' then new.submitted_matching_evidence := new.matching_evidence; end if;
  new.match_calculated_at := now();
  return new;
end; $$;

create or replace function public.refresh_profile_matches() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.institution,new.semester,new.grad_year,new.qualification,new.specialisation,new.career_preferences->'area',new.career_preferences->'field',new.career_preferences->'skills',new.career_preferences->'softSkills')
    is distinct from (old.institution,old.semester,old.grad_year,old.qualification,old.specialisation,old.career_preferences->'area',old.career_preferences->'field',old.career_preferences->'skills',old.career_preferences->'softSkills') then
    update public.job_applications set matching_evidence = matching_evidence || jsonb_build_object('profileUpdatedAt',now()) where user_id = new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists refresh_profile_matches on public.candidate_profiles;
create trigger refresh_profile_matches after update of institution,semester,grad_year,qualification,specialisation,career_preferences on public.candidate_profiles
for each row execute function public.refresh_profile_matches();


update public.job_applications set match_calculated_at = null;
commit;
