import { Webhook } from 'npm:standardwebhooks@1.0.0';
import { sendSmsHookHandler } from './handler.mjs';
// SEND_SMS_HOOK_SECRET is the "v1,whsec_..." value shown when the hook is created in Supabase Auth.
const secret=(Deno.env.get('SEND_SMS_HOOK_SECRET')||'').replace('v1,whsec_','');
Deno.serve(sendSmsHookHandler({
  env:(key:string)=>Deno.env.get(key)||'',
  verify:async(body:string,headers:Record<string,string>)=>{ if(!secret) throw new Error('Hook secret missing'); return new Webhook(secret).verify(body,headers); }
}));
