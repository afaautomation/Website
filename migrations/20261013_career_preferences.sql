-- Apply before publishing the expanded step 3 of the candidate profile form.
begin;
alter table public.candidate_profiles
  add column if not exists career_preferences jsonb not null default '{}'::jsonb;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_career_preferences_check;
alter table public.candidate_profiles add constraint candidate_profiles_career_preferences_check
  check (jsonb_typeof(career_preferences) = 'object' and octet_length(career_preferences::text) <= 12000);
commit;
