const applicationEvents = new Set(['received', 'matched', 'not_matched', 'hr_status']);

// Application updates (received, eligibility, HR status) go to the account email with the full
// WhatsApp-style content, confirmed or not: sign-up proves the phone by WhatsApp code and never
// confirms the email. Job digests are marketing, so they still need a confirmed email to protect
// the sender's reputation.
export function emailDestination(user, event) {
  return user.email && (user.email_confirmed_at || (user.phone_confirmed_at && applicationEvents.has(event)))
    ? user.email : '';
}
