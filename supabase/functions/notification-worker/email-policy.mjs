const applicationEvents = new Set(['received', 'matched', 'not_matched', 'hr_status']);

export function emailDestination(user, event) {
  // OTP proves phone ownership, not email ownership. Only transactional updates
  // may use an unverified account email; digests still need a verified email.
  return user.email && (user.email_confirmed_at || (user.phone_confirmed_at && applicationEvents.has(event)))
    ? user.email : '';
}

export function applicationEmail(event, site) {
  if (!applicationEvents.has(event)) return null;
  const received = event === 'received';
  return {
    subject: received ? 'Application received — Kompetenzen' : 'Application update — Kompetenzen',
    text: `${received ? 'Your application has been received.' : 'There is an update to your application.'}\n\nSign in to your account to continue: ${site}/create-profile.html\n\nManage notifications or opt out: ${site}/create-profile.html#notification-preferences\n\nIf you did not apply through Kompetenzen, you can ignore this email.`
  };
}
