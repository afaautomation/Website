// Cloudflare Pages Function: forwards kompetenzen.in/sb/* to the Supabase project.
// Some Indian internet providers block *.supabase.co, so visitors on those networks
// could not sign up, log in or load data. The browser now talks only to kompetenzen.in
// (see supabase-config.js) and Cloudflare reaches Supabase on its behalf.

const UPSTREAM = 'https://lmimmujaqznybtcinwdo.supabase.co';
const ALLOWED = ['/auth/v1/', '/rest/v1/', '/storage/v1/', '/functions/v1/'];
const STRIP = ['host', 'cookie', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-for', 'x-real-ip'];

export async function onRequest({ request }) {
  const source = new URL(request.url);
  // Assign pathname instead of resolving an untrusted URL, then check the normalised result.
  const target = new URL(UPSTREAM);
  target.pathname = source.pathname.replace(/^\/sb/, '');
  target.search = source.search;
  if (!ALLOWED.some(prefix => target.pathname.startsWith(prefix))) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const headers = new Headers(request.headers);
  for (const name of STRIP) headers.delete(name);
  // The visitor's verified address, so per-IP rate limits (e.g. WhatsApp codes) stay per visitor.
  headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');
  // Manual redirects pass Google sign-in's 302 back to the browser untouched.
  const init = { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(60000) };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  try {
    const upstream = await fetch(target, init);
    const response = new Response(upstream.body, upstream);
    // Supabase's cookies belong to supabase.co and are never needed by the site.
    response.headers.delete('set-cookie');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    return response;
  } catch (error) {
    const status = error?.name === 'TimeoutError' ? 504 : 502;
    return new Response(JSON.stringify({ error: 'Our server is busy right now. Please retry in a moment.' }), {
      status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
}
