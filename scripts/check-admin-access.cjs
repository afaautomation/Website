// Read-only diagnostic: never prints tokens, passwords or unrelated accounts.
const { getSupabaseAdmin } = require('./supabase-admin.cjs');
async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error('Provide the staff email to check.');
  for (const port of [3000, 8099]) {
    try {
      const res = await fetch(`http://localhost:${port}/admin.html`, { signal: AbortSignal.timeout(3000) });
      console.log(JSON.stringify({ port, status: res.status, inviteOnlyPage: (await res.text()).includes('gate-forgot-password') }));
    } catch { console.log(JSON.stringify({ port, reachable: false })); }
  }
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error('Diagnostic configuration unavailable.');
  const { data: staff, error } = await sb.from('staff_emails').select('email').eq('email', email).maybeSingle();
  if (error) throw new Error('Could not read staff approval list: ' + error.message);
  let user = null;
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error('Could not check account: ' + error.message);
    user = data.users.find(u => u.email?.toLowerCase() === email);
    if (user || data.users.length < 100) break;
  }
  console.log(JSON.stringify({ approved: !!staff, accountExists: !!user,
    emailVerified: !!user?.email_confirmed_at, providers: user?.app_metadata?.providers || [],
    banned: !!user?.banned_until && Date.parse(user.banned_until) > Date.now() }));
}
main().catch(err => { console.error(err.message); process.exitCode = 1; });
