# Admin workflow update

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
