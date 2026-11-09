const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'job-details.html'), 'utf8');

test('job page shows the skills HR ticked in the matching rules, with readable names', () => {
  const window = {};
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/career-catalog.js'), 'utf8'), { window, globalThis: window });
  const start = page.indexOf('const SKILL_ACRONYMS'), end = page.indexOf('function escapeHtml', start);
  assert.ok(start > 0 && end > start, 'naming helper found');
  const ctx = vm.createContext({ window });
  vm.runInContext(page.slice(start, end) + ';this.name = skillDisplayName;', ctx);
  // Catalog skills keep the catalog spelling; typed-in ones are capitalised with acronyms upper-cased
  assert.equal(ctx.name('it troubleshooting'), 'IT Troubleshooting');
  assert.equal(ctx.name('problem-solving'), 'Problem-solving');
  assert.equal(ctx.name('aws'), 'AWS');
  assert.equal(ctx.name('api gateway'), 'API Gateway');
  assert.equal(ctx.name('ci/cd pipelines'), 'CI/CD Pipelines');
  assert.equal(ctx.name('kubernetes'), 'Kubernetes');
  assert.equal(ctx.name('TensorFlow'), 'TensorFlow', 'casing HR typed is kept');
  // The made-up fallback chips are gone and an empty listing hides the section
  assert.doesNotMatch(page, /Professional Excellence|Team Collaboration/);
  assert.match(page, /const technical = listed\.length \? listed : ruled\('skills'\);/);
  assert.match(page, /card-skills'\)\.style\.display = technical\.length \|\| soft\.length \? '' : 'none'/);
  assert.match(page, /<script src="js\/career-catalog\.js"><\/script>/);
});
