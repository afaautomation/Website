// Cloudflare Pages Function: serves the Resume Builder pages at kompetenzen.in/Resume/*
// from the Cloud Run backend (which also serves the builder's HTML, JS and images).
// Same domain as the website, so visitors stay signed in.
import { forward } from '../api/[[path]].js';

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/Resume/, '');
  if (path === '' || path === '/') return Response.redirect(url.origin + '/Resume/resume.html', 302);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  return forward(request, env, path);
}
