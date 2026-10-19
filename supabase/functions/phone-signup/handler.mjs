// Exchanges a recently verified Firebase phone identity for a real Supabase session.
// Phone verification is never treated as proof of email ownership.
export function phoneSignupHandler({env,verify,fetcher=fetch,now=()=>Date.now()}) {
  const base=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY');
  const allowed=new Set(['https://kompetenzen.pages.dev','https://kompetenzen.in','https://www.kompetenzen.in','http://localhost:5500','http://127.0.0.1:5500',env('SITE_URL')]);
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',...(allowed.has(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'}:{})};
    const respond=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if(origin&&!allowed.has(origin)) return respond({error:'Website not authorised'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method!=='POST')return respond({error:'Method not allowed'},405);
    try {
      const text=await request.text();if(text.length>16000)return respond({error:'Request too large'},413);
      let data;try{data=JSON.parse(text);}catch{return respond({error:'Invalid signup request'},400);}
      const {name,email,password,firebaseToken}=data;
      if(typeof name!=='string'||!name.trim()||name.length>120||typeof email!=='string'||email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<6||password.length>128||typeof firebaseToken!=='string')return respond({error:'Check your name, email and password'},400);
      let claims;try{claims=await verify(firebaseToken);}catch{return respond({error:'Phone verification expired. Request a new OTP.'},401);}
      const age=now()/1000-claims.auth_time;
      if(!claims.sub || claims.firebase?.sign_in_provider!=='phone'||!/^\+[1-9]\d{7,14}$/.test(claims.phone_number||'')||!Number.isFinite(age)||age< -30||age>600)return respond({error:'A recent mobile OTP verification is required'},401);
      const phone=claims.phone_number, normalizedEmail=email.trim().toLowerCase();
      const authHeaders={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
      // Fail before creating an account if phone-password sessions are disabled.
      const settings=await fetcher(base+'/auth/v1/settings',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
      if(!settings.ok || !(await settings.json()).external?.phone)return respond({error:'Phone signup needs the Supabase Phone provider enabled. Please contact support.'},503);
      const created=await fetcher(base+'/auth/v1/admin/users',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(15000),body:JSON.stringify({email:normalizedEmail,password,phone,phone_confirm:true,email_confirm:false,user_metadata:{name:name.trim(),phone},app_metadata:{firebase_uid:claims.sub}})});
      if(!created.ok && ![400,422].includes(created.status))return respond({error:'Could not create your account. Please retry.'},503);
      // Safe retry after a lost response: never modify or confirm an existing email account.
      const signed=await fetcher(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(15000),body:JSON.stringify({phone,password})});
      const session=await signed.json().catch(()=>null);
      if(!signed.ok||!session?.access_token||session.user?.app_metadata?.firebase_uid!==claims.sub||session.user?.email?.toLowerCase()!==normalizedEmail)return respond({error:'Could not finish signup. If you already have an account, use its sign-in or recovery option.'},409);
      return respond({session:{access_token:session.access_token,refresh_token:session.refresh_token}});
    }catch{return respond({error:'Signup could not finish. Please retry; your verified phone session may still be valid.'},503);}
  };
}
