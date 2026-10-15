-- Apply after 20261011_candidate_onboarding.sql, before publishing the profile form.
-- Total career experience stays in experience; company tenure is stored separately.
begin;
alter table public.candidate_profiles
  add column if not exists semester text,
  add column if not exists company_tenure text;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_education_details_check;
alter table public.candidate_profiles add constraint candidate_profiles_education_details_check check (
  char_length(coalesce(semester, '')) <= 40
  and char_length(coalesce(company_tenure, '')) <= 40
);
commit;
