import { messageFor, failureState } from './messages.mjs';

const env=(key:string)=>Deno.env.get(key)||'';
const base=env('SUPABASE_URL');
const service=env('SUPABASE_SERVICE_ROLE_KEY');
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
      if(q.attempts>1 && Date.now()-Date.parse(q.first_attempt_at)>23*3600000) {await update(q.id,{state:'review',last_error:'Retry window expired; reconcile with provider'});continue;}
      const [p]=await db(`notification_preferences?user_id=eq.${q.user_id}`);
      if(!p || !p[`${q.channel}_enabled`] || (q.payload.event==='digest' && p.job_digest==='off')) {await update(q.id,{state:'cancelled'});continue;}
      const configured=q.channel==='email' ? env('RESEND_API_KEY') && env('EMAIL_FROM') : env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_WHATSAPP_FROM') && env('TWILIO_CONTENT_'+q.payload.event.toUpperCase());
      if(!configured) {await update(q.id,{state:'pending',attempts:q.attempts-1,first_attempt_at:q.first_attempt_at===q.started_at?null:q.first_attempt_at,available_at:new Date(Date.now()+3600000).toISOString(),last_error:'Provider configuration missing'});continue;}
      let destination=p.whatsapp_number;
      if(q.channel==='email') {
        const r=await fetch(`${base}/auth/v1/admin/users/${q.user_id}`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
        if(!r.ok) throw new Error('Could not load verified email');
        const user=await r.json(); destination=user.email_confirmed_at?user.email:'';
      }
      if(!destination || (q.delivery && q.delivery.destination!==destination)) {await update(q.id,{state:'cancelled',last_error:'Recipient unavailable or changed'});continue;}
      if(!q.delivery && q.payload.event==='not_matched') q.payload.alternatives=await db('rpc/notification_alternatives','POST',{p_user:q.user_id,p_exclude:q.payload.job_id});
      const delivery=q.delivery || {destination,...messageFor(q.payload,site)};
      if(!q.delivery) await update(q.id,{delivery});
      let response:Response|undefined;
      try {
        if(q.channel==='email') {
          response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${env('RESEND_API_KEY')}`,'Content-Type':'application/json','Idempotency-Key':q.id},body:JSON.stringify({from:env('EMAIL_FROM'),to:[destination],subject:delivery.subject,text:delivery.text})});
        } else {
          const form=new URLSearchParams({From:env('TWILIO_WHATSAPP_FROM'),To:`whatsapp:${destination}`,ContentSid:env('TWILIO_CONTENT_'+q.payload.event.toUpperCase()),ContentVariables:JSON.stringify({'1':q.payload.title.slice(0,200),'2':delivery.text.replace(/\s+/g,' ').slice(0,900)})});
          response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env('TWILIO_ACCOUNT_SID')}/Messages.json`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Basic ${btoa(env('TWILIO_ACCOUNT_SID')+':'+env('TWILIO_AUTH_TOKEN'))}`},body:form});
        }
      } catch { /* A timeout may have been accepted by the provider; classify below. */ }
      if(response?.ok) {
        const result=await response.json();
        await update(q.id,{state:'accepted',provider_id:result.id || result.sid,last_error:null});
      } else {
        await update(q.id,{state:failureState(q.channel,response?.status,q.attempts,q.first_attempt_at),last_error:response?`Provider HTTP ${response.status}`:'Provider response unknown',available_at:new Date(Date.now()+Math.min(3600,60*2**q.attempts)*1000).toISOString()});
      }
      processed++;
    }
    return Response.json({processed});
  } catch(error) { console.error(String(error)); return new Response('Worker failed; inspect notification queue',{status:500}); }
});
