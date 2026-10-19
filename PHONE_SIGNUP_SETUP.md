# Signup completed by mobile OTP

New applicants verify their phone with Firebase, then the `phone-signup` Edge Function verifies that signed Firebase token server-side (correct project, issuer, RS256 signature, phone provider and authentication within ten minutes). Only that verified number is saved as confirmed. The function creates the Supabase account and returns a genuine session; the browser persists it and continues to the original destination without a login form.

Deploy the frontend changes and the new function:

```powershell
npx supabase functions deploy phone-signup --project-ref xgnluardsgflfxttvgwc
```

In Supabase Authentication, the Phone provider must be enabled for phone/password sessions. Firebase still sends the OTP; this endpoint does not call Supabase SMS sending. Email confirmation must remain enabled. The endpoint checks the phone provider before creating any account and reports a setup error if disabled.

No new SQL migration or Firebase service-account secret is needed. Firebase public signing keys verify the ID token. Supabase supplies its service-role key to the function; this key is never sent to browsers. The JWT gateway is disabled only for this endpoint because applicants have a Firebase token, not yet a Supabase token. The function itself verifies Firebase proof before any account creation.

Phone verification does not verify email ownership. The email stays unconfirmed until separately verified. Users can later sign in with their verified phone and password; email login and email notifications requiring a verified address remain unavailable until email verification. Existing accounts from the old email-signup flow are not automatically linked or confirmed based on a newly supplied phone number. Those users must use the existing sign-in/recovery flow. No old account, password or role is overwritten.

The original signup password and Firebase token are used only for the HTTPS exchange, never logged. If a response is lost, retrying with the same verified phone, Firebase UID, email and correct password can recover the session without creating another account.

Allowed browser origins include `https://kompetenzen.pages.dev`, the company domain, localhost port 5500, and the configured `SITE_URL`. Real SMS still requires an authorized hosted Firebase domain. CORS does not substitute for token verification.

Tests: `node --test tests/phone-signup.test.cjs tests/admin-login.test.cjs tests/admin-workflows.test.cjs`
