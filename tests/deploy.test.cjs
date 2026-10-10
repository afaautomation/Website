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
    for (const f of ['index.html', 'jobs.html', 'admin.html', 'js/auth-modal.js', 'css/mobile.css', 'supabase-config.js', 'firebase-config.js', '_headers', 'tech.webp'])
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

test('Resume pages map /Resume/* onto the backend and are read-only', async t => {
  const calls = captureFetch(t);
  const { onRequest } = await fn('Resume/[[path]].js');
  await onRequest({ request: new Request('https://kompetenzen.in/Resume/frontend/app.js?v=63'), env });
  assert.equal(calls[0].url, 'https://backend.example.run.app/frontend/app.js?v=63');
  const home = await onRequest({ request: new Request('https://kompetenzen.in/Resume/'), env });
  assert.equal(home.status, 302); assert.equal(home.headers.get('location'), 'https://kompetenzen.in/Resume/resume.html');
  const post = await onRequest({ request: new Request('https://kompetenzen.in/Resume/resume.html', { method: 'POST' }), env });
  assert.equal(post.status, 405); assert.equal(calls.length, 1);
});

test('course pages find their published content under clean URLs', () => {
  const src = fs.readFileSync(path.join(root, 'js/site-content.js'), 'utf8');
  const key = p => p.split('/').pop().replace(/\.html$/, '') + '.html';
  assert.match(src, /replace\(\/\\\.html\$\/, ''\) \+ '\.html'/);
  assert.equal(key('/java-course-details'), 'java-course-details.html');
  assert.equal(key('/java-course-details.html'), 'java-course-details.html');
});
