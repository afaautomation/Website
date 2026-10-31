// Cloudflare Pages Function: forwards kompetenzen.in/api/* to the Resume Builder
// backend on Google Cloud Run. Keeping the API on the site's own domain means the
// browser shares one login between the website and the Resume Builder.
//
// Pages environment variables (Settings -> Variables and Secrets):
//   RESUME_BACKEND_URL   the Cloud Run service URL, e.g. https://resume-api-xxxx.a.run.app
//   RESUME_PROXY_SECRET  same value as PROXY_SECRET on Cloud Run (store as a secret)

const STRIP = ['host', 'cookie', 'cf-connecting-ip', 'x-forwarded-for', 'x-real-ip', 'x-proxy-secret'];

export async function forward(request, env, path) {
  if (!env.RESUME_BACKEND_URL || !env.RESUME_PROXY_SECRET) {
    return new Response('Resume Builder is not configured.', { status: 503 });
  }
  const source = new URL(request.url);
  // Assign pathname instead of resolving an untrusted URL. A path beginning
  // with // would otherwise replace the host and leak the proxy credential.
  let target;
  try {
    target = new URL(env.RESUME_BACKEND_URL);
    if (target.protocol !== 'https:' || target.username || target.password) throw new Error('Invalid backend');
  } catch {
    return new Response('Resume Builder is not configured.', { status: 503 });
  }
  target.pathname = path;
  target.search = source.search;
  target.hash = '';
  const headers = new Headers(request.headers);
  for (const name of STRIP) headers.delete(name);
  headers.set('x-proxy-secret', env.RESUME_PROXY_SECRET);
  // Cloudflare's verified client address; the backend's rate limits key on it.
  headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');
  headers.set('x-forwarded-proto', 'https');
  // Allow the existing AI provider fallback chain (45 seconds per heavy slot).
  const init = { method: request.method, headers, redirect: 'manual', signal: AbortSignal.timeout(300000) };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  try {
    const upstream = await fetch(target, init);
    const response = new Response(upstream.body, upstream);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-Frame-Options', 'SAMEORIGIN');
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    const status = error?.name === 'TimeoutError' ? 504 : 502;
    return new Response('Resume Builder is temporarily unavailable. Please retry.', {
      status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  }
}

export async function onRequest({ request, env }) {
  return forward(request, env, new URL(request.url).pathname);
}
