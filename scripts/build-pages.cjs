// Builds the Cloudflare Pages output (dist/) from an allowlist of public files.
// Anything not listed here (schema, migrations, tests, dev server, Resume/ backend,
// notes) is never published. Cloudflare build command: node scripts/build-pages.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const PUBLIC_EXT = /\.(html|webp|png|jpe?g|ico|svg|mp4|pdf)$/i;
const PUBLIC_FILES = ['supabase-config.js', '_headers', '_redirects'];
const PUBLIC_DIRS = ['css', 'js', 'img'];

// Assets are not committed to Git; every build verifies the pinned model hashes
// and bundles the browser runtime before publishing the staff console.
require('child_process').execFileSync(process.execPath, [path.join(__dirname, 'setup-local-ai.cjs')], { stdio: 'inherit' });
if (path.dirname(OUT) !== ROOT || path.basename(OUT) !== 'dist') throw Error('Unsafe build output path');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);

const copied = [];
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.isFile() && (PUBLIC_EXT.test(entry.name) || PUBLIC_FILES.includes(entry.name))) {
    fs.copyFileSync(path.join(ROOT, entry.name), path.join(OUT, entry.name));
    copied.push(entry.name);
  }
}
for (const dir of PUBLIC_DIRS) {
  fs.cpSync(path.join(ROOT, dir), path.join(OUT, dir), { recursive: true });
  copied.push(dir + '/');
}

for (const name of PUBLIC_FILES) {
  if (!fs.existsSync(path.join(OUT, name))) throw new Error(`Missing required file: ${name}`);
}

// A Git LFS pointer instead of the real file would publish a broken image.
const LFS_POINTER = 'version https://git-lfs.github.com/spec/v1';
(function checkPointers(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { checkPointers(p); continue; }
    const head = Buffer.alloc(LFS_POINTER.length);
    const fd = fs.openSync(p, 'r'); fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd);
    if (head.toString() === LFS_POINTER) throw new Error(`${path.relative(OUT, p)} is a Git LFS pointer, not the real file`);
  }
})(OUT);
console.log(`Published ${copied.length} entries to dist/:\n  ` + copied.sort().join('\n  '));
