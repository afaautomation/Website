const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const pages = { 'course-details.html': 'python', 'java-course-details.html': 'java', 'data-analytics-course-details.html': 'analytics', 'hr-course-details.html': 'hr', 'sales-engineering-course-details.html': 'sales' };

function el(tag) { return { tag, hidden: false, children: [], className: '', append(...c) { this.children.push(...c); }, replaceChildren() { this.children = []; } }; }

async function render(page, students) {
  const section = el('section'); section.hidden = true; const container = el('div');
  let ready;
  const document = {
    querySelectorAll: () => [],
    getElementById: id => ({ 'placed-students-section': section, 'placed-students-container': container })[id] || null,
    createElement: el,
    addEventListener: (_, fn) => { ready = fn; }
  };
  const ctx = { document, location: { href: 'https://kompetenzentech.com/' + page.replace('.html', ''), pathname: '/' + page.replace('.html', '') }, URL, console,
    isSupabaseConfigured: () => true, localStorage: {} };
  ctx.window = ctx;
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/site-content.js'), 'utf8'), ctx);
  ctx.siteContent.read = async (key, fallback) => key === 'kompetenzen_placed_students' ? students : fallback;
  await ready();
  return { section, container };
}

test('course pages ship no sample students and keep the section hidden', () => {
  for (const page of Object.keys(pages)) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(html, /<section class="content-section" id="placed-students-section" hidden>/, page);
    assert.match(html, /<div class="placed-students-grid" id="placed-students-container"><\/div>/, page);
    assert.doesNotMatch(html, /class="student-card"/, page);
  }
});

test('the section appears only for students with an uploaded photo', async () => {
  const uploaded = { course: 'hr', name: 'Real Person', role: 'HR', company: 'Acme', photo: 'https://x.supabase.co/storage/v1/object/public/site-media/students/a.webp', photoPath: 'students/a.webp' };
  const placeholder = { course: 'hr', name: 'No Photo', role: 'HR', company: 'Acme', photo: 'student_python.webp' };
  let r = await render('hr-course-details.html', [placeholder, { ...uploaded, course: 'java' }]);
  assert.equal(r.section.hidden, true); assert.equal(r.container.children.length, 0);
  r = await render('hr-course-details.html', [placeholder, uploaded]);
  assert.equal(r.section.hidden, false); assert.equal(r.container.children.length, 1);
  assert.equal(r.container.children[0].children[0].className, 'student-photo-frame', 'photo sits in the large frame');
  assert.equal(r.container.children[0].children[1].textContent, 'Real Person');
});
