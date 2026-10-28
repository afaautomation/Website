// Supabase Auth "Send SMS" hook used by WhatsApp-number login. Supabase generates, stores,
// expires and verifies the OTP; this hook only delivers it with the WhatsApp authentication template.
import { otpMessage } from '../_shared/whatsapp.mjs';

export function sendSmsHookHandler({env,verify,fetcher=fetch}) {
  return async request=>{
    const headers={'Content-Type':'application/json'};
    // Supabase shows `message` to the person logging in.
    const fail=(status,message)=>new Response(JSON.stringify({error:{http_code:status,message}}),{status,headers});
    if(request.method!=='POST')return fail(405,'Method not allowed');
    const body=await request.text();
    let payload;try{payload=await verify(body,Object.fromEntries(request.headers));}catch{return fail(401,'Invalid hook signature');}
    const phone=String(payload?.user?.phone||'').replace(/\D/g,''), otp=String(payload?.sms?.otp||'');
    if(!/^91[6-9]\d{9}$/.test(phone))return fail(400,'Please use a 10-digit Indian WhatsApp number.');
    if(!/^\d{4,10}$/.test(otp))return fail(400,'Could not create a login code. Please retry.');
    if(!env('WHATSAPP_PHONE_NUMBER_ID')||!env('WHATSAPP_ACCESS_TOKEN'))return fail(503,'WhatsApp login is not set up yet. Please contact support.');
    try {
      const sent=await fetcher(`https://graph.facebook.com/${env('WHATSAPP_API_VERSION')||'v23.0'}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,{method:'POST',signal:AbortSignal.timeout(15000),
        headers:{Authorization:`Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},
        body:JSON.stringify(otpMessage(phone,env('WHATSAPP_TEMPLATE_OTP')||'verification_code',env('WHATSAPP_TEMPLATE_LANGUAGE')||'en',otp))});
      if(!sent.ok) {
        const failure=await sent.json().catch(()=>null);
        const providerCode=Number.isSafeInteger(failure?.error?.code)?failure.error.code:null;
        // Do not log Meta's response text: it can contain recipients or credentials.
        console.error(JSON.stringify({event:'whatsapp_login_otp_rejected',status:sent.status,code:providerCode}));
        return fail(502,`WhatsApp could not send the login code. Please contact support with reference ${providerCode===null?`HTTP ${sent.status}`:`Meta ${providerCode}`}.`);
      }
      return new Response('{}',{status:200,headers});
    }catch{return fail(503,'Could not send the login code right now. Please retry shortly.');}
  };
}
