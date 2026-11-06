// Cloudflare Pages Function: serves the Resume Builder pages at kompetenzen.in/Resume/*
// from the Cloud Run backend (which also serves the builder's HTML, JS and images).
// Same domain as the website, so visitors stay signed in.
//
// The builder lives at the clean address /Resume/ (the trailing slash matters: the page loads
// its files with relative paths such as frontend/app.js). /Resume and the old
// /Resume/resume.html redirect there, keeping ?resume=<id> and other query parameters.
import { forward } from '../api/[[path]].js';

const PAGE = '/resume.html';

// The website's shared top bar, added to the builder's home screen on the way through so it
// ships with the website (no Cloud Run deploy). The builder's own bar moves below it and drops
// its logo, which the site bar already shows. Skipped if the page already includes the bar.
const BAR_STYLE = '<style id="kz-site-bar">' +
  '#landing-view .glass-nav{top:64px}' +
  '#landing-view .glass-nav .nav-left{visibility:hidden}' +
  '#landing-view .hero-section{margin-top:64px}' +
  '</style>';
const BAR_SCRIPT = '<script src="/js/site-nav.js" data-base="/" data-active="Resume/" data-position="fixed-all" data-account="off"></script>';

export async function withSiteBar(response) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return response;
  const html = await response.text();
  const landing = html.match(/<section\b[^>]*\bid=["']landing-view["'][^>]*>/i);
  if (!landing || html.includes('site-nav.js')) return new Response(html, response);
  const out = html
    .replace(/<\/head>/i, BAR_STYLE + '</head>')
    .replace(landing[0], landing[0] + BAR_SCRIPT);
  const result = new Response(out, response);
  result.headers.delete('content-length');
  return result;
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/Resume/, '');
  if (path === '' || path === PAGE) return Response.redirect(url.origin + '/Resume/' + url.search, 301);
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (path === '/') {
    const page = await forward(request, env, PAGE);
    return request.method === 'GET' ? withSiteBar(page) : page;
  }
  return forward(request, env, path);
}
