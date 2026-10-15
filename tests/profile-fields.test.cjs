const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'create-profile.html'), 'utf8');
function extract(start, end) { return html.slice(html.indexOf(start), html.indexOf(end, html.indexOf(start))); }
function collect(stage, values) {
  const context = vm.createContext({
    state: { stage, challenges: [], years: '3–5 years' },
    val: id => values[id] || '',
    profileAnswer: id => values[id] === 'Other' ? values[id + '-other'] || '' : values[id] || '',
    $: () => ({ checked: false }), selectedTexts: () => [],
    collectCareerPreferences: () => ({ area: 'Technology & Data', field: 'Software Development' })
  });
  vm.runInContext(extract('function collectProfile()', '// ===== UPLOAD RESUME'), context);
  return context.collectProfile();
}
test('student collection includes college, stream, semester and graduation without leaking employment fields', () => {
  const profile = collect('studying', {'f-institution':'Test College','f-study-qualification':'B.Tech','f-study-specialisation':'Computer Science and Engineering','f-study-semester':'5','f-study-year':'2028','f-company-tenure':'1–2 years','f-industry':'Healthcare / Hospitals'});
  assert.equal(profile.semester, '5');
  assert.equal(profile.institution, 'Test College');
  assert.equal(profile.gradYear, '2028');
  assert.match(profile.degree, /Computer Science/);
  assert.equal(profile.companyTenure, undefined);
  assert.equal(Object.hasOwn(profile, 'preferredRoles'), false);
  assert.equal(profile.industry, '');
  assert.equal(profile.careerPreferences.field, 'Software Development');
});
test('graduate collection saves custom qualification and stream answers', () => {
  const profile = collect('graduated', {'f-grad-qualification':'Other','f-grad-qualification-other':'Custom qualification','f-grad-specialisation':'Other','f-grad-specialisation-other':'Custom stream','f-grad-year':'2025'});
  assert.equal(profile.qualification, 'Custom qualification');
  assert.equal(profile.specialisation, 'Custom stream');
  assert.equal(profile.semester, null);
});
test('experienced profiles collect total experience without company tenure', () => {
  const profile = collect('experienced', {'f-exp-qualification':'MBA','f-exp-specialisation':'Marketing','f-industry':'Other','f-industry-other':'Custom industry','f-recent-role':'Other','f-recent-role-other':'Custom role','f-company-tenure':'Less than 6 months'});
  assert.equal(profile.companyTenure, undefined);
  assert.equal(profile.experience, '3–5 years · Custom role');
  assert.equal(profile.industry, 'Custom industry');
  assert.equal(profile.specialisation, 'Marketing');
  assert.equal(profile.gradYear, '');
});
test('save payload persists new fields and clears fields from an earlier career stage', async () => {
  let saved;
  const context = vm.createContext({supabaseClient: { from: () => ({ upsert: async row => { saved = row; return { error: null }; } }) }});
  vm.runInContext(extract('async function saveCandidateProfile', '// ===== MARK JOB APPLIED'), context);
  await context.saveCandidateProfile('test-user', { semester: '5', companyTenure: '', specialisation: 'Computer Science' });
  assert.equal(saved.semester, '5');
  assert.equal(Object.hasOwn(saved, 'company_tenure'), false);
  assert.equal(Object.hasOwn(saved, 'preferred_roles'), false);
  await context.saveCandidateProfile('test-user', { semester: null, companyTenure: '1–2 years' });
  assert.equal(saved.semester, null);
  assert.equal(Object.hasOwn(saved, 'company_tenure'), false);
});
test('all catalogue courses have stream families and bundled scripts parse', () => {
  const context = vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(root,'js/profile-options.js'),'utf8'),context);
  const catalogue = context.window.PROFILE_OPTIONS;
  for (const [name, family, semesters] of catalogue.courses) {
    assert.ok(catalogue.streams[family]?.length, name);
    assert.ok(semesters > 0 && semesters <= 12, name);
  }
  for (const file of ['profile-fields.js','kerala-colleges.js','career-preferences.js']) assert.doesNotThrow(() => new vm.Script(fs.readFileSync(path.join(root,'js',file),'utf8')));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Form IDs must be unique');
});

test('career preferences save stable choice codes and displayed offer order', async () => {
  let saved;
  const context = vm.createContext({supabaseClient: { from: () => ({ upsert: async row => { saved = row; return { error: null }; } }) }});
  vm.runInContext(extract('async function saveCandidateProfile', '// ===== MARK JOB APPLIED'), context);
  const preferences = {area:'Technology & Data',field:'Data Analytics',skills:['Excel','SQL'],softSkills:['Communication'],experience:'practising',offerPreference:'growth_first',offerOrder:['learn_first','security_first','earn_first','growth_first']};
  await context.saveCandidateProfile('test-user', {careerPreferences:preferences});
  assert.deepEqual(saved.career_preferences, preferences);
});
