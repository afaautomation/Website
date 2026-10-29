# Moving Supabase from Tokyo to Mumbai

The current project (`xgnluardsgflfxttvgwc`, **Tokyo**, `ap-northeast-1`) is far from users in Kerala: every login and database read crosses to Japan and back. Supabase cannot change a project's region, so this guide creates a new project in **Mumbai** (`ap-south-1`) and moves everything into it.

**What moves:** database (about 20 MB: tables, functions, policies, data), user accounts with their passwords, Storage files (`resumes`, `site-media`), 5 Edge Functions and their secrets, the notification scheduler, and the Auth settings.

**Effects:** everyone must sign in again once, because the new project has new keys. Passwords keep working. Do it before launch, in a quiet hour. Expect about 1–2 hours.

**You need:** Docker Desktop running, Node.js, and the Supabase CLI (`npx supabase`). Run the commands in **PowerShell** from the website folder.

---

## Step 1: Create the new project

1. Supabase dashboard → **New project**.
2. Same organisation, name e.g. `Kompetenzen`, **Region: South Asia (Mumbai)**.
3. Set a strong **database password** and save it in your password manager.
4. Wait until the project is ready, then note:
   - **Project ref**: the part of the URL after `/project/` (e.g. `abcdefghijklmnop`).
   - **Settings → API Keys**: the **publishable** key and the **secret** (service role) key.

In this guide, replace `NEWREF` with the new ref.

## Step 2: Connection strings

For **each** project (old and new): dashboard → **Connect** → **Session pooler** → copy the URI. It looks like:

```
postgresql://postgres.REF:[YOUR-PASSWORD]@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Put in the database password. If the password contains `@ : / ? # %`, encode them (`@` → `%40`, `#` → `%23`, `%` → `%25`, `/` → `%2F`, `:` → `%3A`, `?` → `%3F`).

Keep them in this PowerShell window only (not in a file):

```powershell
$OLD_DB = 'postgresql://postgres.xgnluardsgflfxttvgwc:PASSWORD@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres'
$NEW_DB = 'postgresql://postgres.NEWREF:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
```

## Step 3: Back up the old database

```powershell
mkdir migration-backup
npx supabase db dump --db-url $OLD_DB -f migration-backup/roles.sql --role-only
npx supabase db dump --db-url $OLD_DB -f migration-backup/schema.sql
npx supabase db dump --db-url $OLD_DB -f migration-backup/data.sql --use-copy --data-only
```

`data.sql` contains user accounts and private data. Never commit `migration-backup/` or send it to anyone. Delete it at the end (Step 13).

## Step 4: Restore into the new project

```powershell
docker run --rm -v "${PWD}/migration-backup:/work" -w /work postgres:17 `
  psql --single-transaction --variable ON_ERROR_STOP=1 `
  --file roles.sql --file schema.sql `
  --command "SET session_replication_role = replica" `
  --file data.sql --dbname $NEW_DB
```

It should end without `ERROR`. If it stops on an error, copy that error line (not the whole output) and fix it before going on. Because it runs as one transaction, a failed run leaves the new database unchanged, so you can simply run it again.

**Check:** new project → **Table Editor**: `hr_jobs`, `reels`, `job_applications` and the rest have rows; **Authentication → Users** shows the 2 users.

The dump skips the `auth` and `storage` schemas, so it does not carry the Storage upload policies or the trigger that creates a profile for each new account. Run `migrations/20261029_restore_auth_storage_rules.sql` in the new project's **SQL Editor** to add them.

## Step 5: Copy the Storage files

The restore created the buckets and file records; this copies the files themselves.

```powershell
$env:OLD_SUPABASE_URL = 'https://xgnluardsgflfxttvgwc.supabase.co'
$env:OLD_SERVICE_KEY  = 'OLD secret key'
$env:NEW_SUPABASE_URL = 'https://NEWREF.supabase.co'
$env:NEW_SERVICE_KEY  = 'NEW secret key'
node scripts/copy-storage.cjs resumes site-media
Remove-Item Env:OLD_SERVICE_KEY, Env:NEW_SERVICE_KEY
```

Expected: `resumes: copied 11 of 11 files` and `site-media: copied 6 of 6 files`.

The homepage showcase saved full image addresses containing the old project ref. Point them at the new project (new project → **SQL Editor**):

```sql
update public.site_content
set value = replace(value::text, 'xgnluardsgflfxttvgwc', 'NEWREF')::jsonb
where key = 'kompetenzen_showcase';
```

## Step 6: Link the CLI and deploy the Edge Functions

```powershell
npx supabase link --project-ref NEWREF
npx supabase functions deploy --project-ref NEWREF
```

This deploys `notification-worker`, `notification-whatsapp-inbound`, `whatsapp-otp`, `phone-signup` and `send-sms-hook`, with the JWT settings from `supabase/config.toml`.

## Step 7: Function secrets

The `SUPABASE_*` values are set automatically. Set the others with the **same values as the old project** (from your password manager, Meta and Google), using single quotes:

```powershell
npx supabase secrets set --project-ref NEWREF `
  'SITE_URL=https://kompetenzen.pages.dev' `
  'WHATSAPP_PHONE_NUMBER_ID=...' 'WHATSAPP_ACCESS_TOKEN=...' `
  'WHATSAPP_APP_SECRET=...' 'WHATSAPP_VERIFY_TOKEN=...' `
  'GMAIL_CLIENT_ID=...' 'GMAIL_CLIENT_SECRET=...' `
  'GMAIL_REFRESH_TOKEN=...' 'GMAIL_SENDER_EMAIL=...'
```

Add `WHATSAPP_TEMPLATE_OTP`, `WHATSAPP_TEMPLATE_LANGUAGE` or `WHATSAPP_API_VERSION` only if you set them before. `SEND_SMS_HOOK_SECRET` and `NOTIFICATION_WORKER_SECRET` are new values, created in Steps 8 and 9.

**Check:** `npx supabase secrets list --project-ref NEWREF` lists every name.

## Step 8: Authentication settings (dashboard, new project)

These are not part of the database and must be set again. Open the old project in another tab and copy each one.

| Where | Set |
|---|---|
| **Authentication → URL Configuration** | **Site URL** and every **Redirect URL** (e.g. `https://kompetenzen.pages.dev/**`, `http://127.0.0.1:5500/**`, `http://localhost:5500/**`, and the company domain) |
| **Sign In / Providers → Email** | Enabled, **Confirm email** on |
| **Sign In / Providers → Phone** | Enabled, OTP length **6**, expiry **600** |
| **Sign In / Providers → Google** | Same Client ID and Client Secret. Then in **Google Cloud Console → Credentials → your OAuth client**, add the redirect URI `https://NEWREF.supabase.co/auth/v1/callback` |
| **Authentication → Emails → SMTP Settings** | Same SMTP host, port, username, app password and sender |
| **Authentication → Emails → Templates** | Copy any templates you customised (reset password, invite, confirm) |
| **Authentication → Rate Limits** | Same values (SMS per hour, emails per hour) |
| **Authentication → Hooks → Send SMS hook** | HTTPS, URL `https://NEWREF.supabase.co/functions/v1/send-sms-hook` → **Generate secret** → Create |

Store the new hook secret (single quotes keep the comma):

```powershell
npx supabase secrets set --project-ref NEWREF 'SEND_SMS_HOOK_SECRET=v1,whsec_PASTE_NEW_SECRET'
```

## Step 9: Turn on the notification scheduler

Creates a new worker secret in the new project's Vault and schedules the worker every minute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/enable-notification-scheduler.ps1 -projectRef NEWREF
```

## Step 10: Meta WhatsApp webhook

Meta app → **WhatsApp → Configuration → Webhook → Edit**:
- Callback URL: `https://NEWREF.supabase.co/functions/v1/notification-whatsapp-inbound`
- Verify token: the same `WHATSAPP_VERIFY_TOKEN`
- **Verify and save**, and keep the **messages** field subscribed.

## Step 11: Point the website at the new project

Replace the old URL and publishable key in:

| File | Change |
|---|---|
| `supabase-config.js` | `SUPABASE_URL` → `https://NEWREF.supabase.co`, `SUPABASE_ANON_KEY` → new publishable key |
| `Resume/frontend/supabase-config.js` | Same two values |
| `Resume/backend/.env` | `SUPABASE_URL` and the service role key (local development) |
| `scripts/supabase-admin.cjs`, `scripts/enable-notification-scheduler.ps1` | Default project ref / URL |
| `DEPLOY.md`, `NOTIFICATIONS_SETUP.md`, `PHONE_SIGNUP_SETUP.md` | Old ref in commands |

Cloud Run (once deployed): update `SUPABASE_URL` and the `supabase-service-role-key` secret (DEPLOY.md, step 1), then redeploy.

Then publish the website to Cloudflare Pages.

## Step 12: Test everything

- [ ] Homepage loads the showcase slides and reels
- [ ] Jobs and internships list
- [ ] Sign up with WhatsApp OTP (a code arrives on WhatsApp)
- [ ] Log in with WhatsApp number + OTP
- [ ] Staff login (email + password, and Google) on `admin.html` and `marketing.html`
- [ ] Forgot password email arrives
- [ ] Apply to a job with a resume; HR sees it and can open the resume
- [ ] Course enrollment and consultation booking forms save a row
- [ ] Marketing console: add a showcase slide and a reel
- [ ] WhatsApp notification arrives after an application status change (scheduler)
- [ ] Edge Function logs (dashboard → **Edge Functions → Logs**) show no errors

## Step 13: Clean up

1. Delete the backup: `Remove-Item -Recurse migration-backup`.
2. Leave the **old project paused** for a week (Settings → General → **Pause project**) in case something was missed.
3. Then delete the old project.
