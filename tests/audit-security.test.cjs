const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.join(__dirname, '..');
const env = { RESUME_BACKEND_URL: 'https://backend.example.run.app', RESUME_PROXY_SECRET: 'synthetic-secret' };
const proxy = () => import(pathToFileURL(path.join(root, 'functions/Resume/[[path]].js')).href);

test('Resume proxy never forwards credentials to a host supplied in the path', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, init) => { calls.push({ url: String(url), init }); return new Response('ok'); });
  const { onRequest } = await proxy();
  for (const suffix of ['//attacker.invalid/collect', '/%2f%2fattacker.invalid/collect', '/\\attacker.invalid/collect']) {
    const response = await onRequest({ request: new Request('https://kompetenzen.in/Resume' + suffix), env });
    assert.ok([200,400,404].includes(response.status));
  }
  assert.ok(calls.every(c => new URL(c.url).origin === env.RESUME_BACKEND_URL));
});

test('proxy returns controlled errors and never caches authenticated responses', async t => {
  const { onRequest } = await proxy();
  const request = new Request('https://kompetenzen.in/Resume/resume.html', {headers:{authorization:'Bearer synthetic-token'}});
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private upstream details'); });
  const failed = await onRequest({ request, env });
  assert.equal(failed.status,502);
  assert.ok(!(await failed.text()).includes('private upstream details'));
  t.mock.method(globalThis, 'fetch', async () => new Response('ok'));
  const success = await onRequest({request,env});
  assert.match(success.headers.get('cache-control'),/no-store/);
});
