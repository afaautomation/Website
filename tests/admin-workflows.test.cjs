const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'create-profile.html'), 'utf8');
function extract(source, from, to) {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, 'Source function found');
  return source.slice(start, end);
}
test('job publishing preserves all details and rejects a failed database save', async () => {
  let payload, fail = false;
  const ctx = vm.createContext({ isSupabaseConfigured: () => true, supabaseClient: { from: () => ({ insert: async rows => {
    payload = rows[0]; return { error: fail ? new Error('Denied') : null };
  } }) } });
  vm.runInContext(extract(admin, 'async function saveJobToCloud', 'async function deleteJobFromCloud'), ctx);
  await ctx.saveJobToCloud({ title: 'Engineer', responsibilities: 'Build', requirements: 'Skills', aboutCompany: 'Company' });
  assert.equal(payload.responsibilities, 'Build'); assert.equal(payload.requirements, 'Skills'); assert.equal(payload.about_company, 'Company');
  fail = true; await assert.rejects(ctx.saveJobToCloud({}), /Denied/);
});
test('student No is false, while Yes and boolean true are true', async () => {
  let row;
  const ctx = vm.createContext({ supabaseClient: { from: () => ({ upsert: async value => { row = value; return { error: null }; } }) } });
  vm.runInContext(extract(profile, 'async function saveCandidateProfile', '// ===== MARK JOB APPLIED'), ctx);
  for (const [input, expected] of [['No', false], [false, false], ['Yes', true], [true, true]]) {
    await ctx.saveCandidateProfile('synthetic', { isStudent: input }); assert.equal(row.is_student, expected);
  }
});
test('application deletion uses the selected ID and keeps the UI unchanged on failure', async () => {
  let field, value, fail = true;
  const ctx = vm.createContext({ window: {}, allCandidateApplications: [{ id: 'one', email: 'same@example.invalid' }, { id: 'two', email: 'same@example.invalid' }],
    confirm: () => true, alert: () => {}, document: { getElementById: () => null }, filterApplications: () => {},
    supabaseClient: { from: () => ({ delete: () => ({ eq: (key, id) => { field = key; value = id; return { select: async () => ({ error: fail ? new Error('Denied') : null, data: fail ? null : [{ id }] }) }; } }) }) } });
  vm.runInContext(extract(admin, 'window.handleDeleteApp =', '// ===== JOB MATCHING'), ctx);
  await ctx.window.handleDeleteApp('one'); assert.equal(field, 'id'); assert.equal(value, 'one'); assert.equal(ctx.allCandidateApplications.length, 2);
  fail = false; await ctx.window.handleDeleteApp('one'); assert.equal(ctx.allCandidateApplications.length, 1); assert.equal(ctx.allCandidateApplications[0].id, 'two');
});
test('an empty job database replaces stale browser listings', async () => {
  let cached;
  const ctx = vm.createContext({ isSupabaseConfigured: () => true, supabaseClient: { rpc: async () => ({ data: [], error: null }) },
    STORE_KEY: 'jobs', localStorage: { setItem: (key, value) => { cached = value; } }, loadLocal: () => [{ id: 'stale' }] });
  vm.runInContext(extract(admin, 'async function loadJobs()', 'function loadLocal()'), ctx);
  assert.equal((await ctx.loadJobs()).length, 0); assert.equal(cached, '[]');
});
test('browser scripts compile', () => {
  for (const file of fs.readdirSync(root).filter(name => name.endsWith('.html'))) {
    for (const match of fs.readFileSync(path.join(root, file), 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/src\s*=|application\/ld\+json|type\s*=\s*["']module/.test(match[1])) continue;
      assert.doesNotThrow(() => new vm.Script(match[2], { filename: file }));
    }
  }
  assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root, 'js/site-content.js'), 'utf8')));
});
test('reel replacement uses one database transaction and does not cache a failed save', async () => {
  let cached = false, rpcName, fail = true;
  const ctx = vm.createContext({ isSupabaseConfigured: () => true, alert: () => {},
    supabaseClient: { rpc: async (name, args) => { rpcName = name; assert.equal(args.p_reels[0], 'ABCDEF'); return { error: fail ? new Error('Denied') : null }; } },
    localStorage: { setItem: () => { cached = true; } }, STORE_KEY: 'reels', showSaveStatus: () => {}, updateCounter: () => {} });
  vm.runInContext(extract(admin, 'async function save(reels)', 'function showSaveStatus()'), ctx);
  await assert.rejects(ctx.save(['ABCDEF']), /Denied/); assert.equal(cached, false); assert.equal(rpcName, 'replace_reels');
  fail = false; await ctx.save(['ABCDEF']); assert.equal(cached, true);
});
test('published content failures preserve the existing browser cache', async () => {
  let cached = false;
  const ctx = vm.createContext({ window: {}, document: { addEventListener: () => {} }, isSupabaseConfigured: () => true,
    supabaseClient: { from: () => ({ upsert: async () => ({ error: new Error('Denied') }) }) },
    localStorage: { setItem: () => { cached = true; } } });
  vm.runInContext(fs.readFileSync(path.join(root, 'js/site-content.js'), 'utf8'), ctx);
  await assert.rejects(ctx.window.siteContent.save('kompetenzen_batch_dates', {}), /Denied/); assert.equal(cached, false);
});
test('a signed-in non-admin cannot unlock the staff page', async () => {
  const elements = new Map();
  const element = id => { if (!elements.has(id)) elements.set(id, { style: {}, value: '', replaceChildren() {}, addEventListener() {}, classList: { add() {} } }); return elements.get(id); };
  let onReady, loads = 0;
  const ctx = vm.createContext({ window: { loadApplicationsList: () => { loads++; } }, allCandidateApplications: [],
    document: { getElementById: element, addEventListener: (event, fn) => { onReady = fn; } },
    isSupabaseConfigured: () => true, supabaseClient: { auth: { getSession: async () => ({ data: { session: { user: { id: 'synthetic' } } } }), onAuthStateChange: () => {} }, rpc: async () => ({ data: false, error: null }) } });
  vm.runInContext(extract(admin, '// Staff authorization comes', '/* =============================================\n       CANDIDATE APPLICATIONS'), ctx);
  onReady(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(element('admin-main').style.display, 'none'); assert.equal(loads, 0);
  assert.match(element('gate-error').textContent, /does not have staff access/);
});
