const test=require('node:test');
const assert=require('node:assert/strict');
const config={GMAIL_CLIENT_ID:'test-client',GMAIL_CLIENT_SECRET:'test-secret',GMAIL_REFRESH_TOKEN:'test-refresh',GMAIL_SENDER_EMAIL:'careers@example.test'};
const env=k=>config[k]||'';
const delivery={sender:config.GMAIL_SENDER_EMAIL,destination:'applicant@example.test',subject:'Application received — മലയാളം',text:'Hello Anjali,\nYour application is saved. <script>bad()</script>'};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers});
const token=()=>json({access_token:'private-access',expires_in:3600});
test('Gmail permission diagnostics expose only known categories',async()=>{
  const {createGmailSender}=await import('../supabase/functions/notification-worker/gmail.mjs');
  for(const [reason,expected] of [['SERVICE_DISABLED',/API is disabled/],['ACCESS_TOKEN_SCOPE_INSUFFICIENT',/lacks gmail.send/]]){
    const send=createGmailSender(env,async url=>url.includes('oauth2')?token():json({error:{message:'private-account-data',details:[{reason}]}},403));
    const result=await send(delivery,'queue-test',new Date().toISOString(),1);
    assert.equal(result.state,'failed');
    assert.match(result.last_error,expected);
    assert.doesNotMatch(result.last_error,/private-account-data/);
  }
});
test('Gmail MIME supports Unicode, escapes HTML, and rejects injected addresses',async()=>{
  const {gmailRaw,emailProvider,gmailConfigured}=await import('../supabase/functions/notification-worker/gmail.mjs');
  const raw=gmailRaw(delivery,'queue-123','2026-10-17T00:00:00Z');
  const mime=Buffer.from(raw,'base64url').toString('utf8');
  assert.match(mime,/To: applicant@example.test\r\n/);
  assert.match(mime,/Message-ID: <notification-queue-123@example.test>/);
  const parts=mime.split('Content-Transfer-Encoding: base64\r\n\r\n').slice(1).map(p=>Buffer.from(p.split('\r\n--')[0],'base64').toString('utf8'));
  assert.equal(parts[0],delivery.text);
  assert.match(parts[1],/&lt;script&gt;/);
  assert.doesNotMatch(parts[1],/<script>/);
  const subject=mime.split('Subject: ')[1].split('\r\nDate:')[0].replace(/=\?UTF-8\?B\?([^?]+)\?=/g,(_,b)=>Buffer.from(b,'base64').toString('utf8')).replace(/\r\n /g,'');
  assert.equal(subject,delivery.subject);
  assert.throws(()=>gmailRaw({...delivery,destination:'a@example.test\r\nBcc: victim@example.test'},'123',new Date()),/Invalid/);
  assert.equal(emailProvider(env),'gmail'); assert.equal(gmailConfigured(env),true);
});
test('Gmail refreshes OAuth token, caches it and targets the configured mailbox',async()=>{
  const {createGmailSender}=await import('../supabase/functions/notification-worker/gmail.mjs');
  let calls=[],time=1000;
  const send=createGmailSender(env,async(url,init)=>{calls.push({url,init});return url.includes('oauth2')?token():json({id:'gmail-id'});},()=>time);
  assert.equal((await send(delivery,'queue-1',new Date(),1)).state,'accepted');
  await send(delivery,'queue-2',new Date(),1);
  assert.equal(calls.length,3);
  assert.equal(calls[0].init.body.get('grant_type'),'refresh_token');
  assert.match(calls[1].url,/users\/careers%40example.test\/messages\/send$/);
  assert.equal(calls[1].init.headers.Authorization,'Bearer private-access');
  time+=3600000; await send(delivery,'queue-3',new Date(),1);
  assert.equal(calls.length,5);
});
test('OAuth failure never dispatches an email or exposes credentials',async()=>{
  const {createGmailSender}=await import('../supabase/functions/notification-worker/gmail.mjs');
  let calls=0;
  const send=createGmailSender(env,async()=>{calls++;return json({error:'invalid_grant',error_description:'private-refresh-token'},400);});
  const result=await send(delivery,'queue-1',new Date(),1);
  assert.equal(result.state,'failed'); assert.equal(calls,1);
  assert.doesNotMatch(JSON.stringify(result),/private-refresh-token/);
  const offline=createGmailSender(env,async()=>{throw new Error('network');});
  assert.equal((await offline(delivery,'queue-1',new Date(),1)).state,'pending');
});
test('ambiguous Gmail sends are held; explicit quotas retry and permission failures stop',async()=>{
  const {createGmailSender}=await import('../supabase/functions/notification-worker/gmail.mjs');
  for(const [response,state] of [[null,'review'],[json({},503),'review'],[json({},200),'review'],[json({},429,{'retry-after':'7200'}),'pending'],[json({error:{errors:[{reason:'userRateLimitExceeded'}]}},403),'pending'],[json({error:{errors:[{reason:'insufficientPermissions'}]}},403),'failed']]) {
    const send=createGmailSender(env,async url=>{if(url.includes('oauth2'))return token();if(!response)throw new Error('timeout');return response;});
    const result=await send(delivery,'queue-1',new Date(),1);
    assert.equal(result.state,state);
    if(response?.status===429)assert.equal(result.retrySeconds,7200);
  }
});
test('expired access token causes refresh on the next retry',async()=>{
  const {createGmailSender}=await import('../supabase/functions/notification-worker/gmail.mjs');
  let tokens=0,sends=0;
  const send=createGmailSender(env,async url=>url.includes('oauth2')?(tokens++,token()):(++sends===1?json({},401):json({id:'sent'})));
  assert.equal((await send(delivery,'queue-1',new Date(),1)).state,'pending');
  assert.equal((await send(delivery,'queue-1',new Date(),2)).state,'accepted');
  assert.equal(tokens,2);
});

test('worker routes email to Gmail, records acceptance, and protects old-provider retries',async()=>{
  const fs=require('node:fs'),vm=require('node:vm');
  const {stripTypeScriptTypes}=require('node:module');
  const gmail=await import('../supabase/functions/notification-worker/gmail.mjs');
  const messages=await import('../supabase/functions/notification-worker/messages.mjs');
  const policy=await import('../supabase/functions/notification-worker/email-policy.mjs');
  const source=stripTypeScriptTypes(fs.readFileSync('supabase/functions/notification-worker/index.ts','utf8').replace(/^import .*;\r?\n/gm,''));
  for(const scenario of ['normal','phone-only','unverified','optout','previous-provider']) {
    const queue={id:'queue-1',user_id:'user-1',channel:'email',created_at:new Date().toISOString(),first_attempt_at:new Date().toISOString(),attempts:1,payload:{event:'received',title:'Engineer'}};
    if(scenario==='previous-provider') queue.delivery={destination:delivery.destination,subject:'Old',text:'Old'};
    let handler,claimed=false,googleCalls=0; const updates=[];
    const fakeFetch=async(url,init={})=>{
      if(url.includes('/rpc/queue_job_digests'))return json(null);
      if(url.includes('/rpc/claim_notification')) {if(claimed)return json([]);claimed=true;return json([queue]);}
      if(url.includes('/notification_preferences')) return json([{email_enabled:scenario!=='optout'}]);
      if(url.includes('/auth/v1/admin/users'))return json({email:delivery.destination,email_confirmed_at:['phone-only','unverified'].includes(scenario)?null:new Date().toISOString(),phone_confirmed_at:scenario==='phone-only'?new Date().toISOString():null});
      if(url.includes('/notification_queue?')) {updates.push(JSON.parse(init.body));return json([]);}
      if(url.includes('oauth2.googleapis.com')) {googleCalls++;return token();}
      if(url.includes('gmail.googleapis.com')) {googleCalls++;return json({id:'gmail-message-id'});}
      throw new Error('Unexpected request');
    };
    const settings={...config,SUPABASE_URL:'https://database.example.test',SUPABASE_SERVICE_ROLE_KEY:'service-test',SITE_URL:'https://example.test',NOTIFICATION_WORKER_SECRET:'worker-test'};
    vm.runInNewContext(source,{...messages,...gmail,...policy,createGmailSender:e=>gmail.createGmailSender(e,fakeFetch),DEFAULT_TEMPLATES:{},Deno:{env:{get:k=>settings[k]},serve:fn=>handler=fn},fetch:fakeFetch,Response,AbortSignal,URLSearchParams,console});
    assert.equal((await handler(new Request('https://worker.example.test',{method:'POST'}))).status,401);
    const response=await handler(new Request('https://worker.example.test',{method:'POST',headers:{'x-worker-secret':'worker-test'},body:'{}'}));
    assert.equal(response.status,200);
    const sends=['normal','phone-only'].includes(scenario);
    assert.equal(updates.at(-1).state,sends?'accepted':['optout','unverified'].includes(scenario)?'cancelled':'review');
    assert.equal(googleCalls,sends?2:0);
    if(sends) {assert.equal(updates[0].delivery.provider,'gmail');assert.equal(updates.at(-1).provider_id,'gmail-message-id');assert.doesNotMatch(updates[0].delivery.text,/Engineer/);}
  }
});
