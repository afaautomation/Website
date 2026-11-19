const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const load = () => import(pathToFileURL(path.join(root, 'functions/job-details.js')).href);
const page = () => fs.readFileSync(path.join(root, 'job-details.html'), 'utf8');

const JOB = {
  id: 'cfe4fba7-849a-4c3b-96d2-6006b37305f7', title: 'Junior DevOps Engineer', company: 'Reizend', category: 'tech',
  location: 'Trivandrum, Kerala', job_type: 'full-time', experience: 'Freshers', salary: '₹4 LPA', skills: 'Linux, Docker',
  description: 'Reizend is hiring freshers.\n- Work with cloud\n- Learn <b>CI/CD</b>', responsibilities: '', requirements: '',
  about_company: '', created_at: '2026-11-05T22:45:59+00:00', expires_on: '2026-11-30'
};

test('salary text becomes a MonetaryAmount only when it is clear', async () => {
  const { salary } = await load();
  assert.deepEqual(salary('₹4 LPA').value, { '@type': 'QuantitativeValue', value: 400000, unitText: 'YEAR' });
  assert.deepEqual(salary('₹3 - 4.5 LPA').value, { '@type': 'QuantitativeValue', minValue: 300000, maxValue: 450000, unitText: 'YEAR' });
  assert.deepEqual(salary('₹25,000 - ₹35,000 per month').value, { '@type': 'QuantitativeValue', minValue: 25000, maxValue: 35000, unitText: 'MONTH' });
  assert.equal(salary('15k/month').value.value, 15000);
  assert.equal(salary('Competitive'), null);
  assert.equal(salary('As per industry standards'), null);
  assert.equal(salary('5'), null);
});

test('locations map to Kerala addresses and remote work', async () => {
  const { locationData } = await load();
  assert.deepEqual(locationData('Kochi, Kerala').jobLocation.address,
    { '@type': 'PostalAddress', addressCountry: 'IN', addressLocality: 'Kochi', addressRegion: 'Kerala' });
  assert.equal(locationData('Infopark Kochi').jobLocation.address.addressRegion, 'Kerala');
  assert.equal(locationData('Bengaluru').jobLocation.address.addressRegion, 'Karnataka');
  const remote = locationData('Remote');
  assert.equal(remote.jobLocationType, 'TELECOMMUTE');
  assert.equal(remote.jobLocation, undefined);
  const hybrid = locationData('Kochi / Remote');
  assert.equal(hybrid.jobLocation.address.addressLocality, 'Kochi');
  assert.equal(hybrid.jobLocationType, 'TELECOMMUTE');
  assert.equal(locationData('').jobLocation.address.addressLocality, 'Kochi');
});

test('fresher openings say no experience is required', async () => {
  const { experience, employmentType } = await load();
  assert.equal(experience('Freshers '), 'no requirements');
  assert.equal(experience('Entry Level'), 'no requirements');
  assert.equal(experience('0-1 years'), 'no requirements');
  assert.equal(experience('2+ years').monthsOfExperience, 24);
  assert.equal(experience('All Levels'), null);
  assert.equal(employmentType('internship Python Intern'), 'INTERN');
  assert.equal(employmentType('full-time'), 'FULL_TIME');
});

test('a listing gets its own title, canonical address and JobPosting data', async () => {
  const { withJob } = await load();
  const url = 'https://www.kompetenzen.in/job-details?id=' + JOB.id;
  const html = withJob(page(), JOB, url);
  const head = html.slice(0, html.indexOf('</head>'));
  assert.match(head, /<title id="page-title">Junior DevOps Engineer at Reizend, Trivandrum, Kerala \| Kompetenzen Jobs<\/title>/);
  assert.ok(head.includes(`<link rel="canonical" href="${url}" />`));
  assert.doesNotMatch(head, /noindex/);
  const data = JSON.parse(head.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  assert.equal(data['@type'], 'JobPosting');
  assert.equal(data.hiringOrganization.name, 'Reizend');
  assert.equal(data.validThrough, '2026-11-30T23:59:59+05:30');
  assert.equal(data.experienceRequirements, 'no requirements');
  assert.match(data.description, /<ul><li>Work with cloud<\/li><li>Learn CI\/CD<\/li><\/ul>/);
  assert.ok(!head.includes('<b>CI'), 'markup from the listing is not copied into the page');
});

test('job pages without an open listing are kept out of search, and the database is not called for bad ids', async t => {
  const { onRequestGet } = await load();
  const calls = [];
  t.mock.method(globalThis, 'fetch', async url => { calls.push(String(url)); return new Response('[]', { headers: { 'content-type': 'application/json' } }); });
  const next = async () => new Response(page(), { headers: { 'content-type': 'text/html' } });
  for (const query of ['', '?id=not-a-uuid', '?id=00000000-0000-0000-0000-000000000000']) {
    const res = await onRequestGet({ request: new Request('https://www.kompetenzen.in/job-details' + query), next });
    assert.match(await res.text(), /<meta name="robots" content="noindex, follow" \/>/, query);
  }
  assert.equal(calls.length, 2, 'only the valid id reached the database');
});

test('an unreachable database leaves the page exactly as published', async t => {
  const { onRequestGet } = await load();
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });
  const next = async () => new Response(page(), { headers: { 'content-type': 'text/html' } });
  const res = await onRequestGet({ request: new Request('https://www.kompetenzen.in/job-details?id=' + JOB.id), next });
  assert.equal(await res.text(), page());
});

test('the Resume Builder home screen gets its own search tags and keeps the site bar', async () => {
  const { withSiteBar } = await import(pathToFileURL(path.join(root, 'functions/Resume/[[path]].js')).href);
  const html = '<html><head><title>ResumePro | Build Your Professional Future</title></head><body>' +
    '<section id="landing-view" class="view">x</section></body></html>';
  const out = await (await withSiteBar(new Response(html, { headers: { 'content-type': 'text/html' } }))).text();
  assert.match(out, /<title>Free Resume Builder: ATS-Friendly Templates \| Kompetenzen<\/title>/);
  assert.ok(out.includes('<link rel="canonical" href="https://www.kompetenzen.in/Resume/">'));
  assert.equal(JSON.parse(out.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]).offers.price, '0');
  assert.ok(out.includes('site-nav.js'));
  assert.ok(!out.includes('ResumePro'));
});

test('a rendered listing is cached at the edge so repeat visits and crawlers do not reach the database', async t => {
  const { onRequestGet } = await load();
  const store = new Map();
  globalThis.caches = { default: {
    match: async req => { const hit = store.get(req.url); return hit ? hit.clone() : undefined; },
    put: async (req, res) => { store.set(req.url, res.clone()); }
  } };
  t.after(() => { delete globalThis.caches; });
  let database = 0, assets = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    database++;
    const body = String(url).includes('rpc/job_details') ? JSON.stringify([JOB]) : JSON.stringify([{ expires_on: '2026-11-30' }]);
    return new Response(body, { headers: { 'content-type': 'application/json' } });
  });
  const next = async () => { assets++; return new Response(page(), { headers: { 'content-type': 'text/html' } }); };
  const visit = query => onRequestGet({ request: new Request('https://www.kompetenzen.in/job-details?id=' + JOB.id + query), next });
  const first = await visit('');
  assert.match(await first.text(), /"@type":"JobPosting"/);
  assert.equal(database, 2); assert.equal(assets, 1);
  const again = await visit('&utm_source=whatsapp');
  assert.match(await again.text(), /"@type":"JobPosting"/);
  assert.equal(database, 2, 'second visit, even with extra query text, came from the cache');
  assert.equal(assets, 1);
  assert.match([...store.values()][0].headers.get('cache-control'), /s-maxage=300/);
  // a listing that is not found is remembered for a minute only
  store.clear(); database = 0;
  t.mock.method(globalThis, 'fetch', async () => { database++; return new Response('[]', { headers: { 'content-type': 'application/json' } }); });
  const missing = await onRequestGet({ request: new Request('https://www.kompetenzen.in/job-details?id=' + JOB.id), next });
  assert.match(await missing.text(), /noindex/);
  assert.match([...store.values()][0].headers.get('cache-control'), /s-maxage=60/);
});
