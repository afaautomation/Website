# Application and job notifications

The code is implemented locally. It does not send messages until the migration, Edge Functions, provider credentials and scheduler are deployed. Existing users are opted out by default. This is separate from sign-in OTP delivery.

## 1. Supabase migration

Run `migrations/20261015_notifications.sql` in the Supabase SQL Editor **after** the existing application requirements, applicant matching and career matching migrations. It adds preferences, an outbox, application event triggers, HR status, and service-only queue functions. It does not send historical application receipts.

Application changes and outbox inserts commit together. The application request never calls an email or WhatsApp API. Sending failures cannot roll back a saved application. Candidates save channel consent separately at `create-profile.html#notification-preferences`; profile saving does not depend on notification settings. Email goes only to the authenticated account's verified email, not an arbitrary profile email.

## 2. Providers and secrets

Email adapter: Resend. Verify a company domain and configure its DNS before using a sender such as `Kompetenzen <careers@YOUR_DOMAIN>`. This delivers to Gmail and other email providers; it is not a Gmail integration.

WhatsApp adapter: Twilio's WhatsApp Business API. Onboard the business sender and obtain approval for templates for each event. Use two variables: `{{1}}` for the role/title and `{{2}}` for the update. Each approved template must include suitable event-specific fixed text and a fixed opt-out instruction, for example `Reply STOP to stop WhatsApp notifications. Manage preferences at https://YOUR_DOMAIN/create-profile.html#notification-preferences`. Do not use a utility template for a job discovery/marketing digest. Test with provider test recipients before enabling production delivery.

Set these secrets in **Supabase → Edge Functions → Secrets**, never in public JavaScript:

| Secret | Value |
| --- | --- |
| `SITE_URL` | Production HTTPS website origin |
| `NOTIFICATION_WORKER_SECRET` | A new, long random secret for the scheduler |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified company-domain sender |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+COUNTRYCODE_NUMBER` |
| `TWILIO_CONTENT_RECEIVED` | Approved receipt template SID |
| `TWILIO_CONTENT_MATCHED` | Approved eligibility result template SID |
| `TWILIO_CONTENT_NOT_MATCHED` | Approved unmet requirements template SID |
| `TWILIO_CONTENT_HR_STATUS` | Approved HR update template SID |
| `TWILIO_CONTENT_DIGEST` | Approved job discovery template SID |
| `TWILIO_INBOUND_URL` | Exact public HTTPS URL of the inbound function, without query parameters |

Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to its Edge Functions. Neither belongs in browser code.

Provider references: [Resend idempotency](https://resend.com/changelog/idempotency-keys), [Twilio approved WhatsApp templates](https://www.twilio.com/docs/whatsapp/tutorial/send-whatsapp-notification-messages-templates).

## 3. Deploy and schedule

From the website folder, using the Supabase CLI linked to the correct project:

```sh
supabase functions deploy notification-worker
supabase functions deploy notification-whatsapp-inbound
```

These endpoints intentionally disable Supabase JWT verification: the worker requires its private `x-worker-secret`; the inbound function verifies Twilio's HMAC signature. Never remove those checks.

Configure the Twilio sender's incoming-message webhook as the exact `TWILIO_INBOUND_URL`, POST. STOP, UNSUBSCRIBE, CANCEL, END and QUIT disable WhatsApp for the sender's number. Re-enabling requires website consent; an incoming START does not silently opt users back in.

In Supabase Cron, schedule an HTTP POST **every minute** to `https://PROJECT_REF.supabase.co/functions/v1/notification-worker`, with header `x-worker-secret` set from a Vault secret and JSON body `{}`. Use the dashboard's Vault-backed HTTP job setup; do not paste the secret into a checked-in SQL file. The worker handles up to 20 messages per invocation. Digest collection handles up to 100 due subscribers per invocation. Enable/monitor cron after provider setup and a controlled test.

## 4. Behaviour and operations

- Receipts follow committed application inserts. Matched/not-matched messages follow changes to essential eligibility, once per application/result. Pending/missing-information results are not presented as rejections.
- HR changes the independent status in **View details → HR application status**. Saving an unchanged status sends nothing. Repeated intentional transitions are separate events.
- Digests default to off. Daily/weekly digests contain up to 10 new jobs passing the existing eligibility evaluator with a score of at least 70. Missing essential evidence excludes a recommendation. Already-applied jobs are excluded. This first version uses the database publication `created_at`; deleted jobs are absent and there is no separate closed-job field in the existing schema.
- Unmatched messages include failed requirements and up to three qualifying alternatives if any exist. Otherwise they link to other openings without claiming they match.
- Consent is checked again immediately before sending. A message already accepted by a provider cannot be recalled. Changing a recipient cancels pending retries addressed to the old recipient.
- `accepted` means the provider accepted the message, **not confirmed inbox delivery**. Monitor bounces/undelivered messages in Resend/Twilio. Delivery-receipt reconciliation is currently manual; do not treat acceptance as delivery.
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

`node --test tests/notifications.test.cjs tests/admin-workflows.test.cjs`

Database tests use the same optional PGlite dependency as existing matching tests. Provider delivery must additionally be tested with configured test accounts; unit/database tests do not verify sender-domain DNS, approved templates, or inbox delivery.
