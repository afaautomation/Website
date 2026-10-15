# Admin workflow update

## Career-based matching (2026-10-15, latest)

After `20261015_applicant_matching.sql`, run **`20261015_career_matching.sql`** in Supabase SQL Editor. This switches existing results to the four approved career fields and recalculates them. Publish `create-profile.html`, `job-details.html`, `admin.html`, `js/career-catalog.js`, `js/career-preferences.js`, and `js/applicant-matching.js` together. The new migration has not been applied to production by this task.

The old Key skills picker is removed. Matching reads only `career_preferences.area`, `.field`, `.skills` and `.softSkills` for career/skill evidence. Old `skills` values and application skill-checkbox answers never substitute for these fields. Candidates missing the new information need to complete their career profile; existing legacy skill data is not automatically treated as new evidence. Academics and actual relevant experience retain their existing configured rules.

HR uses the same career/field catalogue as candidates. Selected interest and field are essential requirements; leaving them at Any imposes no restriction. HR selects technical and soft skills, marks each essential/preferred, and assigns importance. Both types share the existing skills ranking weight; there are no hidden extra points for interest or field. An unknown response earns no skill points and leaves essential skills unresolved. Neither experience stage nor offer/career priority affects matching. Editing these excluded fields does not trigger recalculation.

Original submitted evidence remains preserved. Relevant profile changes recalculate the current results; changing only the legacy Key skills column has no effect. The database regression test also executes the new migration twice and verifies these exclusions.

## Automatic applicant matching (2026-10-15)

Apply `20261015_applicant_matching.sql` after the existing onboarding and application-requirements migrations, then publish `admin.html`, `job-details.html`, and `js/applicant-matching.js`. No live migration or deployment is performed by the local implementation. Existing listings are deliberately marked **Rules not configured** until staff configures their requirements.

In **Post & Manage Jobs**, enable automatic filtering and enter structured skills, essential academic alternatives, preferred academic criteria and relevant experience targets. Existing listings: open the job's applicants and choose **Edit this job’s matching rules**. Exact names are case-insensitive and whitespace-normalized; aliases must be entered consistently. No fuzzy matching, degree hierarchy or institution prestige is used.

Only eligible applicants receive a score. Default weights are skills 70, academics 20, experience 10. An inactive category's weight moves to skills, then academics, then experience, choosing the first active category. With no ranking criteria, eligible applicants tie at zero. Preferred qualification and specialisation groups receive equal shares of academic points; each group accepts any listed alternative. Experience earns `min(relevant months / preferred months, 1)` of its points, using the job's explicit experience scope. Candidates are told not to double-count overlapping periods. All evidence is self-declared.

The database calculates matching transactionally on application writes, rule edits and relevant profile edits. No background service is required. A computation error rolls back the write and is reported to the caller; there is no separate retry queue. Rule changes recalculate the job's applications in the same transaction. This is intended for the current site's workload; large bulk edits should be load-tested before deployment. Results retain the exact rules and calculation time. Original submitted matching evidence is retained separately; updated profiles are labelled in the explanation. Changing the experience scope makes earlier experience evidence unknown instead of reusing it for a different criterion.

The HR results default to matched applicants, descending score, then earliest application time and ID. Status filtering and 25-row pagination run in the database with staff access checks. Overview queries return aggregate counts, not candidate profiles. The manual criteria panel has been removed. Name/email/phone search and CSV export apply to the current results page without changing automatic ranking. Matching never changes hiring decisions or deletes applications. Experience-stage and career-priority answers are excluded entirely.

Local validation (synthetic data only):

```text
npm install --prefix tmp/matching-tests --no-save --ignore-scripts @electric-sql/pglite
node --test tests/applicant-matching.test.cjs tests/admin-workflows.test.cjs
```

The PostgreSQL test executes the real migration twice and tests submission, eligibility, the four example scores, weight redistribution, unknown vs explicit failure, profile/rule recalculation, preserved evidence, pagination and staff restrictions. It does not connect to Supabase. Set `PGLITE_MODULE` to a different installed module path if necessary.

## Latest cleanup (2026-10-14)

See `DATABASE_AUDIT_20261014.md` for the live-schema audit and deployment order.
Publish the updated profile page, then run `20261014_remove_obsolete_profile_fields.sql`
to remove only `candidate_profiles.company_tenure` and `candidate_profiles.preferred_roles`.
All 13 tables remain in use. Do not rerun older profile migrations after this cleanup.

Apply `20261007_admin_workflows.sql` in the Supabase project's SQL Editor before using the updated admin page. Run this migration, rather than re-running the whole schema file, to avoid unrelated schema changes.

This adds shared course content and two protected admin functions. Reel replacement runs in one transaction; insertion failures preserve the previous list. Existing job, application, and reel records are preserved when this migration is applied.

Staff sign in using their existing Supabase email and password. Their `profiles.role` must already be `admin`; ordinary accounts cannot unlock the console. No shared page password is used.

Course dates and students previously saved only in a staff browser remain available there as a fallback when no published row exists. Use the course controls to publish that content into the shared database. Public pages read the shared database.

After applying the migration, verify with an authorized staff account that applications load, a test listing retains its details, and published course/reel changes appear in a separate browser. Local tests use simulated database responses and do not change live records.

Run the regression checks from the project folder:

```text
node --test tests/admin-workflows.test.cjs
```

# Security hardening (2026-10-10)

Apply `20261010_security_hardening.sql` in the SQL Editor. The live database allowed anonymous visitors to insert job listings; this migration drops every policy on the main-site tables and recreates only the intended ones, removes the blank test listing, rate-limits enrollments per IP instead of globally, and caps resume uploads at 5 MB (PDF/DOC/DOCX). It is safe to re-run and preserves existing records.

Afterwards, run the verification query at the end of the file. Also in the Supabase dashboard: Authentication → Providers → Email → turn on "Confirm email".

# Candidate onboarding (2026-10-11)

Apply `20261011_candidate_onboarding.sql` **before** publishing the new `create-profile.html`; the page saves to these columns and saving fails without them. It adds career stage, qualification, institution, recent role, industry, preferred roles (up to 2) and career-challenge answers (up to 2) to `candidate_profiles`. Existing profiles, applications and `apply_to_job()` are unchanged.

# Job and internship application requirements (2026-10-11)

Apply `20261011_application_requirements.sql` **after** `20261011_candidate_onboarding.sql`, and before publishing the updated `admin.html`, `job-details.html` and `create-profile.html`. Staff tick, per job or internship, what the application form asks (resume, college, availability, skills check, portfolio link, expected salary, current location and willingness to relocate, up to 5 extra questions). `apply_to_job()` now checks those answers on the server and stores them on the application. Listings without requirements apply in one click as before. Existing jobs and applications are preserved.

# Staff Domain Admin Role (2026-10-11)

Apply `20261011_staff_domain_admin.sql` in the Supabase SQL Editor. This updates the `handle_new_user()` trigger so that any staff member who signs up or registers with a `@kompetenzen.in` email address (e.g. `name@kompetenzen.in`) automatically gets the `admin` role in `public.profiles`. It also promotes any existing accounts matching that domain.

# Profile education and company tenure (2026-10-13)

Apply `20261013_profile_education_details.sql` after the candidate onboarding migration and before publishing the updated profile form. It adds `semester` and `company_tenure`; existing total experience remains unchanged. The college directory is a bundled snapshot of Kerala CEE and Higher Education Department lists, retrieved 2026-10-13, with an Other entry for missing colleges.

# Career interests (2026-10-13)
Apply 20261013_career_preferences.sql before publishing the expanded profile step 3. It stores career area, field, technical and soft skills, self-described experience, offer preference, and the displayed offer order in career_preferences. These are self-reported preferences, not assessment scores.

# Staff email allowlist (2026-10-14)

Apply `20261014_staff_email_allowlist.sql` in the Supabase SQL Editor. It replaces the `@kompetenzen.in` rule from `20261011_staff_domain_admin.sql`. Anyone can sign up on the staff page, but only emails listed in `public.staff_emails` can open the console. To grant access, add a row in Table Editor → `staff_emails` (just the email). To revoke, delete the row. Changes apply on the next sign-in. The migration seeds the table with every current admin and `afaautomations@gmail.com`.


## Invite-only admin login (current)

The staff allowlist signup flow above is superseded by `20261014_invite_only_admin.sql`. Deploy the website and backend changes, then follow [ADMIN_LOGIN_SETUP.md](ADMIN_LOGIN_SETUP.md). Do not rerun the domain-admin or old allowlist migrations after this migration. Invitations and password setup now verify email ownership; there is no public staff signup.
