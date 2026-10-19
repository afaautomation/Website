import { messageFor, failureState } from './messages.mjs';
import { emailProvider, gmailConfigured, createGmailSender } from './gmail.mjs';
import { DEFAULT_TEMPLATES, templateMessage, effectiveStatus } from '../_shared/whatsapp.mjs';

const env=(key:string)=>Deno.env.get(key)||'';
const base=env('SUPABASE_URL');
const service=env('SUPABASE_SERVICE_ROLE_KEY');
const sendGmail=createGmailSender(env);
const template=(event:string)=>env('WHATSAPP_TEMPLATE_'+event.toUpperCase())||(DEFAULT_TEMPLATES as Record<string,string>)[event]||'';
async function db(path:string,method='GET',body?:unknown) {
  const r=await fetch(`${base}/rest/v1/${path}`,{method,headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  if(!r.ok) throw new Error(`Database operation failed (${r.status})`);
  return r.status===204?null:await r.json();
}
async function update(id:string, values:unknown) { await db(`notification_queue?id=eq.${id}`,'PATCH',values); }
Deno.serve(async request=>{
  if(request.method!=='POST' || !env('NOTIFICATION_WORKER_SECRET') || request.headers.get('x-worker-secret')!==env('NOTIFICATION_WORKER_SECRET')) return new Response('Unauthorized',{status:401});
  if(!env('SITE_URL').startsWith('https://')) return new Response('Configure SITE_URL',{status:503});
  const site=env('SITE_URL').replace(/\/$/,'');
  let processed=0;
  try {
    await db('rpc/queue_job_digests','POST',{});
    for(let i=0;i<20;i++) {
      const [q]=await db('rpc/claim_notification','POST',{}); if(!q) break;
      const provider=q.channel==='email' ? emailProvider(env) : 'whatsapp';
      if(q.channel==='email' && q.delivery && (q.delivery.provider || 'resend')!==provider) {await update(q.id,{state:'review',last_error:'Email provider changed; reconcile previous send before retrying'});continue;}
      if(provider==='resend' && q.attempts>1 && Date.now()-Date.parse(q.first_attempt_at)>23*3600000) {await update(q.id,{state:'review',last_error:'Retry window expired; reconcile with provider'});continue;}
      const [p]=await db(`notification_preferences?user_id=eq.${q.user_id}`);
      if(!p || !p[`${q.channel}_enabled`] || (q.payload.event==='digest' && p.job_digest==='off')) {await update(q.id,{state:'cancelled'});continue;}
      const configured=q.channel==='email' ? (provider==='gmail' ? gmailConfigured(env) : provider==='resend' && env('RESEND_API_KEY') && env('EMAIL_FROM')) : env('WHATSAPP_PHONE_NUMBER_ID') && env('WHATSAPP_ACCESS_TOKEN') && template(q.payload.event);
      if(!configured) {await update(q.id,{state:'pending',attempts:q.attempts-1,first_attempt_at:q.first_attempt_at===q.started_at?null:q.first_attempt_at,available_at:new Date(Date.now()+3600000).toISOString(),last_error:'Provider configuration missing'});continue;}
      let destination=p.whatsapp_number;
      if(q.channel==='email') {
        const r=await fetch(`${base}/auth/v1/admin/users/${q.user_id}`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
        if(!r.ok) throw new Error('Could not load verified email');
        const user=await r.json(); destination=user.email_confirmed_at?user.email:'';
      }
      if(!destination || (q.delivery && q.delivery.destination!==destination)) {await update(q.id,{state:'cancelled',last_error:'Recipient unavailable or changed'});continue;}
      if(!q.delivery && q.payload.event==='not_matched') q.payload.alternatives=await db('rpc/notification_alternatives','POST',{p_user:q.user_id,p_exclude:q.payload.job_id});
      const delivery=q.delivery || {destination,...messageFor(q.payload,site),...(q.channel==='email'?{provider,sender:provider==='gmail'?env('GMAIL_SENDER_EMAIL'):env('EMAIL_FROM')}:{})};
      if(provider==='gmail' && delivery.sender!==env('GMAIL_SENDER_EMAIL')) {await update(q.id,{state:'review',last_error:'Gmail sender changed; reconcile previous send before retrying'});continue;}
      if(!q.delivery) await update(q.id,{delivery});
      if(provider==='gmail') {
        const {retrySeconds,...outcome}=await sendGmail(delivery,q.id,q.created_at,q.attempts);
        await update(q.id,{...outcome,...(outcome.state==='pending'?{available_at:new Date(Date.now()+Math.max(retrySeconds||0,Math.min(3600,60*2**q.attempts))*1000).toISOString()}:{})});
        processed++;
        continue;
      }
      let response:Response|undefined;
      try {
        if(q.channel==='email') {
          response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':q.id},body:JSON.stringify({from:env('EMAIL_FROM'),to:[destination],subject:delivery.subject,text:delivery.text})});
        } else {
          const message=templateMessage(destination,template(q.payload.event),env('WHATSAPP_TEMPLATE_LANGUAGE')||'en',q.payload.title||'',delivery.text);
          response=await fetch(`https://graph.facebook.com/${env('WHATSAPP_API_VERSION')||'v23.0'}/${env('WHATSAPP_PHONE_NUMBER_ID')}/messages`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env('WHATSAPP_ACCESS_TOKEN')}`,'Content-Type':'application/json'},body:JSON.stringify(message)});
        }
      } catch { /* A timeout may have been accepted by the provider; classify below. */ }
      if(response?.ok) {
        const result=await response.json();
        await update(q.id,{state:'accepted',provider_id:result.id || result.messages?.[0]?.id,last_error:null});
      } else {
        // Meta returns an error code in the body; only its explicit rate-limit codes are retried.
        const code=response && q.channel==='whatsapp' ? (await response.json().catch(()=>({})))?.error?.code : undefined;
        const status=response ? effectiveStatus(response.status,code) : undefined;
        await update(q.id,{state:failureState(q.channel,status,q.attempts,q.first_attempt_at),last_error:response?`Provider HTTP ${response.status}${code?` (code ${code})`:''}`:'Provider response unknown',available_at:new Date(Date.now()+Math.min(3600,60*2**q.attempts)*1000).toISOString()});
      }
      processed++;
    }
    return Response.json({processed});
  } catch(error) { console.error(String(error)); return new Response('Worker failed; inspect notification queue',{status:500}); }
});
