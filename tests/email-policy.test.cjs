const test=require('node:test');
const assert=require('node:assert/strict');
test('phone-verified applicants receive transactional updates without confirming email',async()=>{
  const {emailDestination,applicationEmail}=await import('../supabase/functions/notification-worker/email-policy.mjs');
  const user={email:'applicant@example.test',phone_confirmed_at:'2026-10-20'};
  for(const event of ['received','matched','not_matched','hr_status']){
    assert.equal(emailDestination(user,event),user.email);
    const message=applicationEmail(event,'https://example.test');
    assert.match(message.text,/Sign in/);
    assert.doesNotMatch(message.text,/shortlisted|selected|rejected|Python|resume|salary/i);
  }
  assert.equal(emailDestination(user,'digest'),'');
  assert.equal(emailDestination({email:user.email},'received'),'');
  assert.equal(emailDestination({...user,email_confirmed_at:'2026-10-20'},'digest'),user.email);
  assert.equal(applicationEmail('digest','https://example.test'),null);
});
