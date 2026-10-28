// Sends a signup verification code through the WhatsApp Cloud API authentication template.
// Only a keyed hash is stored; send limits are enforced atomically by issue_phone_otp.
import { INDIAN_MOBILE, allowedOrigins, jsonEndpoint, newCode, otpHash, serviceHeaders } from '../_shared/otp.mjs';
import { otpMessage } from '../_shared/whatsapp.mjs';

export function whatsappOtpHandler({env,fetcher=fetch,code=newCode}) {
  const base=env('SUPABASE_URL'), key=env('SUPABASE_SERVICE_ROLE_KEY'), allowed=allowedOrigins(env);
  return async request=>{
    const {respond,early}=jsonEndpoint(request,allowed);
    if(early)return early;
    try {
      const text=await request.text();if(text.length>2000)return respond({error:'Request too large'},413);
      let data;try{data=JSON.parse(text);}catch{return respond({error:'Invalid request'},400);}
      const phone=typeof data?.phone==='string'?data.phone.replace(/[\s()-]/g,''):'';
      if(!INDIAN_MOBILE.test(phone))return respond({error:'Please enter a valid 10-digit Indian mobile number.'},400);
      if(!env('WHATSAPP_PHONE_NUMBER_ID')||!env('WHATSAPP_ACCESS_TOKEN'))return respond({error:'WhatsApp verification is not set up yet. Please contact support.'},503);
      const otp=code();
      const ip=(request.headers.get('x-forwarded-for')||'').split(',')[0].trim();
      const issued=await fetcher(base+'/rest/v1/rpc/issue_phone_otp',{method:'POST',headers:serviceHeaders(key),signal:AbortSignal.timeout(10000),body:JSON.stringify({p_phone:phone,p_ip:ip,p_code_hash:await otpHash(key,phone,otp)})});
      if(!issued.ok)return respond({error:'Could not send a code right now. Please retry shortly.'},503);
      const state=await issued.json();
      if(state==='cooldown')return respond({error:'Please wait 30 seconds before requesting another code.'},429);
      if(state!=='ok')return respond({error:'Too many codes requested. Please try again in an hour.'},429);
      const sent=await fetcher(`https://graph.facebook.com/${env('WHATSAPP_API_VERSION')||'v23.0'}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,{method:'POST',signal:AbortSignal.timeout(15000),
        headers:{Authorization:`Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},
        body:JSON.stringify(otpMessage(phone,env('WHATSAPP_TEMPLATE_OTP')||'verification_code',env('WHATSAPP_TEMPLATE_LANGUAGE')||'en',otp))});
      if(!sent.ok) {
        const failure=await sent.json().catch(()=>null);
        const providerCode=Number.isSafeInteger(failure?.error?.code)?failure.error.code:null;
        // Do not log Meta's response text: it can contain recipients or credentials.
        console.error(JSON.stringify({event:'whatsapp_otp_rejected',status:sent.status,code:providerCode}));
        const reference=providerCode===null?`HTTP ${sent.status}`:`Meta ${providerCode}`;
        return respond({error:`WhatsApp could not send the verification code. Please contact support with reference ${reference}.`},502);
      }
      return respond({sent:true,phone});
    }catch{return respond({error:'Could not send a code right now. Please retry shortly.'},503);}
  };
}
