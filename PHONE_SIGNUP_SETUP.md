# Signup completed by WhatsApp OTP

New applicants enter name, email, mobile and password. The `whatsapp-otp` Edge Function sends a 6-digit code through the company's WhatsApp Cloud API number (Meta authentication template). The `phone-signup` Edge Function checks the code, creates the Supabase account with that phone marked confirmed, and returns a genuine session; the browser persists it and continues to the original destination without a login form. Firebase and SMS are no longer used.

## Deploy

1. Run `migrations/20261024_whatsapp_otp.sql` in the Supabase SQL Editor (after `20261015_notifications.sql`).
2. In WhatsApp Manager → Message templates, create an **Authentication** template named `verification_code`, language English (`en`), with a **Copy code** button. Meta supplies the body text ("{{1}} is your verification code."); add the optional security disclaimer and a 10-minute expiry. Use another name only if you set `WHATSAPP_TEMPLATE_OTP`.
3. Deploy both functions. They use the WhatsApp secrets already set for notifications (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, optional `WHATSAPP_TEMPLATE_LANGUAGE` / `WHATSAPP_API_VERSION`; see `NOTIFICATIONS_SETUP.md`):

```powershell
npx supabase functions deploy whatsapp-otp --project-ref xgnluardsgflfxttvgwc
npx supabase functions deploy phone-signup --project-ref xgnluardsgflfxttvgwc
```

4. Publish the website (the Firebase script and `firebase-config.js` are removed). The Firebase project can then be deleted or its Phone provider disabled.

In Supabase Authentication, the Phone provider must stay enabled so users can sign in with phone and password; Supabase never sends SMS for this flow. Email confirmation must remain enabled. `phone-signup` checks the provider before creating any account.

## Login with WhatsApp number + OTP

Login asks only for the WhatsApp number. Supabase's own phone OTP generates, expires and verifies the code (`signInWithOtp` with `shouldCreateUser: false`, then `verifyOtp` type `sms`); the `send-sms-hook` Edge Function delivers it with the same `verification_code` WhatsApp template. Login never creates accounts, and it never marks an email as verified.

1. Deploy: `npx supabase functions deploy send-sms-hook --project-ref xgnluardsgflfxttvgwc`
2. Supabase → Authentication → Hooks → **Send SMS hook** → type **HTTPS** → URL `https://xgnluardsgflfxttvgwc.supabase.co/functions/v1/send-sms-hook` → **Generate secret** → copy it → Create.
3. `npx supabase secrets set --project-ref xgnluardsgflfxttvgwc SEND_SMS_HOOK_SECRET="v1,whsec_..."`
4. Authentication → Sign In / Providers → **Phone**: enabled, OTP length **6**, SMS OTP expiry **600** seconds. The hook replaces the SMS provider.
5. Authentication → Rate Limits: raise **SMS messages sent per hour** (default 30) to suit traffic. Supabase also allows one code per number every 60 seconds.

Only accounts with a phone number can log in this way (everyone who signed up with WhatsApp OTP). Older email/Google accounts without a phone cannot.

## Security

- Codes are generated server-side, stored only as an HMAC (keyed with the service-role key), expire after 10 minutes and allow 5 guesses. A new code replaces the old one.
- Limits: one send per number per 30 seconds, 5 per number per hour, 10 per client IP per hour. Only Indian mobile numbers (`+91` 6–9…) are accepted. Browsers cannot read the OTP tables or call the database functions; only the Edge Functions (service role) can.
- Both endpoints run without the Supabase JWT gateway because applicants have no account yet; the OTP check is the proof.
- WhatsApp verification does not verify email ownership. The email stays unconfirmed until separately verified; application updates may use the confirmed phone (see `NOTIFICATIONS_SETUP.md`).
- Existing accounts are never linked, confirmed or overwritten. If a response is lost, retrying with the same code, email and password returns the session while the code is still valid; after success the code is deleted.
- Passwords and codes are used only for the HTTPS exchange and never logged.

Allowed browser origins: `https://kompetenzen.pages.dev`, the company domain, localhost port 5500, and the configured `SITE_URL`.

## Cost and limits

Each code is one Meta authentication message (about ₹0.115 in India for an Indian business account; check Meta's current rate card). Resends cost the same. New numbers can message a limited number of unique people per 24 hours until Meta raises the tier, and OTPs count toward it; keep the number's quality rating high.

Tests: `node --test tests/phone-signup.test.cjs`
