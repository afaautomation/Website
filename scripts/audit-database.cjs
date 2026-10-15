// Read-only API schema audit. Prints names and types, never credentials or row data.
const fs = require('node:fs');
const path = require('node:path');
const envFile = path.join(__dirname, '..', 'Resume', 'backend', '.env');
const config = {};
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)\s*=\s*(.*?)\s*$/);
    if (match) config[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
async function main() {
  const url = process.env.SUPABASE_URL || config.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || config.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase audit configuration unavailable');
  const response = await fetch(new URL('/rest/v1/', url), {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/openapi+json' }
  });
  if (!response.ok) throw new Error(`Schema audit returned HTTP ${response.status}`);
  const spec = await response.json();
  console.log(JSON.stringify({
    tables: Object.fromEntries(Object.entries(spec.definitions || {}).map(([name, def]) => [name,
      Object.fromEntries(Object.entries(def.properties || {}).map(([column, prop]) => [column, prop.format || prop.type]))])),
    functions: Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/')).map(p => p.slice(5))
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
