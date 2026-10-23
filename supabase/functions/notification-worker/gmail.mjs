// Server-only Gmail API adapter. Never log credentials, tokens, or provider bodies.
export function emailProvider(env) {
  return env('EMAIL_PROVIDER') || (env('GMAIL_CLIENT_ID') ? 'gmail' : 'resend');
}
export function gmailConfigured(env) {
  return ['GMAIL_CLIENT_ID','GMAIL_CLIENT_SECRET','GMAIL_REFRESH_TOKEN','GMAIL_SENDER_EMAIL'].every(k=>Boolean(env(k)));
}
function mailbox(value) {
  if(typeof value!=='string' || !/^[^\s<>@,;"\\]+@[^\s<>@,;"\\]+\.[^\s<>@,;"\\]+$/.test(value) || /[^\x21-\x7e]/.test(value)) throw new Error('Invalid email address');
  return value;
}
function base64(value) {
  const bytes=new TextEncoder().encode(value); let binary='';
  for(const byte of bytes) binary+=String.fromCharCode(byte);
  return btoa(binary);
}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wrap=value=>base64(value).match(/.{1,76}/g)?.join('\r\n')||'';
export function gmailRaw(delivery,id,createdAt) {
  const from=mailbox(delivery.sender),to=mailbox(delivery.destination);
  if(!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid message identifier');
  const subject=String(delivery.subject).replace(/[\r\n]/g,' ').slice(0,160);
  // Fold encoded words so Unicode subjects stay within RFC 2047 line limits.
  const words=Array.from(subject).reduce((parts,c)=>{
    if(!parts.length || new TextEncoder().encode(parts.at(-1)+c).length>36) parts.push(c); else parts[parts.length-1]+=c;
    return parts;
  },[]).map(part=>`=?UTF-8?B?${base64(part)}?=`).join('\r\n ');
  const boundary=`kompetenzen-${id}`;
  const html=`<!doctype html><html><body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033"><main style="max-width:600px;margin:32px auto;padding:32px;background:white;border-radius:12px"><p style="color:#2456d8;font-weight:bold">KOMPETENZEN</p><h1 style="font-size:24px">${escape(subject)}</h1><div style="white-space:pre-wrap;line-height:1.7">${escape(delivery.text)}</div></main></body></html>`;
  const mime=[`From: Kompetenzen <${from}>`,`To: ${to}`,`Subject: ${words}`,`Date: ${new Date(createdAt).toUTCString()}`,
    `Message-ID: <notification-${id}@${from.split('@')[1]}>`,'MIME-Version: 1.0',`Content-Type: multipart/alternative; boundary="${boundary}"`,'',
    `--${boundary}`,'Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(delivery.text),
    `--${boundary}`,'Content-Type: text/html; charset=UTF-8','Content-Transfer-Encoding: base64','',wrap(html),`--${boundary}--`,''].join('\r\n');
  return base64(mime).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function createGmailSender(env,fetcher=fetch,now=()=>Date.now()) {
  let token='',expires=0;
  return async function send(delivery,id,createdAt,attempts) {
    const failure=(state,error,retrySeconds=120)=>({state,last_error:error,retrySeconds});
    const retry=error=>failure(attempts>=6?'failed':'pending',error);
    let raw;
    try {raw=gmailRaw(delivery,id,createdAt);} catch {return failure('failed','Invalid Gmail message fields');}
    if(!token || now()>=expires) {
      let response;
      try {
        response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(15000),body:new URLSearchParams({client_id:env('GMAIL_CLIENT_ID'),client_secret:env('GMAIL_CLIENT_SECRET'),refresh_token:env('GMAIL_REFRESH_TOKEN'),grant_type:'refresh_token'})});
      } catch {return retry('Gmail token service unavailable; no email sent');}
      if(!response.ok) return response.status===429 || response.status>=500 ? retry('Gmail token service temporarily unavailable') : failure('failed','Gmail authorization failed; check OAuth credentials and reauthorize sender');
      const data=await response.json().catch(()=>null);
      if(!data?.access_token || !(Number(data.expires_in)>0)) return retry('Invalid token service response; no email sent');
      token=data.access_token; expires=now()+Math.max(0,Number(data.expires_in)-60)*1000;
    }
    let response;
    try {
      response=await fetcher(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delivery.sender)}/messages/send`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({raw})});
    } catch {return failure('review','Gmail send response unknown; check Sent mail before retrying');}
    const result=await response.json().catch(()=>null);
    if(response.ok && result?.id) return {state:'accepted',provider_id:result.id,last_error:null};
    // Gmail has no idempotency key support. A stable Message-ID is for reconciliation, not deduplication.
    if(response.ok || response.status>=500) return failure('review','Gmail outcome uncertain; check Sent mail before retrying');
    if(response.status===401) {token='';return retry('Gmail access token rejected; refreshing on retry');}
    const reasons=(result?.error?.errors||[]).map(e=>e.reason);
    if(response.status===429 || (response.status===403 && reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded'].includes(r)))) {
      const value=response.headers.get('retry-after');
      const seconds=value && /^\d+$/.test(value)?Number(value):value?Math.ceil((Date.parse(value)-now())/1000):0;
      return failure(attempts>=6?'failed':'pending','Gmail quota/rate limit reached',Math.max(3600,Number.isFinite(seconds)?seconds:0));
    }
    // Return only known diagnostic categories, never Google's full response or account data.
    const detailReasons=(result?.error?.details||[]).map(e=>e.reason);
    if(response.status===403) {
      if(reasons.includes('accessNotConfigured') || detailReasons.includes('SERVICE_DISABLED'))
        return failure('failed','Gmail API is disabled in the OAuth Google Cloud project');
      if(reasons.includes('insufficientPermissions') || detailReasons.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT'))
        return failure('failed','Gmail OAuth token lacks gmail.send permission; reauthorize the sender');
      if(reasons.includes('domainPolicy'))
        return failure('failed','Google Workspace policy blocks Gmail API access; contact the Workspace administrator');
      if(reasons.includes('forbidden'))
        return failure('failed','Gmail sender access denied; check that the refresh token belongs to the configured sender');
    }
    return failure('failed',`Gmail rejected message (HTTP ${response.status}); check sender access and Gmail API configuration`);
  };
}
