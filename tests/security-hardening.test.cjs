const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('sign-in redirects accept only pages of this website', () => {
  const context = vm.createContext({
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { location: { href: 'https://kompetenzen.in/jobs.html', origin: 'https://kompetenzen.in', hash: '', protocol: 'https:', pathname: '/jobs.html' } },
    console, URLSearchParams, setTimeout, Date, JSON
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'supabase-config.js'), 'utf8'), context);
  const safe = context.safeAuthRedirect;
  for (const ok of ['job-details.html?id=42&apply=1', 'internship-profile.html', '/Resume/', 'https://kompetenzen.in/jobs.html#x']) {
    assert.equal(safe(ok), ok);
  }
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', ' javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x',
    'https://evil.example/kompetenzen.in', 'https://kompetenzen.in.evil.example/', '//evil.example', '\\\\evil.example', 'vbscript:x', '', null, 42]) {
    assert.equal(safe(bad), null, String(bad));
  }
  const modal = fs.readFileSync(path.join(root, 'js/auth-modal.js'), 'utf8');
  assert.match(modal, /redirectUrl = typeof safeAuthRedirect === 'function' \? safeAuthRedirect\(redirectUrl\) : null;/);
  assert.doesNotMatch(modal, /window\.location\.href = redirect;/);
  assert.doesNotMatch(modal, /window\.open\(redirect/);
});

test('applicant CSV export neutralises spreadsheet formulas', () => {
  const admin = fs.readFileSync(path.join(root, 'admin.html'), 'utf8');
  const source = admin.match(/const cell = value => \{[\s\S]*?\n      \};/)[0];
  const cell = vm.runInNewContext(source + '; cell');
  assert.equal(cell('=HYPERLINK("http://x","y")'), '"\'=HYPERLINK(""http://x"",""y"")"');
  assert.equal(cell('@SUM(1)'), '"\'@SUM(1)"');
  assert.equal(cell('Asha "A" Nair'), '"Asha ""A"" Nair"');
  assert.equal(cell(undefined), '""');
});

test('security hardening migration limits resume storage and resume links', async () => {
  // Optional local test dependency; installation instructions are in migrations/README.md.
  const { PGlite } = require(process.env.PGLITE_MODULE || '../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select false$$;`);
    const schema = fs.readFileSync(path.join(root, 'supabase_schema.sql'), 'utf8');
    for (const name of ['resume_templates', 'resumes', 'resume_versions', 'import_jobs', 'candidate_profiles']) {
      await db.exec(schema.match(new RegExp('create table if not exists public\\.' + name + ' \\([\\s\\S]*?\\n\\);'))[0]);
    }
    await db.exec(`alter table public.resumes enable row level security;
      create policy "Public can view public resumes" on public.resumes for select using (is_public = true);`);
    const migration = fs.readFileSync(path.join(root, 'migrations/20261116_security_hardening.sql'), 'utf8');
    await db.exec(migration);
    await db.exec(migration); // rerunnable

    const policies = await db.query(`select policyname from pg_policies where tablename = 'resumes'`);
    assert.deepEqual(policies.rows, []);

    const user = '11111111-1111-1111-1111-111111111111', other = '22222222-2222-2222-2222-222222222222';
    await db.exec(`insert into auth.users(id) values ('${user}'), ('${other}')`);
    await db.exec(`insert into public.resumes(user_id, title) select '${user}', 'r' || g from generate_series(1, 100) g`);
    await assert.rejects(db.exec(`insert into public.resumes(user_id) values ('${user}')`), /up to 100 resumes/);
    await db.exec(`insert into public.resumes(user_id) values ('${other}')`);
    await assert.rejects(db.exec(`update public.resumes set title = repeat('x', 201) where user_id = '${other}'`), /resumes_size_check/);
    await assert.rejects(db.exec(`update public.resumes set content = jsonb_build_object('a', repeat('x', 1000001)) where user_id = '${other}'`), /resumes_size_check/);

    const resume = (await db.query(`select id from public.resumes where user_id = '${other}'`)).rows[0].id;
    await db.exec(`insert into public.resume_versions(resume_id, version_num, snapshot) select '${resume}', g, '{}' from generate_series(1, 60) g`);
    const versions = await db.query(`select count(*)::int n, min(version_num) oldest from public.resume_versions where resume_id = '${resume}'`);
    assert.deepEqual(versions.rows[0], { n: 50, oldest: 11 });

    await db.exec(`insert into public.import_jobs(user_id, source_type, created_at) select '${user}', 'image/png', now() + g * interval '1 second' from generate_series(1, 25) g`);
    assert.equal((await db.query(`select count(*)::int n from public.import_jobs`)).rows[0].n, 20);

    const profile = url => `insert into public.candidate_profiles(user_id, name, whatsapp, resume_url) values ('${user}', 'A', '9', ${url})
      on conflict (user_id) do update set resume_url = excluded.resume_url`;
    await db.exec(profile(`'applications/Asha_1731753600000.pdf'`));
    await db.exec(profile(`'${user}/resume.pdf'`));
    await db.exec(profile('null'));
    for (const bad of [`'${other}/resume.pdf'`, `'applications/../${other}/resume.pdf'`, `'applications/a/b.pdf'`, `'https://evil.example/x.pdf'`]) {
      await assert.rejects(db.exec(profile(bad)), /Invalid resume file reference/, bad);
    }
    // A row saved before the rule keeps saving while its link is unchanged.
    await db.exec(`alter table public.candidate_profiles disable trigger guard_candidate_resume_url;
      update public.candidate_profiles set resume_url = 'legacy/path.pdf';
      alter table public.candidate_profiles enable trigger guard_candidate_resume_url;
      update public.candidate_profiles set name = 'B';`);
  } finally {
    await db.close();
  }
});
