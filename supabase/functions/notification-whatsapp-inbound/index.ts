// Twilio request signing prevents forged opt-out requests.
Deno.serve(async request => {
  if(request.method!=='POST') return new Response('Method not allowed',{status:405});
  const token=Deno.env.get('TWILIO_AUTH_TOKEN');
  const publicUrl=Deno.env.get('TWILIO_INBOUND_URL');
  if(!token || !publicUrl) return new Response('Not configured',{status:503});
  const params=new URLSearchParams(await request.text());
  const signed=publicUrl+[...new Set(params.keys())].sort().map(k=>k+params.get(k)).join('');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']);
  const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signed)));
  const expected=btoa(String.fromCharCode(...bytes));
  const actual=request.headers.get('x-twilio-signature')||'';
  let difference=expected.length^actual.length;
  for(let i=0;i<expected.length;i++) difference|=expected.charCodeAt(i)^(actual.charCodeAt(i)||0);
  if(difference) return new Response('Invalid signature',{status:403});
  if(/^(stop|unsubscribe|cancel|end|quit)$/i.test((params.get('Body')||'').trim())) {
    const phone=(params.get('From')||'').replace(/^whatsapp:/,'');
    if(!/^\+[1-9]\d{7,14}$/.test(phone)) return new Response('Invalid sender',{status:400});
    const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
    const response=await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/notification_preferences?whatsapp_number=eq.${encodeURIComponent(phone)}`,{method:'PATCH',headers:{apikey:service,Authorization:`Bearer ${service}`,'Content-Type':'application/json'},body:JSON.stringify({whatsapp_enabled:false})});
    if(!response.ok) return new Response('Try again',{status:500});
  }
  return new Response('<Response/>',{headers:{'Content-Type':'text/xml'}});
});
