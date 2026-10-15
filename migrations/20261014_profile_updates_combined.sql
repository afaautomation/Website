-- Consolidated profile-form update: 2026-10-14.
-- Run in Supabase SQL Editor against your existing project.
-- Replaces running the three profile migrations separately; can be rerun.
-- Requires the existing public.candidate_profiles table from the site schema.
-- Preserves existing rows, authentication accounts, policies and application functions.
-- company_tenure and preferred_roles are retained for older profiles, although
-- the current form no longer asks those questions.
-- College/course/industry dropdown catalogues stay in the website files.
-- Unrelated admin and job-specific application migrations are not included.

begin;

do $$
begin
  if to_regclass('public.candidate_profiles') is null then
    raise exception 'candidate_profiles is missing. Restore or initialise the base site schema before running this update.';
  end if;
end $$;

-- Source: 20261011_candidate_onboarding.sql
-- Candidate onboarding (spec: Candidate Onboarding & Job Application Flow, 11 Oct 2026).
-- Adds career-stage routing fields to the reusable candidate profile. Existing
-- columns (degree, grad_year, experience, ...) are still filled by the profile
-- page, so apply_to_job() and the admin console keep working unchanged.
-- Safe to re-run; existing profiles are preserved.

alter table public.candidate_profiles
  add column if not exists career_stage text,
  add column if not exists qualification text,
  add column if not exists specialisation text,
  add column if not exists institution text,
  add column if not exists recent_role text,
  add column if not exists industry text,
  add column if not exists preferred_roles text[] not null default '{}',
  add column if not exists challenge_codes text[] not null default '{}',
  add column if not exists challenge_other text;

alter table public.candidate_profiles drop constraint if exists candidate_profiles_onboarding_check;
alter table public.candidate_profiles add constraint candidate_profiles_onboarding_check check (
  (career_stage is null or career_stage in ('studying', 'graduated', 'experienced'))
  and char_length(coalesce(qualification, '')) <= 120
  and char_length(coalesce(specialisation, '')) <= 120
  and char_length(coalesce(institution, '')) <= 200
  and char_length(coalesce(recent_role, '')) <= 80
  and char_length(coalesce(industry, '')) <= 80
  and char_length(coalesce(challenge_other, '')) <= 300
  -- "Select up to 2"
  and coalesce(cardinality(preferred_roles), 0) <= 2
  and coalesce(cardinality(challenge_codes), 0) <= 2
  and char_length(array_to_string(preferred_roles, '|')) <= 200
  and char_length(array_to_string(challenge_codes, '|')) <= 100
);

-- Source: 20261013_profile_education_details.sql
-- Apply after 20261011_candidate_onboarding.sql, before publishing the profile form.
-- Total career experience stays in experience; company tenure is stored separately.

alter table public.candidate_profiles
  add column if not exists semester text,
  add column if not exists company_tenure text;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_education_details_check;
alter table public.candidate_profiles add constraint candidate_profiles_education_details_check check (
  char_length(coalesce(semester, '')) <= 40
  and char_length(coalesce(company_tenure, '')) <= 40
);

-- Source: 20261013_career_preferences.sql
-- Apply before publishing the expanded step 3 of the candidate profile form.

alter table public.candidate_profiles
  add column if not exists career_preferences jsonb not null default '{}'::jsonb;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_career_preferences_check;
alter table public.candidate_profiles add constraint candidate_profiles_career_preferences_check
  check (jsonb_typeof(career_preferences) = 'object' and octet_length(career_preferences::text) <= 12000);

-- Refresh the API schema cache after commit.
notify pgrst, 'reload schema';
commit;

-- Verification: returns the 12 profile columns used or retained by these updates.
select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'candidate_profiles'
  and column_name in (
    'career_stage', 'qualification', 'specialisation', 'institution',
    'recent_role', 'industry', 'preferred_roles', 'challenge_codes',
    'challenge_other', 'semester', 'company_tenure', 'career_preferences'
  )
order by column_name;
