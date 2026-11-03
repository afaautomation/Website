const PLATFORM = 'Kompetenzen';
export const STATUS_LABELS = {received:'Received',under_review:'Under Review',shortlisted:'Shortlisted',interview:'Interview',selected:'Selected',rejected:'Not Selected'};
export const STATUS_MESSAGES = {
  received:'Your application has been received and is waiting for review.',
  under_review:'The hiring company is currently reviewing your application.',
  shortlisted:'Congratulations! You have been shortlisted. The hiring team will contact you with the next steps.',
  interview:'Your application has moved to the interview stage. The hiring team will contact you with the interview details.',
  selected:'Congratulations! You have been selected for this position by the hiring company. Further details will be shared with you.',
  rejected:'The hiring company has decided not to move forward with your application this time. Keep exploring other openings on Kompetenzen.'
};

// Older queued rows may lack the name or company; fall back to wording that still reads well.
const nameOf = p => String(p.name || '').trim() || 'there';
const companyOf = p => String(p.company || '').trim();
const atCompany = p => companyOf(p) ? ` at ${companyOf(p)}` : '';
const jobLine = j => [j.title, j.company && `Company: ${j.company}`, j.location && `Location: ${j.location}`, j.experience && `Experience: ${j.experience}`].filter(Boolean);

export function messageFor(payload, site) {
  const url = payload.job_id ? `${site}/job-details.html?id=${encodeURIComponent(payload.job_id)}` : `${site}/jobs.html`;
  const jobUrl = id => `${site}/job-details.html?id=${encodeURIComponent(id)}`;
  const hi = `Hi ${nameOf(payload)},`;
  const keepInformed = 'We will keep you informed of any updates regarding your application through your registered contact details.';
  let subject, body, more = `View the opening: ${url}`;
  switch (payload.event) {
    case 'received':
      subject = `Application submitted: ${payload.title}`;
      body = `${hi}\n\nYour application for ${payload.title}${atCompany(payload)} has been successfully submitted through ${PLATFORM}.\n\nOur recruitment team will carefully review your profile and assess your qualifications against the requirements of the position.\n\nWe will keep you informed of any updates regarding your application and notify you of any further developments in the recruitment process.\n\nThank you for choosing ${PLATFORM} for your career opportunities!`;
      break;
    case 'matched':
      subject = `Eligibility check passed: ${payload.title}`;
      body = `${hi}\n\nGood news! 🎉\n\nYour application for ${payload.title}${atCompany(payload)} has successfully passed the initial eligibility assessment.\n\nFollowing a review of your profile, we are pleased to confirm that you meet the essential requirements specified for this opportunity.\n\nYour application will now proceed to the next stage of our evaluation process. Our team will review your profile further and coordinate the next steps accordingly.\n\n${keepInformed}\n\nThank you for choosing ${PLATFORM} for your career journey.`;
      break;
    case 'not_matched':
      subject = `Update on your application: ${payload.title}`;
      body = `${hi}\n\nThank you for applying for ${payload.title}${atCompany(payload)} through ${PLATFORM}.\n\nAfter carefully evaluating your application against the essential eligibility criteria for this position, we regret to inform you that your profile does not currently meet one or more of the specified requirements. Consequently, your application will not proceed further for this particular opportunity.\n\nLooking for the right career direction?\n\nWe encourage you to explore our Career Consultation service at ${PLATFORM}. Our career guidance services can help you understand your strengths, identify skill gaps, and discover career opportunities that align with your qualifications and aspirations.`;
      if (payload.alternatives?.length) body += '\n\nOpenings matching your profile:\n' + payload.alternatives.map(j => `${j.title}\n${jobUrl(j.id)}`).join('\n');
      body += `\n\nExplore other opportunities: ${site}/jobs.html\n\nExplore Career Consultation: ${site}/career-consultation\n\nWe believe every individual has the potential to find the right career path. Let us help you take the next step!`;
      more = '';
      break;
    case 'hr_status':
      subject = `Application update: ${payload.title}`;
      body = `${hi}\n\nThere is an update regarding your job application!\n\nJob Position: ${payload.title}\n${companyOf(payload) ? `Hiring Company: ${companyOf(payload)}\n` : ''}Application Status: ${STATUS_LABELS[payload.status] || 'Updated'}\n\n${STATUS_MESSAGES[payload.status] || 'Your application status has changed.'}\n\nOur team at ${PLATFORM} will keep you informed of any further updates or developments regarding your application through your registered contact details.\n\nThank you for choosing ${PLATFORM} to explore your career opportunities.`;
      break;
    case 'digest':
      subject = 'New opportunities matching your profile';
      body = `${hi.slice(0, -1)}! 👋\n\nWe have exciting career opportunities for you!\n\nNew job openings and internship opportunities are now available on ${PLATFORM}, selected to align with your profile, qualifications and career interests.\n\nExplore these opportunities:\n\n` +
        payload.jobs.map((j, i) => [`${i + 1}. ${jobLine(j)[0]}`, ...jobLine(j).slice(1), `Apply Here: ${jobUrl(j.id)}`].join('\n')).join('\n\n') +
        `\n\nTake the next step towards your career goals by exploring opportunities that match your skills and aspirations.\n\nDiscover more opportunities: ${site}/jobs.html\n\nStay connected with ${PLATFORM} for the latest career opportunities and updates.`;
      more = '';
      break;
    default: throw new Error('Unknown notification event');
  }
  return {subject, text:`${body}${more ? `\n\n${more}` : ''}\n\nBest regards,\n${PLATFORM} Technologies\n\nManage notifications or opt out: ${site}/create-profile.html#notification-preferences`};
}

// Body variables for the WhatsApp templates listed in NOTIFICATIONS_SETUP.md, in {{1}}, {{2}}… order.
export function whatsappParams(payload) {
  const company = companyOf(payload) || 'the hiring company';
  switch (payload.event) {
    case 'received': case 'matched': case 'not_matched': return [nameOf(payload), payload.title, company];
    case 'hr_status': return [nameOf(payload), payload.title, company, STATUS_LABELS[payload.status] || 'Updated', STATUS_MESSAGES[payload.status] || 'Your application status has changed.'];
    // A template variable holds at most 700 characters, so WhatsApp lists the top 5; the email lists all.
    case 'digest': return [nameOf(payload), payload.jobs.slice(0, 5).map((j, i) => `${i + 1}. ${jobLine(j).join(', ')}`).join(' | ')];
    default: throw new Error('Unknown notification event');
  }
}

export function failureState(channel, status, attempts, firstAttempt, now=Date.now()) {
  if (attempts>=6) return 'failed';
  // WhatsApp has no send idempotency guarantee. Only an explicit rate-limit rejection is safe to retry.
  if (channel==='whatsapp') return status===429 ? 'pending' : (!status || status>=500 ? 'review' : 'failed');
  // Resend idempotency keys expire after 24h; stop before that window closes.
  if (now-Date.parse(firstAttempt)>23*3600000) return 'review';
  return !status || status===429 || status>=500 ? 'pending' : 'failed';
}
