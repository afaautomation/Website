-- Candidate onboarding (spec: Candidate Onboarding & Job Application Flow, 11 Oct 2026).
-- Adds career-stage routing fields to the reusable candidate profile. Existing
-- columns (degree, grad_year, experience, ...) are still filled by the profile
-- page, so apply_to_job() and the admin console keep working unchanged.
-- Safe to re-run; existing profiles are preserved.
begin;

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

commit;
