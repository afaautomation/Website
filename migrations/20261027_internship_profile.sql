-- Apply before publishing internships.html and internship-profile.html.
-- The internship form writes the shared profile columns (name, education,
-- career_preferences, preferred_location, resume) to the same candidate_profiles
-- row as create-profile.html, so each form shows what the other saved. Only the
-- internship-specific answers (duration, start month, mode, hours, stipend,
-- goal) live in this column.
begin;
alter table public.candidate_profiles
  add column if not exists internship_preferences jsonb not null default '{}'::jsonb;
alter table public.candidate_profiles drop constraint if exists candidate_profiles_internship_preferences_check;
alter table public.candidate_profiles add constraint candidate_profiles_internship_preferences_check
  check (jsonb_typeof(internship_preferences) = 'object' and octet_length(internship_preferences::text) <= 4000);
commit;
