# Application and job notifications

The code is implemented locally. It does not send messages until the migration, Edge Functions, provider credentials and scheduler are deployed. Existing users are opted out by default. This is separate from sign-in OTP delivery.

## 1. Supabase migration

Run `migrations/20261015_notifications.sql` in the Supabase SQL Editor **after** the existing application requirements, applicant matching and career matching migrations. It adds preferences, an outbox, application event triggers, HR status, and service-only queue functions. It does not send historical application receipts.

Application changes and outbox inserts commit together. The application request never calls an email or WhatsApp API. Sending failures cannot roll back a saved application. Candidates choose channel consent in the final profile step; changed choices save with the profile before application submission. Nothing is opted in by default. If settings cannot load, existing choices are preserved and profile saving remains available; a failed attempt to save changed consent asks for a retry. Email links to `create-profile.html#notification-preferences` open a focused preferences section with its own save button, allowing opt-out without profile validation. Email goes only to the authenticated account email, never an arbitrary profile email. Phone-verified applicants may receive brief application updates without email verification. These messages omit job titles, matching results and personal details. Job digests still require a verified email. Email ownership is never marked verified by phone OTP.

## 2. Providers and secrets

Email adapters: Gmail API (Google Workspace) and Resend. Gmail is selected automatically when `GMAIL_CLIENT_ID` is set. Set `EMAIL_PROVIDER=gmail` explicitly to pin it. Partial Gmail configuration does not fall back to Resend. For Resend, set `EMAIL_PROVIDER=resend` and verify the company sender domain.

### Google Workspace / Gmail

Set these Edge Function secrets (the sender must be the mailbox that authorized the refresh token):

| Secret | Value |
| --- | --- |
| `EMAIL_PROVIDER` | `gmail` (optional when `GMAIL_CLIENT_ID` exists) |
| `GMAIL_CLIENT_ID` | Company Google Cloud OAuth Client ID |
| `GMAIL_CLIENT_SECRET` | OAuth Client secret |
| `GMAIL_REFRESH_TOKEN` | Offline refresh token authorized for `gmail.send` |
| `GMAIL_SENDER_EMAIL` | Authorized company mailbox, without display name or brackets |

Keep `SITE_URL` and `NOTIFICATION_WORKER_SECRET` configured as below. Resend secrets are not required for Gmail. Enable Gmail API in Google Cloud and configure the internal company OAuth app. The function refreshes access tokens server-side and sends a private multipart HTML/plain-text email per recipient. It does not request inbox-reading permission. Applicants still need to opt into email. Application updates require a verified phone or email; job digests require a verified email.

Deploy the changed worker from the website directory:

```sh
npx supabase login
npx supabase functions deploy notification-worker --project-ref xgnluardsgflfxttvgwc
```

No additional SQL migration is required if the notification migration is already installed. Keep the existing one-minute cron job and worker-secret header. Do not deploy a second scheduler for Gmail.

Google mailbox quotas still apply, including normal messages sent by that mailbox. Explicit quota errors wait at least an hour (or Google's longer Retry-After) before retrying; repeated rejections stop after six attempts. An expired access token is refreshed on retry. Revoked/invalid refresh tokens fail with a sanitized authorization error and require the company mailbox to authorize again.

Gmail does not offer Resend-style send idempotency. Timeouts, send 5xx responses, or malformed success responses enter `review` instead of automatic resend. Check the company mailbox's Sent folder using `rfc822msgid:notification-QUEUE_UUID@SENDER_DOMAIN` before retrying. The Message-ID helps reconciliation; it is not a Gmail duplicate-prevention guarantee. Existing attempted Resend messages are also held for review on provider change; previously accepted messages are never replayed.

For a controlled delivery test, enable email for a test candidate, apply to a new test job, and invoke the worker once through the function test panel with the private `x-worker-secret` header and `{}` body. This processes eligible pending queue messages, not only the test candidate, so inspect the queue first. A successful `accepted` row stores Gmail's message ID; also check the recipient inbox. Local tests use mocked Google responses and do not send email.

References: [Gmail sending endpoint](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [OAuth refresh tokens](https://developers.google.com/identity/protocols/oauth2/web-server#offline).

WhatsApp adapter: Meta's WhatsApp Cloud API, used directly, with no Twilio or other provider in between. Setup steps are in **WhatsApp setup (Meta Cloud API)** below.

Set these secrets in **Supabase → Edge Functions → Secrets**, never in public JavaScript:

| Secret | Value |
| --- | --- |
| `SITE_URL` | Production HTTPS website origin |
| `NOTIFICATION_WORKER_SECRET` | A new, long random secret for the scheduler |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified company-domain sender |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from WhatsApp → API Setup (not the phone number itself) |
| `WHATSAPP_ACCESS_TOKEN` | Permanent System User access token with `whatsapp_business_messaging` permission |
| `WHATSAPP_APP_SECRET` | Meta app → App settings → Basic → App secret (verifies incoming webhooks) |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string; the same value is entered in the Meta webhook settings |
| `WHATSAPP_TEMPLATE_LANGUAGE` | Optional. Template language code, default `en` |
| `WHATSAPP_API_VERSION` | Optional. Graph API version, default `v23.0` |
| `WHATSAPP_TEMPLATE_RECEIVED` … `_DIGEST` | Optional. Only if your approved template names differ from the defaults below |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to its Edge Functions. Neither belongs in browser code.

Provider references: [Resend idempotency](https://resend.com/changelog/idempotency-keys), [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api), [message templates](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates), [pricing](https://developers.facebook.com/docs/whatsapp/pricing).

## WhatsApp setup (Meta Cloud API)

1. **Meta Business account.** At business.facebook.com, create or open the Kompetenzen business and complete **Business verification** (company documents). Unverified businesses are limited to test numbers.
2. **Meta app.** At developers.facebook.com → My Apps → Create app → type **Business** → add the **WhatsApp** product and link the business account.
3. **Phone number.** In WhatsApp → API Setup, add the production number (it must not be registered on the WhatsApp phone app or WhatsApp Business app; delete it there first). Verify it by SMS or call and set the display name **Kompetenzen** (Meta reviews it). Copy the **Phone number ID** into `WHATSAPP_PHONE_NUMBER_ID`.
4. **Payment method.** In WhatsApp Manager → Settings → Payment methods, add a card. Meta charges per delivered template message; there is no platform fee.
5. **Permanent token.** Business settings → Users → **System users** → Add (Admin) → Assign assets: the app (full control) and the WhatsApp account → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`, expiry **Never**. Store it as `WHATSAPP_ACCESS_TOKEN`. The 24-hour token on the API Setup page is only for testing.
6. **Templates.** In WhatsApp Manager → Message templates, create these, language **English** (`en`), with two body variables: `{{1}}` = role/title and `{{2}}` = update text. Submit each and wait for approval.

   | Template name | Category | Example body |
   | --- | --- | --- |
   | `application_received` | Utility | Your application for {{1}} has been received. {{2}} |
   | `application_matched` | Utility | Update on your application for {{1}}: {{2}} |
   | `application_not_matched` | Utility | Update on your application for {{1}}: {{2}} |
   | `application_status_update` | Utility | HR update on your application for {{1}}: {{2}} |
   | `job_digest` | **Marketing** | New openings matching your profile on {{1}}: {{2}} |

   End every body with a fixed footer such as `Reply STOP to stop WhatsApp notifications.` Meta may recategorise templates; job digests are marketing and cost more. Different names can be used if set in `WHATSAPP_TEMPLATE_<EVENT>`.

   Signup codes use a separate **Authentication** template, `verification_code`, with a Copy code button (override with `WHATSAPP_TEMPLATE_OTP`). See `PHONE_SIGNUP_SETUP.md`.
7. **Webhook.** In the Meta app → WhatsApp → Configuration → Webhook: Callback URL `https://PROJECT_REF.supabase.co/functions/v1/notification-whatsapp-inbound`, Verify token = `WHATSAPP_VERIFY_TOKEN`, then **Verify and save**. Subscribe to the **messages** field. Deploy the function and set its secrets first, or verification fails.
8. **Test.** Opt in on the profile page with your own number, apply to a job, and confirm the message arrives. Reply `STOP` and confirm WhatsApp is switched off in your notification preferences.

**Sending limits.** A new number can message about 250 unique people per 24 hours. Meta raises this automatically (1K → 10K → 100K → unlimited) while the number's quality rating stays high. Opt-in only, relevant messages keep the rating up; blocks and reports lower it. Check the rating in WhatsApp Manager → Phone numbers.

## 3. Deploy and schedule

The `scripts/enable-notification-scheduler.ps1` setup script enables `pg_cron` and `pg_net`, stores a fresh worker secret in Edge Function secrets and Vault, and schedules `kompetenzen-notification-worker` every minute. Run only when ready to send opted-in pending notifications. It rotates worker authentication, so any separately configured caller must be updated. It removes its temporary credential files after execution.

From the website folder, using the Supabase CLI linked to the correct project:

```sh
supabase functions deploy notification-worker
supabase functions deploy notification-whatsapp-inbound
```

These endpoints intentionally disable Supabase JWT verification: the worker requires its private `x-worker-secret`; the inbound function verifies Meta's `X-Hub-Signature-256` HMAC with the app secret. Never remove those checks.

Configure the Meta webhook as described in step 7 of **WhatsApp setup**. STOP, UNSUBSCRIBE, CANCEL, END, QUIT and STOP ALL replies disable WhatsApp for the sender's number. Re-enabling requires website consent; an incoming START does not silently opt users back in. Meta delivery-failure webhooks mark the matching `accepted` queue row as `failed`.

In Supabase Cron, schedule an HTTP POST **every minute** to `https://PROJECT_REF.supabase.co/functions/v1/notification-worker`, with header `x-worker-secret` set from a Vault secret and JSON body `{}`. Use the dashboard's Vault-backed HTTP job setup; do not paste the secret into a checked-in SQL file. The worker handles up to 20 messages per invocation. Digest collection handles up to 100 due subscribers per invocation. Enable/monitor cron after provider setup and a controlled test.

## 4. Behaviour and operations

- Receipts follow committed application inserts. Matched/not-matched messages follow changes to essential eligibility, once per application/result. Pending/missing-information results are not presented as rejections.
- HR changes the independent status in **View details → HR application status**. Saving an unchanged status sends nothing. Repeated intentional transitions are separate events.
- Digests default to off. Daily/weekly digests contain up to 10 new jobs passing the existing eligibility evaluator with a score of at least 70. Missing essential evidence excludes a recommendation. Already-applied jobs are excluded. This first version uses the database publication `created_at`; deleted jobs are absent and there is no separate closed-job field in the existing schema.
- Unmatched messages include failed requirements and up to three qualifying alternatives if any exist. Otherwise they link to other openings without claiming they match.
- Consent is checked again immediately before sending. A message already accepted by a provider cannot be recalled. Changing a recipient cancels pending retries addressed to the old recipient.
- `accepted` means the provider accepted the message, **not confirmed inbox delivery**. Monitor email bounces in Resend. WhatsApp delivery failures reported by Meta's webhook are recorded automatically as `failed`; other delivery issues are visible in WhatsApp Manager. Do not treat acceptance as delivery.
- Explicit transient errors retry with exponential backoff, up to six attempts. Resend retries reuse a stable payload and idempotency key and stop before its 24-hour deduplication window expires.
- WhatsApp timeouts/5xx and interrupted sends move to `review` because they may already have been sent. Only explicit WhatsApp rate-limit rejections retry automatically. Check provider logs before any manual retry. This avoids pretending exactly-once delivery is possible across two systems.
- Missing provider settings defer messages for one hour. No raw provider response, tokens, or recipient addresses are written to application logs.

Monitor queue counts in SQL Editor:

```sql
select state, channel, count(*), min(created_at) as oldest
from public.notification_queue group by state, channel;
select id, channel, state, attempts, last_error, provider_id
from public.notification_queue where state in ('failed','review') order by created_at;
```

The queue stores recipient details after dispatch starts. Restrict staff database access and set an operational retention period; after audit/reconciliation, remove old terminal rows according to your retention policy. Do not remove deduplication rows while replaying old application events.

## Verification

`node --test tests/gmail.test.cjs tests/notifications.test.cjs tests/admin-workflows.test.cjs`

Database tests use the same optional PGlite dependency as existing matching tests. Provider delivery must additionally be tested with configured test accounts; unit/database tests do not verify sender-domain DNS, approved templates, or inbox delivery.
