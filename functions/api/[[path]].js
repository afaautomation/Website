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
  const target = new URL(path + source.search, env.RESUME_BACKEND_URL);
  const headers = new Headers(request.headers);
  for (const name of STRIP) headers.delete(name);
  headers.set('x-proxy-secret', env.RESUME_PROXY_SECRET);
  // Cloudflare's verified client address; the backend's rate limits key on it.
  headers.set('x-forwarded-for', request.headers.get('cf-connecting-ip') || '');
  headers.set('x-forwarded-proto', 'https');
  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
  return fetch(target, init);
}

export async function onRequest({ request, env }) {
  return forward(request, env, new URL(request.url).pathname);
}
