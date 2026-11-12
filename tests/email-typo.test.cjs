const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Run only the typo helper from js/auth-modal.js (the rest of the file needs a browser).
const src = fs.readFileSync(require('node:path').join(__dirname, '../js/auth-modal.js'), 'utf8');
const block = src.slice(src.indexOf('// EMAIL-TYPO-START'), src.indexOf('// EMAIL-TYPO-END'));
const suggestEmailFix = new Function(block + '; return suggestEmailFix;')();

test('common email typos get a correction', () => {
  for (const [typed, fixed] of [
    ['smusthaqeem1@gmail.con', 'smusthaqeem1@gmail.com'],
    ['a@gmial.com', 'a@gmail.com'], ['a@gamil.com', 'a@gmail.com'], ['a@gmail.co', 'a@gmail.com'],
    ['a@gmail.cmo', 'a@gmail.com'], ['a@hotmial.com', 'a@hotmail.com'], ['a@yahoo.con', 'a@yahoo.com'],
    ['a@outlok.com', 'a@outlook.com'], ['a@company.con', 'a@company.com'],
  ]) assert.equal(suggestEmailFix(typed), fixed, typed);
});

test('real addresses are never changed', () => {
  for (const ok of ['a@gmail.com', 'a@kompetenzen.in', 'a@mail.com', 'a@ymail.com', 'a@yahoo.co.in',
    'a@company.co', 'a@business.om', 'a@school.cm', 'a@gmx.com', 'a@college.edu', 'a@firm.co.uk'])
    assert.equal(suggestEmailFix(ok), '', ok);
});
