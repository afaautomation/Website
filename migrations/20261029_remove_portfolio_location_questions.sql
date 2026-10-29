-- Applications no longer ask for a portfolio link or current location (20261029).
-- apply_to_job() still honours these flags, so clear them on every existing listing.
update public.hr_jobs
set application_requirements = application_requirements || '{"portfolio":false,"location":false}'::jsonb
where coalesce((application_requirements->>'portfolio')::boolean, false)
   or coalesce((application_requirements->>'location')::boolean, false);
