const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const env=k=>({SUPABASE_URL:'https://db.example.test',SUPABASE_SERVICE_ROLE_KEY:'private-service-key',WHATSAPP_PHONE_NUMBER_ID:'123',WHATSAPP_ACCESS_TOKEN:'meta-token'}[k]||'');
const phone='+919876543210';
const body={name:'Applicant',email:'candidate@example.test',password:'test-password',phone,code:'123456'};
const response=(value,status=200)=>new Response(JSON.stringify(value),{status});
const post=value=>new Request('https://fn.example.test',{method:'POST',headers:{origin:'https://kompetenzen.pages.dev','x-forwarded-for':'203.0.113.9, 10.0.0.1'},body:JSON.stringify(value)});

async function sender(overrides={}){
  const {whatsappOtpHandler}=await import('../supabase/functions/whatsapp-otp/handler.mjs');const calls=[];
  const handler=whatsappOtpHandler({env,code:()=>'470183',fetcher:async(url,options)=>{
    calls.push({url,options:{...options,body:JSON.parse(options.body)}});
    if(url.includes('/rpc/issue_phone_otp'))return response(overrides.state||'ok');
    return response({},overrides.metaStatus||200);
  }});
  return {calls,run:(value={phone})=>handler(post(value))};
}
test('WhatsApp OTP is sent with the authentication template and only a keyed hash is stored',async()=>{
  const t=await sender();const r=await t.run();assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
  const {otpHash}=await import('../supabase/functions/_shared/otp.mjs');
  const issue=t.calls[0].options.body;
  assert.deepEqual(issue,{p_phone:phone,p_ip:'203.0.113.9',p_code_hash:await otpHash('private-service-key',phone,'470183')});
  assert.notEqual(issue.p_code_hash,'470183');
  const message=t.calls[1].options.body;assert.equal(message.to,'919876543210');assert.equal(message.template.name,'verification_code');
  assert.deepEqual(message.template.components.map(c=>c.parameters[0].text),['470183','470183']);
});
test('invalid numbers and rate limits never reach WhatsApp',async()=>{
  for(const value of [{phone:'+15551234567'},{phone:'9876543210'},{phone:'+915876543210'},{}]){const t=await sender();assert.equal((await t.run(value)).status,400);assert.equal(t.calls.length,0);}
  for(const state of ['cooldown','limited']){const t=await sender({state});assert.equal((await t.run()).status,429);assert.equal(t.calls.length,1);}
  const failed=await sender({metaStatus:400});assert.equal((await failed.run()).status,502);
});

async function signup(overrides={}){
  const {phoneSignupHandler}=await import('../supabase/functions/phone-signup/handler.mjs');const calls=[];
  const handler=phoneSignupHandler({env,fetcher:async(url,options)=>{
    calls.push({url,options});
    if(url.includes('/rpc/check_phone_otp'))return response(!overrides.wrongCode);
    if(url.includes('/rpc/consume_phone_otp'))return response(null,204);
    if(url.endsWith('/settings'))return response({external:{phone:overrides.disabled?false:true}});
    if(url.endsWith('/admin/users'))return response({},overrides.duplicate?422:200);
    return response({access_token:'session-token',refresh_token:'refresh-token',user:{email:overrides.otherEmail||body.email,phone:'919876543210'}});
  }});
  return {calls,paths:()=>calls.map(c=>new URL(c.url).pathname),run:(value=body)=>handler(post(value))};
}
test('correct WhatsApp code returns a session without marking email verified, then consumes the code',async()=>{
  const t=await signup();const r=await t.run();assert.equal(r.status,200);
  assert.equal((await r.json()).session.access_token,'session-token');
  const created=JSON.parse(t.calls[2].options.body);assert.equal(created.phone_confirm,true);assert.equal(created.email_confirm,false);assert.equal(created.phone,phone);
  assert.deepEqual(JSON.parse(t.calls[3].options.body),{phone,password:body.password});
  assert.equal(t.paths().at(-1),'/rest/v1/rpc/consume_phone_otp');
});
test('wrong, missing or malformed codes cannot create accounts',async()=>{
  const wrong=await signup({wrongCode:true});assert.equal((await wrong.run()).status,401);assert.deepEqual(wrong.paths(),['/rest/v1/rpc/check_phone_otp']);
  for(const value of [{...body,code:'12345'},{...body,code:undefined},{...body,phone:'9876543210'}]){const t=await signup();assert.equal((await t.run(value)).status,400);assert.equal(t.calls.length,0);}
});
test('disabled phone provider fails before account creation',async()=>{
  const t=await signup({disabled:true});assert.equal((await t.run()).status,503);assert.ok(!t.paths().includes('/auth/v1/admin/users'));
});
test('retry can resume own account, never claim an existing account with another email',async()=>{
  assert.equal((await(await signup({duplicate:true})).run()).status,200);
  const other=await signup({duplicate:true,otherEmail:'someone@example.test'});assert.equal((await other.run()).status,409);
  assert.ok(!other.paths().includes('/rest/v1/rpc/consume_phone_otp'));
});

test('database stores hashed codes with expiry, guess, cooldown and hourly limits for the service role only',async()=>{
  const {PGlite}=require(process.env.PGLITE_MODULE||'../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db=new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    const migration=fs.readFileSync('migrations/20261024_whatsapp_otp.sql','utf8');
    await db.exec(migration);await db.exec(migration);
    const one=async sql=>Object.values((await db.query(sql)).rows[0])[0];
    const issue=(p='+919876543210',ip='1.1.1.1',h='hash-a')=>one(`select issue_phone_otp('${p}','${ip}','${h}')`);
    const check=(h,p='+919876543210')=>one(`select check_phone_otp('${p}','${h}')`);
    const rewind=(p='+919876543210')=>db.exec(`update phone_otps set last_sent_at=now()-interval '31 seconds' where phone='${p}'`);
    assert.equal(await issue(),'ok');
    assert.equal(await issue(),'cooldown');
    assert.equal(await check('wrong'),false);
    assert.equal(await check('hash-a'),true,'correct code passes; retries share the guess budget');
    for(let i=0;i<3;i++)await check('wrong');
    assert.equal(await check('hash-a'),false,'locked after 5 guesses');
    await rewind();assert.equal(await issue(undefined,undefined,'hash-b'),'ok');
    assert.equal(await check('hash-a'),false,'old code replaced');assert.equal(await check('hash-b'),true,'new code resets guesses');
    await db.exec(`update phone_otps set expires_at=now()-interval '1 second'`);assert.equal(await check('hash-b'),false,'expired');
    for(let i=0;i<3;i++){await rewind();assert.equal(await issue(),'ok');}
    await rewind();assert.equal(await issue(),'limited','5 sends per number per hour');
    for(let i=1;i<=5;i++)assert.equal(await issue(`+91987654320${i}`,'1.1.1.1'),'ok');
    assert.equal(await issue('+919876543206','1.1.1.1'),'limited','10 sends per IP per hour');
    assert.equal(await issue('+919876543206','2.2.2.2'),'ok');
    await db.exec(`select consume_phone_otp('+919876543206')`);
    assert.equal(await one(`select count(*) from phone_otps where phone='+919876543206'`),0);
    assert.doesNotMatch(migration,/grant[^;]*to\s+(anon|authenticated)/i);
    await db.exec('set role anon');
    await assert.rejects(db.query(`select issue_phone_otp('+919876543210','x','y')`),/permission denied/);
    await assert.rejects(db.query('select * from phone_otps'),/permission denied/);
  } finally { await db.close(); }
});

test('browser signup uses WhatsApp OTP through Supabase and no longer loads Firebase',()=>{
  const source=fs.readFileSync('js/auth-modal.js','utf8');
  const otp=source.slice(source.indexOf('window.handleOtpSubmit'),source.indexOf('window.handleLoginSubmit'));
  assert.match(otp,/supabasePhoneSignUp\(pending\.name, pending\.email, pending\.password, pending\.formattedPhone, otpInput\)/);
  assert.doesNotMatch(otp,/showEmailAuthStep\('login'\)|confirmation link/);
  assert.match(source,/supabaseSendWhatsAppOtp/);
  assert.doesNotMatch(source,/firebase|recaptcha|gstatic/i);
  assert.ok(!fs.existsSync('firebase-config.js'));
  for(const page of fs.readdirSync('.').filter(f=>f.endsWith('.html')))assert.doesNotMatch(fs.readFileSync(page,'utf8'),/firebase-config\.js/,page);
  assert.match(fs.readFileSync('supabase/config.toml','utf8'),/\[functions\.whatsapp-otp\]\s*verify_jwt = false/);
});
