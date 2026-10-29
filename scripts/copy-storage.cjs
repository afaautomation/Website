// Copies every Storage file from the old Supabase project to the new one (bucket by bucket).
// Run after the database restore, which already created the buckets and file records.
// Keys come from environment variables and are never printed:
//   OLD_SUPABASE_URL, OLD_SERVICE_KEY, NEW_SUPABASE_URL, NEW_SERVICE_KEY
// Usage: node scripts/copy-storage.cjs resumes site-media
const env = name => {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} first.`);
  return value.replace(/\/$/, '');
};
const OLD = { url: env('OLD_SUPABASE_URL'), key: env('OLD_SERVICE_KEY') };
const NEW = { url: env('NEW_SUPABASE_URL'), key: env('NEW_SERVICE_KEY') };
const buckets = process.argv.slice(2);
if (!buckets.length) throw new Error('Name the buckets to copy, e.g. resumes site-media');

const headers = (key, extra = {}) => ({ apikey: key, Authorization: `Bearer ${key}`, ...extra });
const encodePath = path => path.split('/').map(encodeURIComponent).join('/');

// Folders come back without an id; walk into them.
async function list(project, bucket, prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 100) {
    const res = await fetch(`${project.url}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: headers(project.key, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefix, limit: 100, offset })
    });
    if (!res.ok) throw new Error(`Listing ${bucket}/${prefix} failed: ${res.status}`);
    const items = await res.json();
    for (const item of items) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...await list(project, bucket, path));
      else files.push({ path, type: (item.metadata && item.metadata.mimetype) || 'application/octet-stream' });
    }
    if (items.length < 100) return files;
  }
}

(async () => {
  for (const bucket of buckets) {
    const files = await list(OLD, bucket);
    let copied = 0;
    for (const file of files) {
      const down = await fetch(`${OLD.url}/storage/v1/object/${bucket}/${encodePath(file.path)}`, { headers: headers(OLD.key) });
      if (!down.ok) throw new Error(`Download ${bucket}/${file.path} failed: ${down.status}`);
      const body = Buffer.from(await down.arrayBuffer());
      const up = await fetch(`${NEW.url}/storage/v1/object/${bucket}/${encodePath(file.path)}`, {
        method: 'POST',
        headers: headers(NEW.key, { 'Content-Type': file.type, 'x-upsert': 'true', 'cache-control': 'max-age=31536000' }),
        body
      });
      if (!up.ok) throw new Error(`Upload ${bucket}/${file.path} failed: ${up.status} ${await up.text()}`);
      copied++;
    }
    console.log(`${bucket}: copied ${copied} of ${files.length} files`);
  }
})().catch(err => { console.error(err.message); process.exit(1); });
