-- Deploy the updated create-profile.html BEFORE running this cleanup.
-- Removes answers for two questions deliberately removed from onboarding.
-- Keeps all 13 application tables and all remaining profile answers.
-- Do not rerun older onboarding migrations after this cleanup.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- PL/pgSQL bodies do not always have column-level dependency tracking.
-- Stop for review if a public function mentions one of the removed fields.
do $$
declare blockers text;
begin
  select string_agg(p.oid::regprocedure::text, ', ')
  into blockers
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.prosrc ~* '\m(company_tenure|preferred_roles)\M';
  if blockers is not null then
    raise exception 'Cleanup stopped: review functions referencing obsolete columns: %', blockers;
  end if;
end $$;

alter table public.candidate_profiles
  drop constraint if exists candidate_profiles_onboarding_check,
  drop constraint if exists candidate_profiles_education_details_check;

-- RESTRICT stops the transaction if a view or other external object depends on a column.
alter table public.candidate_profiles
  drop column if exists company_tenure restrict,
  drop column if exists preferred_roles restrict;

alter table public.candidate_profiles
  add constraint candidate_profiles_onboarding_check check (
    (career_stage is null or career_stage in ('studying', 'graduated', 'experienced'))
    and char_length(coalesce(qualification, '')) <= 120
    and char_length(coalesce(specialisation, '')) <= 120
    and char_length(coalesce(institution, '')) <= 200
    and char_length(coalesce(recent_role, '')) <= 80
    and char_length(coalesce(industry, '')) <= 80
    and char_length(coalesce(challenge_other, '')) <= 300
    and coalesce(cardinality(challenge_codes), 0) <= 2
    and char_length(array_to_string(challenge_codes, '|')) <= 100
  ),
  add constraint candidate_profiles_education_details_check check (
    char_length(coalesce(semester, '')) <= 40
  );

notify pgrst, 'reload schema';
commit;

-- Expected result: both values are true.
select
  not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'candidate_profiles' and column_name = 'company_tenure') as company_tenure_removed,
  not exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'candidate_profiles' and column_name = 'preferred_roles') as preferred_roles_removed;
