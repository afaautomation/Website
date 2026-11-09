const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
test('phone-verified applicants receive full application updates without confirming email',async()=>{
  const {emailDestination}=await import('../supabase/functions/notification-worker/email-policy.mjs');
  const {messageFor}=await import('../supabase/functions/notification-worker/messages.mjs');
  const user={email:'applicant@example.test',phone_confirmed_at:'2026-10-20'};
  for(const event of ['received','matched','not_matched','hr_status'])
    assert.equal(emailDestination(user,event),user.email);
  // Job digests are marketing: only a confirmed email
  assert.equal(emailDestination(user,'digest'),'');
  assert.equal(emailDestination({email:user.email},'received'),'');
  assert.equal(emailDestination({...user,email_confirmed_at:'2026-10-20'},'digest'),user.email);
  // The email carries the same details as the WhatsApp template: name, job and company
  const email=messageFor({event:'received',name:'Kevin',title:'Marketing head',company:'Kompetenzen technologies',job_id:'j1'},'https://example.test');
  assert.match(email.text,/^Hi Kevin,\n\nYour application for Marketing head at Kompetenzen technologies has been successfully submitted through Kompetenzen\./);
  // The worker no longer swaps in a generic, detail-free email for unconfirmed addresses
  const worker=fs.readFileSync('supabase/functions/notification-worker/index.ts','utf8');
  assert.doesNotMatch(worker,/applicationEmail|emailConfirmed/);
  assert.match(worker,/\.\.\.messageFor\(q\.payload,site\)/);
});
