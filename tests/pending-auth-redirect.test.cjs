const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

// Loads supabase-config.js with a fake browser and Supabase client.
function load() {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k)
  };
  const oauthCalls = [];
  const client = { auth: { signInWithOAuth: async options => { oauthCalls.push(options); return { error: null }; } } };
  const context = vm.createContext({
    localStorage,
    window: { location: { href: 'https://example.test/index.html', hash: '', protocol: 'https:' } },
    supabase: { createClient: () => client },
    console, URLSearchParams, setTimeout, Date, JSON
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8'), context);
  return { context, store, oauthCalls };
}

const KEY = 'kompetenzen_pending_auth_redirect';
const APPLY_URL = 'job-details.html?id=42&apply=1';

test('a fresh sign-in redirect is returned once', () => {
  const { context } = load();
  context.savePendingAuthRedirect(APPLY_URL);
  assert.equal(context.takePendingAuthRedirect(), APPLY_URL);
  assert.equal(context.takePendingAuthRedirect(), null);
});

test('an abandoned sign-in redirect expires instead of starting an application later', () => {
  const { context, store } = load();
  store.set(KEY, JSON.stringify({ url: APPLY_URL, at: Date.now() - 31 * 60 * 1000 }));
  assert.equal(context.takePendingAuthRedirect(), null);
  assert.equal(store.has(KEY), false);
});

test('a redirect saved in the old plain-text format is discarded', () => {
  const { context, store } = load();
  store.set(KEY, APPLY_URL);
  assert.equal(context.takePendingAuthRedirect(), null);
  assert.equal(store.has(KEY), false);
});

test('a Google sign-in without a destination clears an earlier redirect', async () => {
  const { context, store, oauthCalls } = load();
  context.savePendingAuthRedirect(APPLY_URL);
  await context.supabaseSignInWithGoogle(null);
  assert.equal(store.has(KEY), false);
  assert.equal(oauthCalls.length, 1);
});

test('restoring a session reads the redirect through the expiring helper', () => {
  const source = fs.readFileSync(path.join(root, 'js/auth-modal.js'), 'utf8');
  assert.match(source, /window\._pendingAuthRedirect = typeof takePendingAuthRedirect === 'function' \? takePendingAuthRedirect\(\) : null;/);
  assert.doesNotMatch(source, /getItem\('kompetenzen_pending_auth_redirect'\)/);
  assert.match(source, /await supabaseSignOut\(\)/);
});
