const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const fn = rel => import(pathToFileURL(path.join(root, 'functions', rel)).href);
const env = { RESUME_BACKEND_URL: 'https://backend.example.run.app', RESUME_PROXY_SECRET: 'synthetic-secret' };

function captureFetch(t) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url: String(url), init }); return new Response('ok'); });
  return calls;
}

test('build publishes public files only', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build-pages.cjs')], { stdio: 'pipe' });
  const dist = path.join(root, 'dist');
  try {
    for (const f of ['index.html', 'jobs.html', 'admin.html', 'js/auth-modal.js', 'css/mobile.css', 'supabase-config.js', '_headers', 'placements-atlas.webp', 'img/placed-companies/tcs.webp'])
      assert.ok(fs.existsSync(path.join(dist, f)), `missing ${f}`);
    for (const f of ['server.js', 'supabase_schema.sql', 'migrations', 'tests', 'scripts', 'functions', 'Resume', '.htaccess', '.git', '.gitignore', 'package.json'])
      assert.ok(!fs.existsSync(path.join(dist, f)), `must not publish ${f}`);
  } finally { fs.rmSync(dist, { recursive: true, force: true }); }
});

test('api proxy forwards to Cloud Run with the secret and the real client IP only', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('api/[[path]].js');
  const request = new Request('https://kompetenzen.in/api/templates?limit=2', { method: 'POST', body: '{"a":1}',
    headers: { 'content-type': 'application/json', authorization: 'Bearer user-token', cookie: 'other=1', 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6', 'x-proxy-secret': 'forged' } });
  await onRequest({ request, env });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://backend.example.run.app/api/templates?limit=2');
  const h = calls[0].init.headers;
  assert.equal(h.get('x-proxy-secret'), 'synthetic-secret');
  assert.equal(h.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(h.get('authorization'), 'Bearer user-token');
  assert.equal(h.get('cookie'), null);
  assert.equal(calls[0].init.method, 'POST');
});

test('api proxy refuses to run unconfigured', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('api/[[path]].js');
  const res = await onRequest({ request: new Request('https://kompetenzen.in/api/x'), env: {} });
  assert.equal(res.status, 503); assert.equal(calls.length, 0);
});

test('supabase proxy forwards /sb/* to the project with the real client IP only', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('sb/[[path]].js');
  const request = new Request('https://kompetenzen.in/sb/functions/v1/whatsapp-otp?x=1', { method: 'POST', body: '{"phone":"+919876543210"}',
    headers: { 'content-type': 'application/json', apikey: 'anon', origin: 'https://kompetenzen.in', cookie: 'other=1', 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '6.6.6.6' } });
  await onRequest({ request });
  assert.equal(calls[0].url, 'https://lmimmujaqznybtcinwdo.supabase.co/functions/v1/whatsapp-otp?x=1');
  const h = calls[0].init.headers;
  assert.equal(h.get('x-forwarded-for'), '203.0.113.7');
  assert.equal(h.get('apikey'), 'anon');
  assert.equal(h.get('origin'), 'https://kompetenzen.in');
  assert.equal(h.get('cookie'), null);
  assert.equal(calls[0].init.redirect, 'manual');
});

test('supabase proxy only reaches the public Supabase APIs', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('sb/[[path]].js');
  for (const p of ['/sb/', '/sb/pg/query', '/sb/rest/v1/../../pg', '/sb//attacker.invalid/x', '/sb/auth/v1/../../admin'])
    assert.equal((await onRequest({ request: new Request('https://kompetenzen.in' + p) })).status, 404, p);
  assert.equal(calls.length, 0);
});

test('Resume pages map /Resume/* onto the backend and are read-only', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('Resume/[[path]].js');
  await onRequest({ request: new Request('https://kompetenzen.in/Resume/frontend/app.js?v=63'), env });
  assert.equal(calls[0].url, 'https://backend.example.run.app/frontend/app.js?v=63');
  // Clean address: /Resume and the old /Resume/resume.html go to /Resume/, keeping the query string
  for (const [from, to] of [['/Resume', '/Resume/'], ['/Resume/resume.html', '/Resume/'], ['/Resume/resume.html?resume=abc&view=x', '/Resume/?resume=abc&view=x']]) {
    const moved = await onRequest({ request: new Request('https://kompetenzen.in' + from), env });
    assert.equal(moved.status, 301, from); assert.equal(moved.headers.get('location'), 'https://kompetenzen.in' + to, from);
  }
  const post = await onRequest({ request: new Request('https://kompetenzen.in/Resume/frontend/app.js', { method: 'POST' }), env });
  assert.equal(post.status, 405); assert.equal(calls.length, 1);
});

test('the Resume Builder home is served at /Resume/ with the shared site bar added once', async t => {
  const page = '<html><head><title>x</title></head><body><section id="landing-view" class="view"><nav class="glass-nav"></nav></section></body></html>';
  let body = page;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url: String(url), init }); return new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': String(body.length) } }); });
  const { onRequest } = await fn('Resume/[[path]].js');
  const home = await onRequest({ request: new Request('https://kompetenzen.in/Resume/?resume=abc'), env });
  assert.equal(calls[0].url, 'https://backend.example.run.app/resume.html?resume=abc');
  assert.equal(home.status, 200); assert.equal(home.headers.get('content-length'), null);
  const html = await home.text();
  assert.equal(html.split('/js/site-nav.js').length - 1, 1, 'bar added exactly once');
  assert.match(html, /<section id="landing-view" class="view"><script src="\/js\/site-nav\.js" data-base="\/" data-active="Resume\/"/);
  assert.match(html, /<style id="kz-site-bar">[^<]*<\/style><\/head>/);
  // A page that already includes the bar (a future builder deploy) is left as it is
  body = page.replace('<nav', '<script src="../js/site-nav.js"></script><nav');
  const already = await (await onRequest({ request: new Request('https://kompetenzen.in/Resume/'), env })).text();
  assert.equal(already, body);
  // Files and HEAD requests pass through untouched
  body = 'console.log(1)';
  const js = await onRequest({ request: new Request('https://kompetenzen.in/Resume/frontend/app.js'), env });
  assert.equal(await js.text(), 'console.log(1)');
});

test('reel covers come from Instagram, are edge-cacheable, and fail closed', async t => {
  const calls = [];
  let reply = () => new Response('jpeg-bytes', { headers: { 'Content-Type': 'image/jpeg' } });
  t.mock.method(globalThis, 'fetch', async url => { calls.push(String(url)); return reply(); });
  const { onRequest } = await fn('reel-cover/[id].js');
  const ok = await onRequest({ request: new Request('https://kompetenzen.in/reel-cover/DYZbuipRpnn'), params: { id: 'DYZbuipRpnn' } });
  assert.equal(calls[0], 'https://www.instagram.com/p/DYZbuipRpnn/media/?size=l');
  assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg');
  assert.match(ok.headers.get('cache-control'), /s-maxage=604800/);
  const bad = await onRequest({ request: new Request('https://kompetenzen.in/reel-cover/x'), params: { id: '../../x' } });
  assert.equal(bad.status, 404); assert.equal(calls.length, 1);
  reply = () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } });
  const notImage = await onRequest({ request: new Request('https://kompetenzen.in/reel-cover/DX1XSgJxTSv'), params: { id: 'DX1XSgJxTSv' } });
  assert.equal(notImage.status, 404); assert.equal(notImage.headers.get('cache-control'), 'no-store');
});

test('course pages find their published content under clean URLs', () => {
  const src = fs.readFileSync(path.join(root, 'js/site-content.js'), 'utf8');
  const key = p => p.split('/').pop().replace(/\.html$/, '') + '.html';
  assert.match(src, /replace\(\/\\\.html\$\/, ''\) \+ '\.html'/);
  assert.equal(key('/java-course-details'), 'java-course-details.html');
  assert.equal(key('/java-course-details.html'), 'java-course-details.html');
});
