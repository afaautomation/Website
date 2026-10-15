# Database audit — 14 October 2026

Compared the live Supabase REST schema, the main website, SQL functions and triggers,
and the separate Resume frontend/backend (excluded by the root Git ignore rules).
No saved personal records were retrieved. The API exposes 13 tables, all supporting
active features. This is not a complete PostgreSQL catalog audit: private schemas,
live triggers, dynamic SQL and external consumers cannot be enumerated via REST.

## Keep all existing tables

| Table | Why it stays |
| --- | --- |
| profiles | Sign-in profile, avatar and staff authorization; used by the website and Resume backend. |
| candidate_profiles | Reusable candidate education, employment and career preferences. |
| job_applications | Submitted applications and their historical profile snapshots; used by admin and apply_to_job. |
| hr_jobs | Published jobs, job details and application destinations. |
| course_enrollments | Enrollment forms and syllabus-download leads. |
| enrollment_rate | Enrollment trigger's anti-abuse rate limiter; no direct browser query is expected. |
| site_content | Shared course content and dates managed by admin. |
| reels | Homepage video reels and admin reel editor. |
| resume_templates | Resume template selection, rendering, filtering and seeding. |
| resumes | Resume creation, editing, export and public sharing. |
| resume_versions | Resume history, snapshots and restoration. |
| import_jobs | Resume import processing and status polling. |
| writing_tips | Resume writing suggestions. |

## Confirmed obsolete fields

Only remove `candidate_profiles.company_tenure` and
`candidate_profiles.preferred_roles`. Their questions were intentionally removed.
The current career direction choices use `career_preferences`; total experience
uses `experience`. Updated create-profile.html no longer reads, writes or restores
preferred_roles. Existing tabs must refresh after the new frontend is published.

Other apparent duplicates remain meaningful: profiles is the account, candidate_profiles
is the reusable candidate record, and job_applications is the application snapshot.
`is_student` means enrollment in a Kompetenzen course, not the career-stage category.
`degree`, `experience`, `skills`, `work_mode` and location fields still participate in
application/admin contracts. Resume responses also expose complete rows; fields with
no explicit frontend mention are not automatically proven safe to remove.

## Deployment order

1. Publish the updated create-profile.html before dropping preferred_roles.
2. Run `20261014_remove_obsolete_profile_fields.sql` in Supabase SQL Editor.
   Both verification values should be true. The script removes only the two named
   columns and rebuilds the affected constraints. It does not drop tables or use CASCADE.
   It rolls back on tracked dependencies or public function-body references.
3. Refresh profile pages and confirm profile saving and submitting an application.

The live REST schema inspection succeeded. The cleanup has **not** been executed:
the configured service API credential can inspect/use REST resources but no direct
SQL connection or SQL execution endpoint is available in this workspace.

Do not rerun the older onboarding or combined profile migrations after cleanup;
they would recreate the removed fields. For fresh installations use the updated
supabase_schema.sql. For existing installations use the cleanup migration.

## Separate deployment gap

The live API schema lacks `hr_jobs.application_requirements` and the eight
job_applications response columns: college, availability, portfolio_url, matched_skills,
screening_answers, expected_salary, current_location, willing_to_relocate.
The current admin/job-detail code and local SQL schema expect these fields.
The existing `20261011_application_requirements.sql` supplies them and updates the
associated RPC functions. This is a missing migration, not unused data. Keep it
separate from cleanup and apply it before using per-job application requirements.
