// Cloudflare Pages Function: search-engine data for each job page (www.kompetenzen.in/job-details?id=...).
//
// job-details.html draws the listing in the browser. On the way out this adds what search engines and AI
// assistants need without running JavaScript: the job's own title and description, its canonical address,
// share tags, and JobPosting data so the opening can appear in Google's job search (Google for Jobs).
// A missing, closed or malformed listing gets noindex. If the database cannot be reached, the page is
// served exactly as before.

export const SUPABASE = 'https://lmimmujaqznybtcinwdo.supabase.co';
// The public (publishable) key, the same one the browser uses in supabase-config.js. Row-level security
// lets it read open listings only.
export const ANON_KEY = 'sb_publishable_3Sq9ZteA_RLrGgP-nSx1gA_zncBTMdG';
export const SITE = 'https://www.kompetenzen.in';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function supabaseGet(path, init = {}) {
  const res = await fetch(SUPABASE + path, {
    ...init,
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    signal: AbortSignal.timeout(3000)
  });
  if (!res.ok) throw new Error('Supabase ' + res.status);
  return res.json();
}

// job_details() returns an open listing (closed ones only to staff and applicants, never to this key);
// expires_on comes from the table, which also shows open listings only.
async function loadJob(id) {
  const [rows, meta] = await Promise.all([
    supabaseGet('/rest/v1/rpc/job_details', { method: 'POST', body: JSON.stringify({ p_job_id: id }) }),
    supabaseGet('/rest/v1/hr_jobs?select=expires_on&id=eq.' + id)
  ]);
  const job = Array.isArray(rows) && rows[0];
  if (!job) return null;
  return { ...job, expires_on: (Array.isArray(meta) && meta[0] && meta[0].expires_on) || null };
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plain = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');

// Plain text from the admin form -> simple HTML (paragraphs and bullet lists), as JobPosting allows.
function richText(text) {
  const lines = String(text ?? '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|div)>/gi, '\n').replace(/<[^>]*>/g, '')
    .split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let html = '';
  let list = false;
  for (const line of lines) {
    const bullet = line.match(/^(?:[•\-*·▪●]|\d+[.)])\s*(.+)$/);
    if (bullet) {
      if (!list) { html += '<ul>'; list = true; }
      html += '<li>' + esc(bullet[1]) + '</li>';
    } else {
      if (list) { html += '</ul>'; list = false; }
      html += '<p>' + esc(line) + '</p>';
    }
  }
  return list ? html + '</ul>' : html;
}

const KERALA = /kerala|kochi|cochin|ernakulam|kakkanad|infopark|trivandrum|thiruvananthapuram|technopark|kozhikode|calicut|cyberpark|thrissur|kollam|kannur|kottayam|alappuzha|alleppey|palakkad|malappuram|kasaragod|pathanamthitta|idukki|wayanad|aluva|angamaly/i;
const REGIONS = [
  [KERALA, 'Kerala'],
  [/bangalore|bengaluru|mysore|mysuru/i, 'Karnataka'],
  [/chennai|coimbatore/i, 'Tamil Nadu'],
  [/hyderabad/i, 'Telangana'],
  [/mumbai|pune/i, 'Maharashtra']
];
const NOT_A_CITY = /remote|work from home|wfh|anywhere|hybrid|on-?site|india|^kerala$|^karnataka$|^tamil nadu$/i;

export function locationData(text) {
  const raw = plain(text) || 'Kochi, Kerala';
  const remote = /remote|work from home|wfh|anywhere/i.test(raw);
  const city = raw.split(/[,/|&;()]|\s+or\s+|\s+and\s+/i).map(p => p.trim()).find(p => p && !NOT_A_CITY.test(p));
  const region = REGIONS.find(([re]) => re.test(raw));
  const data = {};
  if (city || region || !remote) {
    const address = { '@type': 'PostalAddress', addressCountry: 'IN' };
    if (city) address.addressLocality = city;
    if (region) address.addressRegion = region[1];
    data.jobLocation = { '@type': 'Place', address };
  }
  if (remote) {
    data.jobLocationType = 'TELECOMMUTE';
    data.applicantLocationRequirements = { '@type': 'Country', name: 'India' };
  }
  return data;
}

export function employmentType(text) {
  const t = String(text || '');
  if (/intern/i.test(t)) return 'INTERN';
  if (/part/i.test(t)) return 'PART_TIME';
  if (/contract|freelance/i.test(t)) return 'CONTRACTOR';
  if (/temp/i.test(t)) return 'TEMPORARY';
  return 'FULL_TIME';
}

// Freshers' openings say "no requirements", which Google uses for its "No experience" filter.
export function experience(text) {
  const t = plain(text);
  if (!t || /fresher|entry|no experience|beginner|^0\b/i.test(t)) return 'no requirements';
  const n = t.match(/(\d+(?:\.\d+)?)/);
  if (!n) return null;
  const months = /month/i.test(t) && !/year|yr/i.test(t) ? Number(n[1]) : Number(n[1]) * 12;
  return { '@type': 'OccupationalExperienceRequirements', monthsOfExperience: Math.round(months) };
}

// "₹3-5 LPA", "₹25,000 - 35,000 / month", "15k per month" -> a MonetaryAmount; anything unclear -> null.
export function salary(text) {
  let t = plain(text).replace(/,/g, '');
  if (!/\d/.test(t)) return null;
  t = t.replace(/(\d+(?:\.\d+)?)\s*k\b/gi, (_, n) => String(Number(n) * 1000));
  let unit;
  let mult = 1;
  if (/lpa|lakh|lac|l\.p\.a/i.test(t)) { unit = 'YEAR'; mult = 100000; }
  else if (/month|\bpm\b|p\.m\.|\/\s*m\b|per mon/i.test(t)) unit = 'MONTH';
  else if (/annum|year|\byr\b|\bpa\b|p\.a\./i.test(t)) unit = 'YEAR';
  else return null;
  const nums = (t.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0).slice(0, 2).map(n => Math.round(n * mult));
  if (!nums.length) return null;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if ((unit === 'MONTH' && lo < 1000) || (unit === 'YEAR' && lo < 10000)) return null;
  const value = lo === hi
    ? { '@type': 'QuantitativeValue', value: lo, unitText: unit }
    : { '@type': 'QuantitativeValue', minValue: lo, maxValue: hi, unitText: unit };
  return { '@type': 'MonetaryAmount', currency: 'INR', value };
}

export function jobPosting(job, url) {
  const company = plain(job.company);
  const description = [
    richText(job.description),
    job.responsibilities && '<p><strong>Responsibilities</strong></p>' + richText(job.responsibilities),
    job.requirements && '<p><strong>Requirements</strong></p>' + richText(job.requirements),
    job.skills && '<p><strong>Skills:</strong> ' + esc(plain(job.skills)) + '</p>',
    job.about_company && '<p><strong>About ' + esc(company || 'the company') + '</strong></p>' + richText(job.about_company),
    '<p>Apply free on Kompetenzen, the job portal for freshers in Kerala.</p>'
  ].filter(Boolean).join('');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: plain(job.title),
    description,
    identifier: { '@type': 'PropertyValue', name: 'Kompetenzen', value: String(job.id) },
    hiringOrganization: { '@type': 'Organization', name: company || 'Kompetenzen hiring partner' },
    employmentType: employmentType((job.job_type || '') + ' ' + (job.title || '')),
    url,
    ...locationData(job.location)
  };
  if (job.created_at) data.datePosted = String(job.created_at);
  if (job.expires_on) data.validThrough = job.expires_on + 'T23:59:59+05:30';
  const exp = experience(job.experience);
  if (exp) data.experienceRequirements = exp;
  const pay = salary(job.salary);
  if (pay) data.baseSalary = pay;
  if (job.skills) data.skills = plain(job.skills);
  if (job.category) data.occupationalCategory = plain(job.category);
  return data;
}

// Same title format as renderJob() in job-details.html, so the page keeps it after the script runs.
export function jobTitle(job) {
  const company = plain(job.company);
  return `${plain(job.title)}${company ? ' at ' + company : ''}, ${plain(job.location) || 'Kochi, Kerala'} | Kompetenzen Jobs`;
}

export function withJob(html, job, url) {
  const company = plain(job.company);
  const title = jobTitle(job);
  const parts = [`${plain(job.title)} job${company ? ' at ' + company : ''} in ${plain(job.location) || 'Kochi, Kerala'}.`];
  if (plain(job.experience)) parts.push(`Experience: ${plain(job.experience)}.`);
  if (plain(job.salary) && !/competitive/i.test(job.salary)) parts.push(`Salary: ${plain(job.salary)}.`);
  parts.push('Apply free on Kompetenzen, the job portal for Kerala freshers.');
  const description = clip(parts.join(' '), 160);
  const ld = JSON.stringify(jobPosting(job, url)).replace(/</g, '\\u003c');
  const tags = `
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
  <link rel="canonical" href="${esc(url)}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${esc(url)}" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <script type="application/ld+json">${ld}</script>`;
  return html
    .replace(/<title id="page-title">[\s\S]*?<\/title>/, () => `<title id="page-title">${esc(title)}</title>${tags}`)
    .replace(/(<meta name="description" id="page-description"\s+content=")[^"]*(")/, (_, a, b) => a + esc(description) + b);
}

export function withNoindex(html) {
  return html.replace(/<title id="page-title">[\s\S]*?<\/title>/, m => m + '\n  <meta name="robots" content="noindex, follow" />');
}

const OPEN_TTL = 300; // seconds a rendered open listing stays in Cloudflare's cache
const MISSING_TTL = 60;

function edgeCache() {
  try { return typeof caches !== 'undefined' ? caches.default : null; } catch { return null; }
}

export async function onRequestGet(context) {
  const id = (new URL(context.request.url).searchParams.get('id') || '').toLowerCase();
  const valid = UUID.test(id);
  // One cache entry per listing, whatever else is in the query string, so ?x=1 cannot be used to skip it.
  const store = valid ? edgeCache() : null;
  const cacheKey = valid ? new Request(`${SITE}/job-details?id=${id}`, { method: 'GET' }) : null;
  if (store) {
    try {
      const hit = await store.match(cacheKey);
      if (hit) return hit;
    } catch { /* fall through to a fresh render */ }
  }
  const response = await context.next();
  if (!response.ok || !(response.headers.get('content-type') || '').includes('text/html')) return response;
  let job = null;
  if (valid) {
    try {
      job = await loadJob(id);
    } catch {
      return response; // database unreachable: serve the page as published and do not cache it
    }
  }
  const html = await response.text();
  const page = job ? withJob(html, job, `${SITE}/job-details?id=${id}`) : withNoindex(html);
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('etag');
  const result = new Response(page, { status: response.status, statusText: response.statusText, headers });
  if (store) {
    const copy = new Response(page, { status: 200, headers });
    copy.headers.set('Cache-Control', `public, max-age=0, s-maxage=${job ? OPEN_TTL : MISSING_TTL}`);
    const saved = store.put(cacheKey, copy).catch(() => {});
    if (context.waitUntil) context.waitUntil(saved); else await saved;
  }
  return result;
}
