// Cloudflare Pages Function: www.kompetenzen.in/sitemap-jobs.xml, the open job and internship listings.
// Built live from the database (row-level security returns open listings only), so search engines find
// new openings without anyone editing sitemap.xml. robots.txt lists both sitemaps.
import { SITE, supabaseGet } from './job-details.js';

export async function onRequestGet() {
  try {
    const rows = await supabaseGet('/rest/v1/hr_jobs?select=id,created_at&order=created_at.desc&limit=1000');
    const urls = (Array.isArray(rows) ? rows : [])
      .filter(row => row && /^[0-9a-f-]{36}$/i.test(String(row.id)))
      .map(row => `  <url><loc>${SITE}/job-details?id=${row.id}</loc>` +
        (row.created_at ? `<lastmod>${String(row.created_at).slice(0, 10)}</lastmod>` : '') + '</url>');
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + (urls.length ? '\n' : '') + '</urlset>\n';
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
    });
  } catch {
    return new Response('The job sitemap is temporarily unavailable.', {
      status: 503, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' }
    });
  }
}
