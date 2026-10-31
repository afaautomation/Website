// Only GET/HEAD requests; never prints credentials or personal records.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const config = fs.readFileSync(path.join(root,'supabase-config.js'),'utf8');
const base = config.match(/const SUPABASE_URL = "([^"]+)"/)[1];
const anon = config.match(/const SUPABASE_ANON_KEY = "([^"]+)"/)[1];
const env = {};
const envPath = path.join(root,'Resume/backend/.env');
if(fs.existsSync(envPath)) for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/);
  if(m) env[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
}
const results = { publicHttp:[], anonymousTables:[], storage:[], auth:{} };
async function get(url, options={}) {
  try { return await fetch(url,{...options,signal:AbortSignal.timeout(15000)}); }
  catch { return null; }
}
async function main() {
  for(const url of ['https://kompetenzen.in/','https://www.kompetenzen.in/','https://kompetenzen.pages.dev/','https://kompetenzen.pages.dev/robots.txt','https://kompetenzen.pages.dev/sitemap.xml','https://kompetenzen.pages.dev/audit-nonexistent-page-20261101']) {
    const start=performance.now(), r=await get(url);
    if(!r){results.publicHttp.push({url,error:'Unavailable'});continue;}
    const body=await r.text();
    results.publicHttp.push({url,finalUrl:r.url,status:r.status,elapsedMs:Math.round(performance.now()-start),bytes:Buffer.byteLength(body),title:body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],headers:Object.fromEntries(['content-type','cache-control','strict-transport-security','content-security-policy','x-frame-options','x-content-type-options','x-robots-tag','content-encoding'].map(k=>[k,r.headers.get(k)]))});
  }
  for(const table of ['profiles','candidate_profiles','resumes','resume_versions','import_jobs','job_applications','course_enrollments','consultation_requests','genai_enquiries','dyf_seat_requests','staff_emails','notification_preferences','notification_queue','phone_otps','phone_otp_ip_limits']) {
    const r=await get(base+'/rest/v1/'+table+'?select=*',{method:'HEAD',headers:{apikey:anon,Prefer:'count=exact'}});
    results.anonymousTables.push({table,status:r?.status||null,contentRange:r?.headers.get('content-range')||null});
  }
  const settings=await get(base+'/auth/v1/settings',{headers:{apikey:anon}});
  if(settings?.ok){const s=await settings.json();results.auth={status:settings.status,signupEnabled:!s.disable_signup,emailAutoconfirm:s.mailer_autoconfirm,phoneAutoconfirm:s.phone_autoconfirm,external:s.external};}
  if(env.SUPABASE_URL===base && env.SUPABASE_SERVICE_ROLE_KEY) {
    const r=await get(base+'/storage/v1/bucket',{headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY}});
    if(r?.ok) results.storage=(await r.json()).map(({name,public:pub,file_size_limit,allowed_mime_types})=>({name,public:pub,file_size_limit,allowed_mime_types}));
  }
  fs.mkdirSync(path.join(root,'output/preproduction-audit'),{recursive:true});
  fs.writeFileSync(path.join(root,'output/preproduction-audit/live-readonly.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify(results,null,2));
}
main().catch(()=>{console.error('Read-only audit failed');process.exitCode=1;});
