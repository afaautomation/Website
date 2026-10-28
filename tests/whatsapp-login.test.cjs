const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const env=k=>({WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_ACCESS_TOKEN:'meta-token'}[k]||'');
const hookBody={user:{phone:'919876543210'},sms:{otp:'482913'}};

async function hook(overrides={}){
  const {sendSmsHookHandler}=await import('../supabase/functions/send-sms-hook/handler.mjs');const calls=[];
  const handler=sendSmsHookHandler({env:overrides.env||env,
    verify:async body=>{if(overrides.badSignature)throw Error('bad');return JSON.parse(body);},
    fetcher:async(url,options)=>{calls.push({url,body:JSON.parse(options.body)});return new Response(JSON.stringify(overrides.metaError||{}),{status:overrides.metaStatus||200});}});
  return {calls,run:(body=hookBody)=>handler(new Request('https://fn.example.test',{method:'POST',body:JSON.stringify(body)}))};
}

test('login OTP from Supabase is delivered with the WhatsApp authentication template',async()=>{
  const t=await hook();const r=await t.run();assert.equal(r.status,200);
  assert.equal(t.calls[0].body.to,'919876543210');assert.equal(t.calls[0].body.template.name,'verification_code');
  assert.deepEqual(t.calls[0].body.template.components.map(c=>c.parameters[0].text),['482913','482913']);
});

test('unsigned, non-Indian or unconfigured hook calls never reach WhatsApp',async()=>{
  const unsigned=await hook({badSignature:true});assert.equal((await unsigned.run()).status,401);assert.equal(unsigned.calls.length,0);
  const foreign=await hook();assert.equal((await foreign.run({user:{phone:'15551234567'},sms:{otp:'482913'}})).status,400);assert.equal(foreign.calls.length,0);
  const missing=await hook({env:()=>''});assert.equal((await missing.run()).status,503);assert.equal(missing.calls.length,0);
});

test('Meta rejection returns a Supabase hook error with a numeric reference only',async()=>{
  const t=await hook({metaStatus:401,metaError:{error:{code:190,message:'token for +919876543210 expired'}}});
  const r=await t.run();assert.equal(r.status,502);
  const body=await r.json();assert.equal(body.error.http_code,502);assert.match(body.error.message,/Meta 190/);
  assert.doesNotMatch(body.error.message,/9876543210|expired/);
});

test('login form asks only for the WhatsApp number and uses Supabase phone OTP without creating accounts',()=>{
  const source=fs.readFileSync('js/auth-modal.js','utf8');
  const form=source.slice(source.indexOf('<form id="login-form"'),source.indexOf('</form>',source.indexOf('<form id="login-form"')));
  assert.match(form,/id="login-phone"/);
  assert.doesNotMatch(form,/type="password"|login-email|Forgot password/);
  const config=fs.readFileSync('supabase-config.js','utf8');
  assert.match(config,/signInWithOtp\(\{ phone, options: \{ shouldCreateUser: false \} \}\)/);
  assert.match(config,/verifyOtp\(\{ phone, token: code, type: 'sms' \}\)/);
  assert.doesNotMatch(config,/signInWithPassword/);
  assert.match(fs.readFileSync('supabase/config.toml','utf8'),/\[functions\.send-sms-hook\]\s*verify_jwt = false/);
});
