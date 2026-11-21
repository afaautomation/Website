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

// resume.kompetenzen.in shows the same builder at its own address. Every bar link and the builder's
// own "../" links point back to the main website, so clicking a heading leaves for www.kompetenzen.in.
export const RESUME_HOST = 'resume.kompetenzen.in';
const WWW = 'https://www.kompetenzen.in/';
const SUBDOMAIN_BAR_SCRIPT = BAR_SCRIPT.replace('data-base="/"', 'data-base="' + WWW + '" data-resume-url="/"');
export const onResumeHost = request => new URL(request.url).hostname === RESUME_HOST;

// Search-engine tags for the builder's home screen, added on the way through like the top bar (the
// builder's own <title> is "ResumePro"). The canonical address keeps ?resume=<id> links out of search.
const SEO_TITLE = 'Free Resume Builder: ATS-Friendly Templates | Kompetenzen';
const SEO_DESCRIPTION = 'Build a professional, ATS-friendly resume in minutes with free templates and AI suggestions, then ' +
  'download it as a PDF. Free for every job seeker in Kerala and across India.';
const SEO_URL = 'https://www.kompetenzen.in/Resume/';
const SEO_IMAGE = 'https://www.kompetenzen.in/img/og/og-resume.jpg';
const SEO_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Kompetenzen Resume Builder',
  url: SEO_URL,
  description: SEO_DESCRIPTION,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any (web browser)',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  featureList: ['ATS-friendly resume templates', 'AI suggestions', 'ATS score check', 'Download as PDF', 'Saved resumes'],
  provider: { '@type': 'EducationalOrganization', '@id': 'https://www.kompetenzen.in/#organization', name: 'Kompetenzen Technologies', url: 'https://www.kompetenzen.in/' }
};
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const SEO_TAGS = '<title>' + SEO_TITLE + '</title>' +
  '<meta name="description" content="' + attr(SEO_DESCRIPTION) + '">' +
  '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">' +
  '<link rel="canonical" href="' + SEO_URL + '">' +
  '<meta property="og:type" content="website"><meta property="og:site_name" content="Kompetenzen Technologies">' +
  '<meta property="og:locale" content="en_IN">' +
  '<meta property="og:title" content="' + attr(SEO_TITLE) + '">' +
  '<meta property="og:description" content="' + attr(SEO_DESCRIPTION) + '">' +
  '<meta property="og:url" content="' + SEO_URL + '"><meta property="og:image" content="' + SEO_IMAGE + '">' +
  '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' +
  '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="' + SEO_IMAGE + '">' +
  '<script type="application/ld+json">' + JSON.stringify(SEO_DATA).replace(/</g, '\\u003c') + '</script>';

export function withSeo(html) {
  if (html.includes('rel="canonical"')) return html;
  const cleaned = html.replace(/<meta\s+name=["']description["'][^>]*>/gi, '');
  return /<title>[\s\S]*?<\/title>/i.test(cleaned)
    ? cleaned.replace(/<title>[\s\S]*?<\/title>/i, () => SEO_TAGS)
    : cleaned.replace(/<\/head>/i, () => SEO_TAGS + '</head>');
}

export async function withSiteBar(response, subdomain = false) {
  const type = response.headers.get('content-type') || '';
  if (!response.ok || !type.includes('text/html')) return response;
  let out = withSeo(await response.text());
  const landing = out.match(/<section\b[^>]*\bid=["']landing-view["'][^>]*>/i);
  if (landing && !out.includes('site-nav.js')) {
    out = out
      .replace(/<\/head>/i, () => BAR_STYLE + '</head>')
      .replace(landing[0], () => landing[0] + (subdomain ? SUBDOMAIN_BAR_SCRIPT : BAR_SCRIPT));
  }
  if (subdomain) out = out.replace(/href="\.\.\//g, () => 'href="' + WWW);
  const result = new Response(out, response);
  result.headers.delete('content-length');
  return result;
}

// Serves the builder for a path relative to its root ('/' is the home screen).
export async function serveBuilder(request, env, path) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  if (path === '/') {
    const page = await forward(request, env, PAGE);
    const out = request.method === 'GET' ? await withSiteBar(page, onResumeHost(request)) : page;
    // forward() marks everything it proxies noindex; the builder's home screen is the one page to index
    if (out.ok && (out.headers.get('content-type') || '').includes('text/html')) out.headers.delete('X-Robots-Tag');
    return out;
  }
  return forward(request, env, path);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/Resume/, '');
  if (onResumeHost(request)) return Response.redirect(url.origin + (path || '/') + url.search, 301);
  if (path === '' || path === PAGE) return Response.redirect(url.origin + '/Resume/' + url.search, 301);
  return serveBuilder(request, env, path);
}
