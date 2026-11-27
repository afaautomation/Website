const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('companies see only their own applicants, with score filters, contact details and resumes', async () => {
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
    for (const name of ['hr_jobs', 'job_applications', 'candidate_profiles']) {
      await db.exec(schema.match(new RegExp('create table if not exists public\\.' + name + ' \\([\\s\\S]*?\\n\\);'))[0]);
    }
    await db.exec(`alter table public.candidate_profiles add column career_stage text, add column qualification text,
        add column specialisation text, add column institution text, add column recent_role text, add column industry text,
        add column preferred_roles text[] not null default '{}', add column challenge_other text, add column semester text,
        add column career_preferences jsonb not null default '{}';`);
    await db.exec(`alter table public.job_applications add column user_id uuid, add column job_id uuid, add column college text,
        add column availability text, add column portfolio_url text, add column matched_skills text[] not null default '{}',
        add column screening_answers jsonb not null default '[]', add column expected_salary text, add column current_location text,
        add column match_result jsonb not null default '{"status":"pending"}', add column matching_evidence jsonb not null default '{}';
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
    const third = fs.readFileSync('migrations/20261126_employer_applicant_profile.sql', 'utf8');
    await db.exec(third);
    await db.exec(third);
    const fourth = fs.readFileSync('migrations/20261127_employer_applicant_contact.sql', 'utf8');
    await db.exec(fourth);
    await db.exec(fourth);
    const fifth = fs.readFileSync('migrations/20261128_employer_applicant_scoring.sql', 'utf8');
    await db.exec(fifth);
    await db.exec(fifth);
    const sixth = fs.readFileSync('migrations/20261129_employer_applicant_stages.sql', 'utf8');
    await db.exec(sixth);
    await db.exec(sixth);
    const seventh = fs.readFileSync('migrations/20261130_employer_pause_listings.sql', 'utf8');
    await db.exec(seventh);
    await db.exec(seventh);
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
    await db.query(`insert into public.candidate_profiles(user_id, name, whatsapp, email, career_stage, qualification, specialisation, semester, recent_role, challenge_other, preferred_roles, career_preferences)
      values ($1,'Priya Nair','+919800000000','priya@mail.in','studying','BCA','Computer Applications','5','Intern','my private worry',array['Developer'],
      '{"area":"Technology & Data","field":"Software Development","skills":["Python","SQL"],"softSkills":["Teamwork"],"offerPreference":"secret"}')`, [U1]);
    const priya = (await app(U1, jobA, 'Priya Nair', 90, 'matched')).rows[0].id;
    const rahul = (await app(U2, jobA, 'Rahul Das', 55, 'needs_information')).rows[0].id;
    const other = (await app(U1, jobB, 'Priya Nair', 99, 'matched')).rows[0].id;
    await db.query(`update public.job_applications set matching_evidence = $2 where id = $1`, [priya, JSON.stringify({
      career: { area: 'Technology & Data', field: 'Software Development', skills: ['Python'], softSkills: [] },
      qualification: 'BCA', specialisation: null, college: 'MES College', selectedSkills: ['Python'], internalNote: 'not for companies' })]);

    // Acme sees its two applicants, best score first, with no contact details or resume.
    await as(A);
    const list = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    assert.deepEqual(list.rows.map(r => r.name), ['Priya Nair', 'Rahul Das']);
    assert.equal(list.total, 2);
    assert.deepEqual(list.counts, { all: 2, new: 2, shortlisted: 0, contacted: 0, interview: 0, selected: 0, rejected: 0 });
    assert.ok(list.rows.every(r => r.contact && r.has_resume === true));
    assert.deepEqual(list.rows[0].contact, { email: 'priya@mail.in', whatsapp: '+919800000000', portfolio: 'https://folio.example', resume: 'applications/Priya.pdf' });
    assert.equal(list.rows[1].contact.email, 'rahul@mail.in');
    assert.equal(list.rows[0].match.score, 90);
    assert.deepEqual(list.rows[0].profile, { career_stage: 'studying', qualification: 'BCA', specialisation: 'Computer Applications', semester: '5',
      recent_role: 'Intern', industry: null, preferred_roles: ['Developer'], career_area: 'Technology & Data',
      career_field: 'Software Development', career_skills: ['Python', 'SQL'], soft_skills: ['Teamwork'], portfolio_given: true });
    assert.ok(!JSON.stringify(list).includes('private worry') && !JSON.stringify(list).includes('secret'), 'private answers are never shared');
    assert.equal(list.rows[1].profile.qualification, null, 'an applicant without a profile row still lists');
    assert.deepEqual(list.rows[0].answers, [{ question: 'Why this role?', answer: 'I love it' }]);
    // The scoring snapshot the HR console uses: only the professional fields, nulls dropped.
    assert.deepEqual(list.rows[0].evidence, { career: { area: 'Technology & Data', field: 'Software Development', skills: ['Python'], softSkills: [] }, qualification: 'BCA' });
    assert.deepEqual(list.rows[1].evidence, {});
    assert.deepEqual(list.rows[0].match.rules, {});

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

    // Shortlisting is only a label for the company's own workflow.
    await as(A);
    await fails(db.query(`select public.employer_set_applicant_status($1,'hired')`, [priya]), /Invalid status/);
    await db.query(`select public.employer_set_applicant_status($1,'shortlisted')`, [priya]);
    const after = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    const p = after.rows.find(r => r.id === priya), r = after.rows.find(x => x.id === rahul);
    assert.deepEqual(p.contact, { email: 'priya@mail.in', whatsapp: '+919800000000', portfolio: 'https://folio.example', resume: 'applications/Priya.pdf' });
    assert.equal(r.contact.email, 'rahul@mail.in', 'contact details do not depend on shortlisting');
    assert.equal(after.counts.shortlisted, 1);
    assert.deepEqual((await one([null, 'shortlisted', null, null, null])).rows.map(x => x.id), [priya]);

    // The later steps, Contacted and Interview, each have their own filter and count.
    await db.query(`select public.employer_set_applicant_status($1,'contacted')`, [rahul]);
    assert.deepEqual((await one([null, 'contacted', null, null, null])).rows.map(x => x.id), [rahul]);
    await db.query(`select public.employer_set_applicant_status($1,'interview')`, [rahul]);
    const staged = (await db.query('select public.employer_applicants() as r')).rows[0].r;
    assert.deepEqual(staged.counts, { all: 2, new: 0, shortlisted: 1, contacted: 0, interview: 1, selected: 0, rejected: 0 });
    assert.deepEqual((await one([null, 'interview', null, null, null])).rows.map(x => x.id), [rahul]);
    assert.equal((await one([null, 'contacted', null, null, null])).total, 0);
    assert.ok(staged.rows.find(x => x.id === rahul).status_at, 'each row says when its status last changed');
    assert.equal(staged.rows.find(x => x.id === priya).status, 'shortlisted');
    await db.query(`select public.employer_set_applicant_status($1,'selected')`, [rahul]);
    assert.deepEqual((await one([null, 'selected', null, null, null])).rows.map(x => x.id), [rahul]);
    assert.equal((await one([null, 'interview', null, null, null])).total, 0);
    await fails(db.query(`select public.employer_set_applicant_status($1,null)`, [rahul]), /Invalid status/);
    await db.exec('reset role');
    await fails(db.query(`update public.job_applications set employer_status = 'hired' where id = $1`, [rahul]), /employer_status_check/);
    await as(A);

    // Resume files: Acme can open the resumes of its own applicants; Beta none.
    await db.exec('reset role');
    await db.exec(`insert into storage.objects values ('resumes','applications/Priya.pdf'), ('resumes','applications/Rahul.pdf'), ('company-docs','x/y.pdf')`);
    await as(A);
    assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(x => x.name), ['applications/Priya.pdf', 'applications/Rahul.pdf']);
    await as(B);
    // Beta can open only the file of its own applicant (Priya applied to both companies with the same file), never Rahul's.
    assert.deepEqual((await db.query('select name from storage.objects order by name')).rows.map(x => x.name), ['applications/Priya.pdf']);

    // Staff can still see everything; a company that is suspended loses access at once.
    await as(ADM, 'authenticated', true);
    assert.equal((await db.query('select * from public.job_applications')).rows.length, 3);
    assert.deepEqual((await db.query(`select action from public.employer_events where action like 'applicant_%' order by id`)).rows.map(x => x.action),
      ['applicant_shortlisted', 'applicant_contacted', 'applicant_interview', 'applicant_selected']);
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
    assert.equal(mine.shortlisted, 2, 'the listing counts Priya (shortlisted) and Rahul (selected) as taken forward');
    assert.equal(mine.paused, false);
    assert.equal(mine.closed, false);

    // Pausing hides the listing from visitors and refuses new applications, like a suspended company's listings.
    const visible = async () => { await as('', 'anon'); return (await db.query('select id from public.hr_jobs where id = $1', [jobA])).rows.length; };
    const myJob = async () => { await as(A); return (await db.query('select public.employer_my_jobs() as j')).rows[0].j.find(j => j.id === jobA); };
    assert.equal(await visible(), 1);
    await as(B);
    await fails(db.query('select public.employer_pause_job($1, true)', [jobA]), /Listing not found/);
    await as(A);
    await db.query('select public.employer_pause_job($1, true)', [jobA]);
    await db.query('select public.employer_pause_job($1, true)', [jobA]); // pausing twice changes nothing
    assert.deepEqual((({ paused, open, closed, held }) => ({ paused, open, closed, held }))(await myJob()), { paused: true, open: false, closed: false, held: true });
    assert.equal(await visible(), 0, 'a paused listing is hidden');
    const U3 = '00000000-0000-0000-0000-0000000000c3';
    await db.exec(`reset role; insert into auth.users values ('${U3}','late@mail.in',now(),null)`);
    await fails(app(U3, jobA, 'Late Applicant', 50, 'matched'), /no longer accepting/);
    await as(A);
    await fails(db.query('select public.employer_pause_job($1, null)', [jobA]), /pause or resume/);

    // Suspending and approving the company again keeps the company's own pause.
    await as(ADM, 'authenticated', true);
    await db.query(`select public.admin_employer_review($1, 'suspended')`, [acme]);
    await db.query(`select public.admin_employer_review($1, 'approved')`, [acme]);
    assert.equal((await myJob()).paused, true);
    assert.equal(await visible(), 0, 're-approval does not resume a paused listing');

    // Resuming shows it again.
    await as(A);
    await db.query('select public.employer_pause_job($1, false)', [jobA]);
    assert.equal(await visible(), 1);
    assert.equal((await myJob()).open, true);

    // Closing ends a pause; a closed listing cannot be paused or resumed.
    await db.query('select public.employer_pause_job($1, true)', [jobA]);
    await db.query('select public.employer_close_job($1)', [jobA]);
    assert.deepEqual((({ paused, open, closed, held }) => ({ paused, open, closed, held }))(await myJob()), { paused: false, open: false, closed: true, held: false });
    await fails(db.query('select public.employer_pause_job($1, false)', [jobA]), /has closed/);
    await as(ADM, 'authenticated', true);
    assert.deepEqual((await db.query(`select action from public.employer_events where action in ('job_paused','job_resumed','job_closed') order by id`)).rows.map(x => x.action),
      ['job_paused', 'job_resumed', 'job_paused', 'job_closed']);
  } finally {
    await db.close();
  }
});

test('the employer page shows applicants through the safe functions only', () => {
  const page = fs.readFileSync('employer.html', 'utf8');
  for (const fn of ['employer_applicants', 'employer_set_applicant_status', 'employer_pause_job', 'employer_close_job']) assert.ok(page.includes(fn), fn);
  assert.ok(page.includes("'Pause listing'") && page.includes("'Close listing'") && page.includes("aria-haspopup', 'menu'"), 'a three-dot menu with Pause and Close listing');
  for (const tab of ["['contacted', 'Contacted']", "['interview', 'Interview']", "['selected', 'Selected']"]) assert.ok(page.includes(tab), 'status tab ' + tab);
  assert.ok(page.includes('id="app-profile"') && page.includes("'#applicant=' + a.id"), 'each applicant opens as a full page');
  assert.doesNotMatch(page, /<dialog|View profile/, 'no pop-up and no separate View profile button');
  assert.ok(page.includes("import('./js/automatic-applicants.mjs')") && page.includes('keywordScore'), 'the same Keyword match as the HR console');
  assert.doesNotMatch(page, /\.from\('job_applications'\)/);
  assert.doesNotMatch(page, /innerHTML\s*=/);
  assert.ok(page.includes("storage.from('resumes').createSignedUrl"), 'resumes open through short-lived links');
});
