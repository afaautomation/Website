# Invite-only admin login

The staff console uses Supabase email/password login. A verified account must also be listed in `public.staff_emails`. Neither an `@kompetenzen.in` email nor `profiles.role` grants access. Student signup is unchanged. Only the project owner uses the Supabase dashboard to invite or approve staff; there is no public invitation API.

## Activate

1. Publish the website changes and deploy/restart the Resume backend and local development server. Both old `/api/auth/staff-signup` endpoints must return HTTP 410 before allowing staff login.
2. In Supabase Table Editor, review `staff_emails` if it already exists. Remove any unapproved entries, especially entries marked `existing admin` that an earlier migration copied automatically. Keep your own approved email. This migration preserves the list; it does not certify its existing entries.
3. Run **20261014_invite_only_admin.sql** in the Supabase SQL Editor. Do not rerun the old domain-admin or staff-email-allowlist migrations afterward. The new migration is also included in the canonical schema for fresh installations; do not run the entire schema to upgrade an existing database.
4. In Authentication → URL Configuration, set the correct HTTPS Site URL and add the exact deployed `https://YOUR-DOMAIN/admin-password.html` to Redirect URLs. Add `http://localhost:3000/admin-password.html` only for local testing. Avoid wildcard production redirects. Supabase ignores redirects outside the allowlist.
5. In Authentication settings, keep email confirmation enabled, set the password minimum to 12 characters, and configure Auth rate limits and your production email sender/SMTP. The page uses Supabase Auth's server-side rate limiting; its disabled buttons and reset cooldown are only usability measures. Configure leaked-password protection if available on your plan. Do not disable email confirmation to work around mail delivery limits.
6. Test with an approved account, a verified but unapproved account, a signed-out browser, an expired invitation and a revoked staff account. Confirm direct database reads/writes for unapproved accounts are denied by RLS. The existing admin data policies call `is_admin()`; the migration replaces that function. Review any custom policies added outside the repository before production use.

## Invite someone

1. Authentication → Users → Invite user: enter the staff member's email. Leave the invitation template's confirmation link intact. When the default invitation returns to the website's Site URL, the shared auth script forwards `type=invite` to the new password page. An API invitation may instead use the explicit allowed `admin-password.html` redirect.
2. Table Editor → `staff_emails` → Insert row: enter that exact email and an optional note. The table normalizes its casing and whitespace. There is no need to edit `profiles.role`.
3. The person opens the emailed link, chooses a password, then signs in at `admin.html`. They must prove email ownership before the database permits admin access.

For an account that already exists, approve its email in `staff_emails`, then use its existing password or the **Forgot password?** link. Never replace a user's password through a public account-creation endpoint. An owner who already has an account can use this same process to bootstrap access if the staff list is empty.

## Revoke access

Delete the person's row from `staff_emails`. Database and backend authorization recheck the list on requests, so a still-valid login token no longer grants staff permissions. The UI relocks on token refresh or the next sign-in. Already displayed/downloaded data cannot be recalled. To disable the account entirely, also ban it in Supabase Authentication.

## Checks and limitations

Automated tests cover staff login denial, approved access, failed authorization, sign-out races, password confirmation/expired sessions, backend allowlist checks, and retirement of both signup endpoints. No real invitations were sent and no production SQL/settings were changed by these code changes. Complete the activation steps above before calling the live deployment secure.

Official references: [Invitations](https://supabase.com/docs/guides/auth/users), [password recovery](https://supabase.com/docs/guides/auth/passwords), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).
