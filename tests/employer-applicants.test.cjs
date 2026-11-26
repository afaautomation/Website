const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('companies see only their own applicants, with score filters, and contact details only after shortlisting', async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE || '../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  const as = async (uid, role = 'authenticated', admin = false) => {
    await db.exec(`reset role; set test.uid = '${uid || ''}'; set test.admin = '${admin}'; set role ${role}`);
  };
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
  const U1 = '00000000-0000-0000-0000-000000000001', U2 = '00000000-0000-0000-0000-000000000002', ADM = '00000000-0000-0000-0000-0000000000ad';
  const fails = (promise, pattern) => assert.rejects(promise, pattern);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key, email text, email_confirmed_at timestamptz, banned_until timestamptz);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false') = 'true'$$;
      create schema storage;
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      create function storage.foldername(n text) returns text[] language sql immutable as $$select (string_to_array(n,'/'))[1:cardinality(string_to_array(n,'/'))-1]$$;
      alter table storage.objects enable row level security;
      grant usage on schema public, storage to anon, authenticated;`);
    const schema = fs.readFileSync('supabase_schema.sql', 'utf8');
    for (const name of ['hr_jobs', 'job_applications']) {
      await db.exec(schema.match(new RegExp('create table if not exists public\\.' + name + ' \\([\\s\\S]*?\\n\\);'))[0]);
    }
    await db.exec(`alter table public.job_applications add column user_id uuid, add column job_id uuid, add column college text,
        add column availability text, add column portfolio_url text, add column matched_skills text[] not null default '{}',
        add column screening_answers jsonb not null default '[]', add column expected_salary text, add column current_location text,
        add column match_result jsonb not null default '{"status":"pending"}';
      alter table public.job_applications enable row level security;
      create policy "Admins can view applications" on public.job_applications for select using (public.is_admin());
      grant select on public.job_applications to authenticated;
      alter table public.hr_jobs add column application_requirements jsonb not null default '{}';
      alter table public.hr_jobs enable row level security;
      create policy "Admins can manage jobs" on public.hr_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
      create policy "Admins can view all jobs" on public.hr_jobs for select to authenticated using (public.is_admin());
      grant select, insert, update, delete on public.hr_jobs to anon, authenticated;`);
    await db.exec(fs.readFileSync('migrations/20261103_listing_expiry.sql', 'utf8'));
    await db.exec(fs.readFileSync('migrations/20261124_employer_portal.sql', 'utf8'));
    const second = fs.readFileSync('migrations/20261125_employer_applicants.sql', 'utf8');
    await db.exec(second);
    await db.exec(second); // re-runnable
    await db.exec(`grant select on storage.objects to authenticated;
      insert into auth.users values ('${A}','a@acme.in',now(),null), ('${B}','b@beta.in',now(),null),
        ('${U1}','priya@mail.in',now(),null), ('${U2}','rahul@mail.in',now(),null), ('${ADM}','admin@k.in',now(),null);`);

    const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
    const job = (over = {}) => JSON.stringify({ title: 'Python Developer', category: 'tech', job_type: 'full-time', location: 'Kochi',
      description: 'Build and test features with our team of engineers.', expires_on: day(15), ...over });
    const register = async (uid, name) => {
      await as(uid);
      return (await db.query(`select public.employer_register($1,'https://x.in','IT','11-50','Kochi','About','Asha Menon','9876543210',null) as r`, [name])).rows[0].r.id;
    };
    const acme = await register(A, 'Acme Technologies'), beta = await register(B, 'Beta Works');
    await as(ADM, 'authenticated', true);
    for (const id of [acme, beta]) await db.query(`select public.admin_employer_review($1, 'approved')`, [id]);

    // Screening rules from a company are cleaned: unknown keys are dropped, markup is refused.
    await as(A);
    const rules = { version: 2, skills: [{ name: 'python', essential: true, importance: 5 }], softSkills: [],
      weights: { skills: 70, academics: 20, experience: 10 }, minimumMonths: 0, preferredMonths: 0, junk: 'drop me', source: 'evil' };
    const jobA = (await db.query('select public.employer_post_job($1) as id', [job({ matching: rules })])).rows[0].id;
    await fails(db.query('select public.employer_post_job($1)', [job({ matching: { ...rules, careerArea: '<script>' } })]), /screening rules/);
    await as(B);
    const jobB = (await db.query('select public.employer_post_job($1) as id', [job({ title: 'Analyst' })])).rows[0].id;
    await as(ADM, 'authenticated', true);
    const stored = (await db.query('select application_requirements r from public.hr_jobs where id = $1', [jobA])).rows[0].r;
    assert.deepEqual(Object.keys(stored.matching).sort(), ['skills', 'softSkills', 'source', 'version', 'weights', 'minimumMonths', 'preferredMonths'].sort());
    assert.equal(stored.matching.source, 'career_preferences');

    // Three applications: two to Acme (scores 90 and 55), one to Beta.
    await db.exec('reset role');
    const app = (user, job, name, score, status, extra = '') => db.query(
      `insert into public.job_applications(user_id, job_id, name, email, whatsapp, degree, college, skills, resume_url, portfolio_url, screening_answers, match_result)
       values ($1,$2,$3,$4,'+919800000000','BCA','MES College','Python, SQL',$5,'https://folio.example',$6,$7) returning id`,
      [user, job, name, name.toLowerCase().split(' ')[0] + '@mail.in', 'applications/' + name.split(' ')[0] + '.pdf',
       JSON.stringify([{ question: 'Why this role?', answer: 'I love it' }]), JSON.stringify({ status, score, reasons: ['python: present'], components: {} })]);
    const priya = (await app(U1, jobA, 'Priya Nair', 90, 'matched')).rows[0].id;
    const rahul = (await app(U2, jobA, 'Rahul Das', 55, 'needs_information')).rows[0].id;
    const other = (await app(U1, jobB, 'Priya Nair', 99, 'matched')).rows[0].id;

    // Acme sees its two applicants, best score first, with no contact details or resume.
    await as(A);
    const list = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    assert.deepEqual(list.rows.map(r => r.name), ['Priya Nair', 'Rahul Das']);
    assert.equal(list.total, 2);
    assert.deepEqual(list.counts, { all: 2, new: 2, shortlisted: 0, rejected: 0 });
    assert.ok(list.rows.every(r => r.contact === null && r.has_resume === true));
    assert.ok(!JSON.stringify(list).includes('priya@mail.in') && !JSON.stringify(list).includes('Priya.pdf'), 'no contact details or resume path before shortlisting');
    assert.equal(list.rows[0].match.score, 90);
    assert.deepEqual(list.rows[0].answers, [{ question: 'Why this role?', answer: 'I love it' }]);

    // Filters: minimum score, match result, search, listing.
    const one = async args => (await db.query('select public.employer_applicants($1,$2,$3,$4,$5) as r', args)).rows[0].r;
    assert.deepEqual((await one([null, null, null, 60, null])).rows.map(r => r.name), ['Priya Nair']);
    assert.deepEqual((await one([null, null, 'needs_information', null, null])).rows.map(r => r.name), ['Rahul Das']);
    assert.deepEqual((await one([null, null, null, null, 'rahul'])).rows.map(r => r.name), ['Rahul Das']);
    assert.equal((await one([jobA, null, null, null, 'zzz'])).total, 0);
    await fails(db.query(`select public.employer_applicants(null,null,null,150)`), /between 0 and 100/);
    await fails(db.query(`select public.employer_applicants(null,'hired')`), /Invalid status/);
    await fails(db.query(`select public.employer_applicants(null,null,null,null,null,0,1000)`), /Invalid page/);

    // Beta sees only its own applicant and cannot ask about Acme's listing or applicants.
    await as(B);
    const betaList = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    assert.deepEqual(betaList.rows.map(r => r.id), [other]);
    await fails(db.query('select public.employer_applicants($1)', [jobA]), /Listing not found/);
    await fails(db.query(`select public.employer_set_applicant_status($1,'shortlisted')`, [priya]), /Applicant not found/);
    assert.equal((await db.query('select * from public.job_applications')).rows.length, 0, 'no direct table access');

    // Shortlisting releases contact details and the resume for that applicant only.
    await as(A);
    await fails(db.query(`select public.employer_set_applicant_status($1,'hired')`, [priya]), /Invalid status/);
    await db.query(`select public.employer_set_applicant_status($1,'shortlisted')`, [priya]);
    const after = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    const p = after.rows.find(r => r.id === priya), r = after.rows.find(x => x.id === rahul);
    assert.deepEqual(p.contact, { email: 'priya@mail.in', whatsapp: '+919800000000', portfolio: 'https://folio.example', resume: 'applications/Priya.pdf' });
    assert.equal(r.contact, null);
    assert.equal(after.counts.shortlisted, 1);
    assert.deepEqual((await one([null, 'shortlisted', null, null, null])).rows.map(x => x.id), [priya]);

    // Resume files: Acme can open the shortlisted one only; Beta none.
    await db.exec('reset role');
    await db.exec(`insert into storage.objects values ('resumes','applications/Priya.pdf'), ('resumes','applications/Rahul.pdf'), ('company-docs','x/y.pdf')`);
    await as(A);
    assert.deepEqual((await db.query('select name from storage.objects')).rows.map(x => x.name), ['applications/Priya.pdf']);
    await as(B);
    assert.equal((await db.query('select name from storage.objects')).rows.length, 0);

    // Staff can still see everything; a company that is suspended loses access at once.
    await as(ADM, 'authenticated', true);
    assert.equal((await db.query('select * from public.job_applications')).rows.length, 3);
    assert.deepEqual((await db.query(`select action from public.employer_events where action like 'applicant_%'`)).rows.map(x => x.action), ['applicant_shortlisted']);
    await db.query(`select public.admin_employer_review($1, 'suspended')`, [acme]);
    await as(A);
    await fails(db.query('select public.employer_applicants()'), /not approved/);
    await as(ADM, 'authenticated', true);
    await db.query(`select public.admin_employer_review($1, 'approved')`, [acme]);

    // Editing a listing: rules stay unless the company sends "matching"; an empty value clears them.
    await as(A);
    await db.query('select public.employer_update_job($1,$2)', [jobA, job({ title: 'Python Developer II' })]);
    assert.ok((await db.query('select public.employer_my_jobs() as j')).rows[0].j.find(j => j.id === jobA).matching);
    await db.query('select public.employer_update_job($1,$2)', [jobA, job({ matching: {} })]);
    const mine = (await db.query('select public.employer_my_jobs() as j')).rows[0].j.find(j => j.id === jobA);
    assert.equal(mine.matching, null);
    assert.equal(mine.shortlisted, 1);
  } finally {
    await db.close();
  }
});

test('the employer page shows applicants through the safe functions only', () => {
  const page = fs.readFileSync('employer.html', 'utf8');
  for (const fn of ['employer_applicants', 'employer_set_applicant_status']) assert.ok(page.includes(fn), fn);
  assert.doesNotMatch(page, /\.from\('job_applications'\)/);
  assert.doesNotMatch(page, /innerHTML\s*=/);
  assert.ok(page.includes("storage.from('resumes').createSignedUrl"), 'resumes open through short-lived links');
});
