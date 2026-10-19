const test=require('node:test'),assert=require('node:assert/strict');
const claims={sub:'firebase-user',auth_time:Date.now()/1000,phone_number:'+919876543210',firebase:{sign_in_provider:'phone'}};
const body={name:'Applicant',email:'candidate@example.test',password:'test-password',firebaseToken:'signed-token'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
async function fixture(overrides={}){
  const {phoneSignupHandler}=await import('../supabase/functions/phone-signup/handler.mjs');const calls=[];
  const handler=phoneSignupHandler({env:k=>({SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'private-service-key'}[k]||''),verify:async()=>{if(overrides.invalid)throw Error();return {...claims,...overrides.claims};},fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.endsWith('/settings'))return response({external:{phone:overrides.disabled?false:true}});
    if(url.endsWith('/admin/users'))return response({},overrides.duplicate?422:200);
    return response({access_token:'session-token',refresh_token:'refresh-token',user:{email:body.email,app_metadata:{firebase_uid:overrides.other?'another-user':claims.sub}}});
  }});
  return {calls,run:()=>handler(new Request('https://fn.example.test',{method:'POST',headers:{origin:'https://kompetenzen.pages.dev'},body:JSON.stringify(body)}))};
}
test('verified phone signup returns session without marking email verified',async()=>{
  const t=await fixture();const r=await t.run();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  assert.equal((await r.json()).session.access_token,'session-token');
  const created=JSON.parse(t.calls[1].options.body);assert.equal(created.phone_confirm,true);assert.equal(created.email_confirm,false);assert.equal(created.phone,claims.phone_number);
  assert.deepEqual(JSON.parse(t.calls[2].options.body),{phone:claims.phone_number,password:body.password});
});
test('unverified, stale and non-phone identities cannot create accounts',async()=>{
  for(const overrides of [{invalid:true},{claims:{auth_time:0}},{claims:{firebase:{sign_in_provider:'password'}}},{claims:{phone_number:''}}]){
    const t=await fixture(overrides);assert.equal((await t.run()).status,401);assert.equal(t.calls.length,0);
  }
});
test('disabled phone provider fails before account creation',async()=>{
  const t=await fixture({disabled:true});assert.equal((await t.run()).status,503);assert.equal(t.calls.length,1);
});
test('retry can resume own account, never claim an existing email/phone identity',async()=>{
  assert.equal((await(await fixture({duplicate:true})).run()).status,200);
  assert.equal((await(await fixture({duplicate:true,other:true})).run()).status,409);
});
test('client persists the Supabase session and does not return successful OTP signup to login',()=>{
  const fs=require('fs');const source=fs.readFileSync('js/auth-modal.js','utf8');
  const otp=source.slice(source.indexOf('window.handleOtpSubmit'),source.indexOf('window.handleLoginSubmit'));
  assert.match(otp,/supabasePhoneSignUp/);assert.doesNotMatch(otp,/showEmailAuthStep\('login'\)|confirmation link/);
  const verify=fs.readFileSync('supabase/functions/phone-signup/index.ts','utf8');assert.match(verify,/jwtVerify/);assert.match(verify,/audience:project/);assert.match(verify,/issuer:/);assert.match(verify,/RS256/);
});
