// Creates a Supabase account for a phone number proven by a recent WhatsApp OTP and returns a real session.
// Phone verification is never treated as proof of email ownership.
import { INDIAN_MOBILE, allowedOrigins, jsonEndpoint, otpHash, serviceHeaders } from '../_shared/otp.mjs';

const digits=value=>String(value||'').replace(/\D/g,'');

export function phoneSignupHandler({env,fetcher=fetch}) {
  const base=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY'), allowed=allowedOrigins(env);
  return async request=>{
    const {respond,early}=jsonEndpoint(request,allowed);
    if(early)return early;
    try {
      const text=await request.text();if(text.length>16000)return respond({error:'Request too large'},413);
      let data;try{data=JSON.parse(text);}catch{return respond({error:'Invalid signup request'},400);}
      const {name,email,password,phone,code}=data;
      if(typeof name!=='string'||!name.trim()||name.length>120||typeof email!=='string'||email.length>320||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string'||password.length<6||password.length>128)return respond({error:'Check your name, email and password'},400);
      if(typeof phone!=='string'||!INDIAN_MOBILE.test(phone)||typeof code!=='string'||!/^\d{6}$/.test(code))return respond({error:'Enter the 6-digit code sent to your WhatsApp.'},400);
      const authHeaders=serviceHeaders(key);
      const checked=await fetcher(base+'/rest/v1/rpc/check_phone_otp',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(10000),body:JSON.stringify({p_phone:phone,p_code_hash:await otpHash(key,phone,code)})});
      if(!checked.ok)return respond({error:'Signup could not finish. Please retry.'},503);
      if(await checked.json()!==true)return respond({error:'Incorrect or expired code. Check WhatsApp or request a new code.'},401);
      const normalizedEmail=email.trim().toLowerCase();
      // Fail before creating an account if phone-password sessions are disabled.
      const settings=await fetcher(base+'/auth/v1/settings',{headers:authHeaders,signal:AbortSignal.timeout(10000)});
      if(!settings.ok || !(await settings.json()).external?.phone)return respond({error:'Phone signup needs the Supabase Phone provider enabled. Please contact support.'},503);
      const created=await fetcher(base+'/auth/v1/admin/users',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(15000),body:JSON.stringify({email:normalizedEmail,password,phone,phone_confirm:true,email_confirm:false,user_metadata:{name:name.trim(),phone},app_metadata:{phone_verification:'whatsapp'}})});
      if(!created.ok && ![400,422].includes(created.status))return respond({error:'Could not create your account. Please retry.'},503);
      // Safe retry after a lost response: only the owner of this verified phone, email and password gets a session.
      const signed=await fetcher(base+'/auth/v1/token?grant_type=password',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(15000),body:JSON.stringify({phone,password})});
      const session=await signed.json().catch(()=>null);
      if(!signed.ok||!session?.access_token||digits(session.user?.phone)!==digits(phone)||session.user?.email?.toLowerCase()!==normalizedEmail)return respond({error:'Could not finish signup. If you already have an account, use its sign-in or recovery option.'},409);
      await fetcher(base+'/rest/v1/rpc/consume_phone_otp',{method:'POST',headers:authHeaders,signal:AbortSignal.timeout(10000),body:JSON.stringify({p_phone:phone})}).catch(()=>{});
      return respond({session:{access_token:session.access_token,refresh_token:session.refresh_token}});
    }catch{return respond({error:'Signup could not finish. Please retry with the same code.'},503);}
  };
}
