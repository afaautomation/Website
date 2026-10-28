const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\r\n/g, '\n');
// Shared by admin.html (HR) and marketing.html (Marketing).
const gate = read('js/staff-gate.js');
const flush = () => new Promise(resolve => setImmediate(resolve));
function elements() {
  const nodes = new Map();
  return id => {
    if (!nodes.has(id)) nodes.set(id, { value: '', hidden: true, style: {}, dataset: {}, textContent: '',
      classList: { add() {}, remove() {} }, replaceChildren() {}, reset() {}, reportValidity: () => true,
      addEventListener(event, fn) { this[event] = fn; }, querySelector() { return this; } });
    return nodes.get(id);
  };
}
function setupGate(rpc) {
  const get = elements(); let ready, authEvent, loads = 0;
  const context = { window: { location: { href: 'https://example.invalid/admin.html' }, loadApplicationsList() { loads++; } },
    document: { getElementById: get, addEventListener(event, fn) { ready = fn; } },
    allCandidateApplications: [], isSupabaseConfigured: () => true, URL, setTimeout,
    supabaseClient: { rpc, auth: {
      getSession: async () => ({ data: { session: { user: { id: 'test' } } } }),
      onAuthStateChange(fn) { authEvent = fn; }, signOut: async () => ({})
    } }
  };
  vm.runInNewContext(gate, context);
  return { get, context, ready: () => ready(), event: event => authEvent(event), loads: () => loads };
}
test('approved staff can open the console only after authorization succeeds', async () => {
  const env = setupGate(async () => ({ data: true })); env.ready(); await flush();
  assert.equal(env.get('admin-main').style.display, 'block'); assert.equal(env.loads(), 1);
});
test('authorization errors fail closed', async () => {
  const env = setupGate(async () => ({ error: new Error('Unavailable') })); env.ready(); await flush();
  assert.equal(env.get('admin-main').style.display, 'none'); assert.equal(env.loads(), 0);
});
test('sign-out during an authorization request cannot reopen the console', async () => {
  let finish;
  const env = setupGate(() => new Promise(resolve => { finish = resolve; })); env.ready(); await flush();
  env.event('SIGNED_OUT'); finish({ data: true }); await flush();
  assert.equal(env.get('admin-main').style.display, 'none'); assert.equal(env.loads(), 0);
});
test('recovery uses the fixed password page and hides account existence', async () => {
  const env = setupGate(async () => ({ data: false })); let options, calls = 0;
  env.context.supabaseClient.auth.resetPasswordForEmail = async (email, value) => { calls++; options = value; return {}; };
  env.get('gate-email').value = 'staff@example.invalid';
  await env.get('gate-forgot-password').click();
  assert.equal(options.redirectTo, 'https://example.invalid/admin-password.html');
  assert.match(env.get('gate-success').textContent, /If this email has an account/);
  await env.get('gate-forgot-password').click(); assert.equal(calls, 1);
});
test('backend ignores stale admin roles and metadata; approved verified accounts only', async () => {
  const source = read('Resume/backend/src/middleware/auth.js');
  const fn = source.slice(source.indexOf('async function buildUserContext('), source.indexOf('/**\n * Lightweight'));
  let approved = false, failure = false;
  const ctx = vm.createContext({ logger: { warn() {} }, supabase: { from(table) { return {
    select: () => ({ eq: () => ({ maybeSingle: async () => table === 'profiles'
      ? { data: { role: 'admin' } }
      : { data: approved ? { email: 'test@example.invalid' } : null, error: failure ? new Error('Unavailable') : null } }) })
  }; } } });
  vm.runInContext(fn, ctx);
  const user = { id: 'test', email: 'test@example.invalid', email_confirmed_at: '2026-01-01', user_metadata: { role: 'admin' } };
  assert.equal((await ctx.buildUserContext(user)).role, 'user');
  approved = true; assert.equal((await ctx.buildUserContext(user)).role, 'admin');
  assert.equal((await ctx.buildUserContext({ ...user, email_confirmed_at: null })).role, 'user');
  assert.equal((await ctx.buildUserContext({ ...user, banned_until: '2999-01-01' })).role, 'user');
  failure = true; assert.equal((await ctx.buildUserContext(user)).role, 'user');
});
async function passwordSetup(session = true) {
  const get = elements(); let saved, signouts = 0;
  const ctx = { document: { getElementById: get }, URLSearchParams, history: { replaceState() {} },
    window: { location: { hash: '', pathname: '/admin-password.html' } }, isSupabaseConfigured: () => true,
    supabaseClient: { auth: {
      getSession: async () => ({ data: { session: session ? { user: { id: 'test' } } : null } }),
      getUser: async () => ({ data: { user: { id: 'test' } } }),
      updateUser: async value => { saved = value; return {}; }, signOut: async () => { signouts++; return {}; }
    } }
  };
  await vm.runInNewContext(read('js/admin-password.js'), ctx);
  return { get, saved: () => saved, signouts: () => signouts };
}
test('expired invitation does not show a password form', async () => {
  const env = await passwordSetup(false);
  assert.equal(env.get('password-form').hidden, true);
  assert.match(env.get('password-message').textContent, /expired/);
});
test('password setup validates confirmation then saves through authenticated Auth', async () => {
  const env = await passwordSetup();
  env.get('new-password').value = 'a long test password'; env.get('confirm-password').value = 'different';
  await env.get('password-form').submit({ preventDefault() {} });
  assert.equal(env.saved(), undefined);
  env.get('confirm-password').value = 'a long test password';
  await env.get('password-form').submit({ preventDefault() {} });
  assert.equal(env.saved().password, 'a long test password'); assert.equal(env.signouts(), 1);
  assert.equal(env.get('password-form').hidden, true);
});
test('migration uses verified allowlist identities and blocks role self-promotion', () => {
  const sql = read('migrations/20261014_invite_only_admin.sql');
  assert.match(sql, /u.email_confirmed_at is not null/);
  assert.match(sql, /revoke all on public.staff_emails from public, anon, authenticated/);
  assert.match(sql, /new.role is distinct from old.role/);
  assert.doesNotMatch(sql, /%\@kompetenzen\.in|select lower\(u.email\)/);
});
test('local server retires staff signup without reading credentials or calling admin APIs', () => {
  let handler, status, body;
  vm.runInNewContext(read('server.js'), {
    __dirname: path.join(__dirname, '..'), console: { log() {} },
    require(name) {
      if (name === 'http') return { createServer(fn) { handler = fn; return { listen() {} }; } };
      if (name === 'fs') return fs;
      if (name === 'path') return path;
      throw new Error('Unexpected dependency: ' + name);
    }
  });
  handler({ method: 'POST', url: '/api/auth/staff-signup?test=1' }, {
    writeHead(code) { status = code; }, end(value) { body = JSON.parse(value); }
  });
  assert.equal(status, 410); assert.match(body.message, /invitation-only/);
});
