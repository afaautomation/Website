export function messageFor(payload, site) {
  const url = payload.job_id ? `${site}/job-details.html?id=${encodeURIComponent(payload.job_id)}` : `${site}/jobs.html`;
  const statuses = {received:'Application received',under_review:'Your application is under HR review',shortlisted:'HR has shortlisted your application',interview:'HR has moved your application to the interview stage',selected:'HR has marked your application as selected',rejected:'HR has marked your application as rejected'};
  let subject, body;
  switch (payload.event) {
    case 'received': subject='Application received'; body=`We have saved your application for ${payload.title}.`; break;
    case 'matched': subject='Your application meets the listed requirements'; body=`Your application for ${payload.title} meets the configured essential requirements and is awaiting HR review. This does not mean you have been shortlisted or selected.`; break;
    case 'not_matched': {
      subject='Your application matching results';
      const reasons=(payload.reasons || []).filter(r=>/does not|not met|below|fails|missing required|explicitly not selected/i.test(r));
      body=`Your application for ${payload.title} does not meet all configured essential requirements.\n${reasons.join('\n') || 'Please review the essential requirements on the job page.'}\nYou can update your profile or explore other openings. This is an automated requirements check, not an HR decision.`;
      if(payload.alternatives?.length) body+='\n\nOther openings matching your profile:\n'+payload.alternatives.map(j=>`${j.title}\n${site}/job-details.html?id=${encodeURIComponent(j.id)}`).join('\n');
      break;
    }
    case 'hr_status': subject='An update from HR'; body=`${payload.title}: ${statuses[payload.status] || 'Your application status has changed'}. For interview arrangements or further instructions, please contact the hiring team.`; break;
    case 'digest': subject='New opportunities matching your profile'; body='These openings meet your profile’s demonstrated requirements (not a guarantee of shortlisting):\n'+payload.jobs.map(j=>`${j.title}\n${site}/job-details.html?id=${encodeURIComponent(j.id)}`).join('\n\n'); break;
    default: throw new Error('Unknown notification event');
  }
  return {subject, text:`${body}\n\nView opportunities: ${url}\n\nManage notifications or opt out: ${site}/create-profile.html#notification-preferences`};
}

export function failureState(channel, status, attempts, firstAttempt, now=Date.now()) {
  if (attempts>=6) return 'failed';
  // WhatsApp has no send idempotency guarantee. Only an explicit rate-limit rejection is safe to retry.
  if (channel==='whatsapp') return status===429 ? 'pending' : (!status || status>=500 ? 'review' : 'failed');
  // Resend idempotency keys expire after 24h; stop before that window closes.
  if (now-Date.parse(firstAttempt)>23*3600000) return 'review';
  return !status || status===429 || status>=500 ? 'pending' : 'failed';
}
