// Read-only diagnostics. Never prints credentials, recipient addresses or message bodies.
const {getSupabaseAdmin}=require('./supabase-admin.cjs');
async function main(){
  const sb=getSupabaseAdmin();
  if(sb){
    for(const table of ['notification_preferences','notification_queue']){
      const {count,error}=await sb.from(table).select('*',{count:'exact',head:true});
      console.log(JSON.stringify({table,count,error:error?{code:error.code,message:error.message}:null}));
    }
    const {data,error}=await sb.from('notification_queue').select('state,channel,last_error,attempts').order('created_at',{ascending:false}).limit(50);
    if(!error){const groups={};for(const r of data){const k=[r.channel,r.state,'attempts='+r.attempts,r.last_error||''].join(' | ');groups[k]=(groups[k]||0)+1;}console.log(JSON.stringify({recentQueue:groups}));}
    const {count}=await sb.from('notification_preferences').select('*',{count:'exact',head:true}).eq('email_enabled',true);
    console.log(JSON.stringify({emailOptIns:count}));
  }else console.log('Local database diagnostic credentials unavailable');
  for(const origin of ['http://127.0.0.1:5500','https://kompetenzen.in']){
    try{const r=await fetch(origin+'/create-profile.html',{signal:AbortSignal.timeout(8000)});const body=await r.text();console.log(JSON.stringify({origin,status:r.status,notificationUI:body.includes('id="notification-preferences"'),notificationScript:body.includes('js/notification-preferences.js')}));}catch{console.log(JSON.stringify({origin,reachable:false}));}
  }
}
main().catch(()=>{console.error('Diagnostic request failed; check network access and local configuration');process.exitCode=1;});
