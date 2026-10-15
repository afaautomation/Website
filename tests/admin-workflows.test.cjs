const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
// Git may check files out with CRLF on Windows; markers below use \n.
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const admin = read('admin.html');
const profile = read('create-profile.html');

test('three applicant sections query the selected job and preserve all status counts', async () => {
  const els = {};
  const element = id => els[id] ||= { value: '', textContent: '', disabled: false };
  const buttons = ['matched', 'all', 'not_matched'].map(status => ({ dataset: { applicantSection: status }, setAttribute(key, value) { this[key] = value; } }));
  const requests = [];
  const ctx = vm.createContext({ selectedJobId: 'job-one', OTHER_APPS: '__other__', matchingRequest: 0,
    matchingOffset: 25, allCandidateApplications: [], renderApplications: () => {}, filterApplications: () => {},
    document: { getElementById: element, querySelectorAll: () => buttons },
    supabaseClient: { rpc: async (name, args) => {
      requests.push({name, ...args});
      return { data: { rows: [], total: 0, counts: {matched: 2, not_matched: 1, needs_information: 3, pending: 1} }, error: null };
    } }
  });
  ctx.window = ctx;
  vm.runInContext(extract(admin, 'window.selectApplicantSection =', 'window.editMatchingRules ='), ctx);
  for (const status of ['matched', 'all', 'not_matched']) {
    element('apps-search-input').value = 'old search';
    await ctx.selectApplicantSection(status);
    const request = requests.at(-1);
    assert.equal(request.p_job_id, 'job-one');
    assert.equal(request.p_status, status);
    assert.equal(request.p_offset, 0);
    assert.equal(element('apps-search-input').value, '');
    assert.equal(buttons.find(b => b.dataset.applicantSection === status)['aria-pressed'], 'true');
  }
  assert.equal(element('all-section-count').textContent, 7);
  assert.equal(element('matched-section-count').textContent, 2);
  assert.equal(element('rejected-section-count').textContent, 1);
});
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
  assert.equal(JSON.stringify(payload.application_requirements), '{}');
  const req = { resume: true, college: false, availability: true, skills: false, portfolio: true, questions: ['Why?'] };
  await ctx.saveJobToCloud({ title: 'Intern', applicationRequirements: req });
  assert.equal(JSON.stringify(payload.application_requirements), JSON.stringify(req));
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
    confirm: () => true, alert: () => {}, document: { getElementById: () => null }, filterApplications: () => {}, loadApplicationsList: async () => {},
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
test('staff login has no public account creation or password-reset bypass', () => {
  assert.doesNotMatch(admin, /gate-signup|auth\.signUp|staff-signup|switchGateMode/);
  assert.match(admin, /resetPasswordForEmail/);
  assert.doesNotMatch(read('server.js'), /auth\.admin\.(createUser|updateUserById)/);
  assert.doesNotMatch(read('Resume/backend/src/controllers/authController.js'), /auth\.admin\.(createUser|updateUserById)/);
});
test('applicants are grouped under the job they applied to', () => {
  const els = {};
  const element = id => (els[id] = els[id] || { style: {}, value: '', innerHTML: '', textContent: '' });
  const ctx = vm.createContext({ document: { getElementById: element }, escapeHtml: s => String(s), clearAllFilters: () => {}, loadMatchingPage: async () => {} });
  ctx.window = ctx;
  vm.runInContext(extract(admin, 'let allCandidateApplications = [];', '// Tab switcher') +
    ';this.setData = (apps, jobs) => { allCandidateApplications = apps; hrJobs = jobs.map(j => ({...j, applicantCount: apps.filter(a => a.job_id === j.id).length})); overviewTotal = apps.length; overviewOther = apps.filter(a => !jobs.some(j => j.id === a.job_id)).length; };' +
    'this.appsForJob = appsForJob; this.current = currentJobApps;', ctx);
  ctx.setData(
    [{ id: 'a1', job_id: 'j1' }, { id: 'a2', job_id: 'j1' }, { id: 'a3', job_id: 'j2' }, { id: 'a4', job_id: null }, { id: 'a5', job_id: 'gone' }],
    [{ id: 'j1', title: 'Backend Engineer', company: 'Acme' }, { id: 'j2', title: 'HR Intern', jobType: 'internship' }]);
  assert.deepEqual(ctx.appsForJob('j1').map(a => a.id), ['a1', 'a2']);
  assert.deepEqual(ctx.appsForJob('__other__').map(a => a.id), ['a4', 'a5']);

  ctx.window.renderJobsOverview();
  let grid = els['apps-jobs-grid'].innerHTML;
  assert.match(grid, /💼 Jobs <span>1<\/span>[\s\S]*🎓 Internships <span>1<\/span>[\s\S]*📥 Other <span>2<\/span>/);
  assert.match(grid, /Backend Engineer[\s\S]*>2<small>applicants/);
  assert.doesNotMatch(grid, /HR Intern/);
  ctx.window.setJobsOverviewType('internship');
  grid = els['apps-jobs-grid'].innerHTML;
  assert.match(grid, /HR Intern[\s\S]*>1<small>applicant</);
  assert.doesNotMatch(grid, /Backend Engineer/);
  ctx.window.setJobsOverviewType('other');
  assert.match(els['apps-jobs-grid'].innerHTML, /Other applications[\s\S]*>2<small>applicants/);

  ctx.window.openJobApplicants('j2');
  assert.equal(els['apps-job-detail'].style.display, 'block');
  assert.equal(els['apps-job-title'].textContent, 'HR Intern');
  assert.deepEqual(ctx.current().map(a => a.id), ['a3']);
  ctx.window.showJobsList();
  assert.equal(ctx.current().length, 5);
});
