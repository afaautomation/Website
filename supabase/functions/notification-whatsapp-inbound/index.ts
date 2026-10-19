// WhatsApp Cloud API webhook. Meta's X-Hub-Signature-256 prevents forged opt-out requests.
import { validSignature, optOutSenders, failedDeliveries } from '../_shared/whatsapp.mjs';

const env=(key:string)=>Deno.env.get(key)||'';
async function db(path:string,body:unknown) {
  const service=env('SUPABASE_SERVICE_ROLE_KEY');
  const r=await fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`,{method:'PATCH',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok) throw new Error(`Database operation failed (${r.status})`);
}

Deno.serve(async request => {
  // One-time subscription check when the webhook URL is saved in the Meta app dashboard.
  if(request.method==='GET') {
    const q=new URL(request.url).searchParams;
    const token=env('WHATSAPP_VERIFY_TOKEN');
    if(token && q.get('hub.mode')==='subscribe' && q.get('hub.verify_token')===token) return new Response(q.get('hub.challenge')||'');
    return new Response('Forbidden',{status:403});
  }
  if(request.method!=='POST') return new Response('Method not allowed',{status:405});
  if(!env('WHATSAPP_APP_SECRET')) return new Response('Not configured',{status:503});
  const raw=await request.text();
  if(!await validSignature(env('WHATSAPP_APP_SECRET'),raw,request.headers.get('x-hub-signature-256')||'')) return new Response('Invalid signature',{status:403});
  let payload:unknown;
  try { payload=JSON.parse(raw); } catch { return new Response('Bad request',{status:400}); }
  try {
    // STOP and similar replies disable WhatsApp for that number. Re-enabling requires website consent.
    for(const phone of optOutSenders(payload)) {
      await db(`notification_preferences?whatsapp_number=eq.${encodeURIComponent(phone)}`,{whatsapp_enabled:false});
    }
    // "accepted" only meant Meta took the message; record later delivery failures.
    for(const {id,code} of failedDeliveries(payload)) {
      await db(`notification_queue?provider_id=eq.${encodeURIComponent(id)}&state=eq.accepted`,{state:'failed',last_error:`WhatsApp delivery failed${code?` (code ${code})`:''}`});
    }
  } catch(error) { console.error(String(error)); return new Response('Try again',{status:500}); }
  return new Response('OK');
});
