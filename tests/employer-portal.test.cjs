const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Runs the real migrations against an in-memory Postgres and checks the rules from each role's side.
test('companies are approved by staff before their jobs show, and cannot reach anything else', async () => {
  const { PGlite } = require(process.env.PGLITE_MODULE || '../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  const as = async (uid, role = 'authenticated', admin = false) => {
    await db.exec(`reset role; set test.uid = '${uid || ''}'; set test.admin = '${admin}'; set role ${role}`);
  };
  const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b';
  const C = '00000000-0000-0000-0000-00000000000c', U = '00000000-0000-0000-0000-00000000000d';
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
    await db.exec(`alter table public.job_applications add column user_id uuid, add column job_id uuid;
      alter table public.hr_jobs add column application_requirements jsonb not null default '{}';
      alter table public.hr_jobs enable row level security;
      create policy "Admins can manage jobs" on public.hr_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
      create policy "Admins can view all jobs" on public.hr_jobs for select to authenticated using (public.is_admin());
      grant select, insert, update, delete on public.hr_jobs to anon, authenticated;
      grant select on public.job_applications to authenticated;`);
    await db.exec(fs.readFileSync('migrations/20261103_listing_expiry.sql', 'utf8'));
    const migration = fs.readFileSync('migrations/20261124_employer_portal.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // re-runnable
    await db.exec(`grant select (id, title, company, created_at) on public.hr_jobs to anon, authenticated;
      insert into auth.users values ('${A}','owner@acme.in',now(),null), ('${B}','owner@other.in',now(),null),
        ('${C}','new@unverified.in',null,null), ('${U}','candidate@mail.in',now(),null);`);

    const reg = (name, uid = A) => db.query(`select public.employer_register($1,'https://acme.in','IT','11-50','Kochi','We build things','Asha Menon','+91 98765 43210',null)`, [name]);
    const job = (over = {}) => JSON.stringify({ title: 'Junior Developer', category: 'tech', job_type: 'full-time', location: 'Kochi',
      description: 'Build and test features with our team of engineers.', expires_on: new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10),
      questions: ['Why this role?'], ...over });

    // Not signed in, or email not verified: nothing works.
    await as('', 'anon');
    await fails(reg('Ghost'), /permission denied/);
    await as(C);
    await fails(reg('Unverified Ltd'), /verify your email/);

    // Register. Contact email comes from the account, a second company for the same account is refused.
    await as(A);
    const registered = (await reg('Acme Technologies')).rows[0].employer_register;
    assert.equal(registered.status, 'pending');
    assert.equal((await db.query('select contact_email, status from public.employer_companies')).rows[0].contact_email, 'owner@acme.in');
    await fails(reg('Acme Two'), /already registered/);
    await as(B);
    await fails(reg('ACME technologies'), /already registered|name is already/);
    await fails(db.query(`select public.employer_register('X','https://x.in','','','','','Bo','12','null')`), /valid phone|name/);
    await fails(db.query(`select public.employer_register('Beta Co','javascript:alert(1)','','','','','Bo Das','9876543210',null)`), /http/);
    await fails(db.query(`select public.employer_register('Beta Co','https://beta.in','','','','','Bo Das','9876543210','${A}/other.pdf')`), /document/);

    // Cannot touch the tables directly, cannot read another company, cannot self-approve.
    await as(A);
    await fails(db.query(`update public.employer_companies set status = 'approved'`), /permission denied/);
    await fails(db.query(`insert into public.employer_companies(owner_id,name,contact_name,contact_email,contact_phone,status) values ('${A}','x','y','z','1','approved')`), /permission denied/);
    await fails(db.query(`insert into public.hr_jobs(title) values ('Sneaky')`), /row-level security/);
    await fails(db.query(`select public.admin_employer_review(id, 'approved') from public.employer_companies`), /Admin access/);
    assert.equal((await db.query(`select * from public.employer_events`)).rows.length, 0, 'the audit trail is staff-only');
    await as(B);
    assert.equal((await db.query('select * from public.employer_companies')).rows.length, 0, 'another company is invisible');
    await as(U);
    assert.equal((await db.query('select * from public.employer_companies')).rows.length, 0);

    // Pending companies cannot post.
    await as(A);
    await fails(db.query('select public.employer_post_job($1)', [job()]), /not approved yet/);

    // Staff approve.
    await as(U, 'authenticated', true);
    const queue = (await db.query(`select public.admin_employer_list('pending') as l`)).rows[0].l;
    assert.equal(queue.length, 1);
    assert.equal(queue[0].contact_email, 'owner@acme.in');
    await db.query(`select public.admin_employer_review($1, 'approved', 'Verified by phone')`, [queue[0].id]);

    // Approved: the job goes live, as the company, with no outside apply link, and markup is stripped.
    await as(A);
    const jobId = (await db.query('select public.employer_post_job($1) as id', [job({ title: 'Junior <b>Developer</b>', company: 'Rival Ltd', apply_url: 'https://evil.example', application_requirements: { matching: {} } })])).rows[0].id;
    await as('', 'anon');
    let visible = (await db.query('select title, company from public.hr_jobs')).rows;
    assert.deepEqual(visible, [{ title: 'Junior bDeveloper/b', company: 'Acme Technologies' }]);
    const detail = (await db.query('select * from public.job_details($1)', [jobId])).rows[0];
    assert.equal(detail.apply_url, null);
    assert.equal(detail.is_direct_link, false);
    assert.deepEqual(detail.application_requirements, { resume: true, questions: ['Why this role?'] });

    // Validation: bad dates, categories, question counts.
    await as(A);
    await fails(db.query('select public.employer_post_job($1)', [job({ expires_on: '2020-01-01' })]), /last date/);
    await fails(db.query('select public.employer_post_job($1)', [job({ category: 'crime' })]), /category/);
    await fails(db.query('select public.employer_post_job($1)', [job({ questions: ['1', '2', '3', '4'] })]), /at most 3/);
    await fails(db.query('select public.employer_post_job($1)', [job({ description: 'short' })]), /30 characters/);

    // One company cannot edit or close another's listing.
    await as(B);
    await fails(db.query('select public.employer_close_job($1)', [jobId]), /not found/);
    await fails(db.query('select public.employer_update_job($1,$2)', [jobId, job()]), /Register your company|not approved/);
    assert.equal((await db.query('select public.employer_my_jobs() as j')).rows[0].j.length, 0);

    // Daily limit.
    await as(A);
    for (let i = 0; i < 9; i++) await db.query('select public.employer_post_job($1)', [job({ title: 'Opening ' + i })]);
    await fails(db.query('select public.employer_post_job($1)', [job({ title: 'One too many' })]), /10 jobs a day/);
    assert.equal((await db.query('select public.employer_my_jobs() as j')).rows[0].j.length, 10);

    // Company can edit and close its own listing; staff-set matching rules survive an edit.
    await as(U, 'authenticated', true);
    await db.query(`update public.hr_jobs set application_requirements = application_requirements || '{"matching":{"skills":[]}}' where id = $1`, [jobId]);
    await as(A);
    await db.query('select public.employer_update_job($1,$2)', [jobId, job({ title: 'Senior Developer' })]);
    await as(U, 'authenticated', true);
    assert.deepEqual((await db.query('select application_requirements r, title from public.hr_jobs where id=$1', [jobId])).rows[0],
      { r: { resume: true, questions: ['Why this role?'], matching: { skills: [] } }, title: 'Senior Developer' });
    await as(A);
    await db.query('select public.employer_close_job($1)', [jobId]);
    await as('', 'anon');
    assert.equal((await db.query('select * from public.job_details($1)', [jobId])).rows.length, 0);

    // Suspending hides every listing and refuses new applications; approving again brings them back.
    await as(U, 'authenticated', true);
    const companyId = queue[0].id;
    await db.query(`select public.admin_employer_review($1, 'suspended', 'Reported')`, [companyId]);
    await as('', 'anon');
    assert.equal((await db.query('select * from public.hr_jobs')).rows.length, 0);
    await as(A);
    await fails(db.query('select public.employer_post_job($1)', [job()]), /not approved yet/);
    const heldId = (await db.query('select id from public.employer_my_jobs() j, jsonb_to_recordset(j) as x(id uuid, held boolean) where held limit 1')).rows[0].id;
    await as(U);
    await fails(db.query('insert into public.job_applications(user_id, job_id, name) values ($1,$2,$3)', [U, heldId, 'Cand']), /permission denied|closed/);
    await db.exec('reset role');
    await fails(db.query('insert into public.job_applications(user_id, job_id, name) values ($1,$2,$3)', [U, heldId, 'Cand']), /closed/);
    await as(U, 'authenticated', true);
    await db.query(`select public.admin_employer_review($1, 'approved')`, [companyId]);
    await as('', 'anon');
    assert.equal((await db.query('select * from public.hr_jobs')).rows.length, 9);

    // Audit trail kept for staff.
    await as(U, 'authenticated', true);
    const actions = (await db.query('select distinct action from public.employer_events order by 1')).rows.map(r => r.action);
    assert.ok(['registered', 'job_posted', 'job_closed', 'status_approved', 'status_suspended'].every(a => actions.includes(a)), actions.join());

    // Document uploads: only into the account's own folder, five at most, readable by owner and staff only.
    await db.exec('reset role; grant select, insert on storage.objects to authenticated');
    const put = (uid, name) => db.query(`insert into storage.objects values ('company-docs', $1)`, [name]);
    await as(A);
    await put(A, `${A}/licence.pdf`);
    await fails(put(A, `${B}/licence.pdf`), /row-level security/);
    await fails(put(A, 'licence.pdf'), /row-level security/);
    for (let i = 1; i < 5; i++) await put(A, `${A}/extra${i}.pdf`);
    await fails(put(A, `${A}/sixth.pdf`), /row-level security/);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 5);
    await as(B);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0, 'another company cannot see the document');
    await as(U, 'authenticated', true);
    assert.equal((await db.query('select * from storage.objects')).rows.length, 5, 'staff can');
  } finally {
    await db.close();
  }
});

test('the employer page and admin console use only the safe functions', () => {
  const employer = fs.readFileSync('employer.html', 'utf8');
  const admin = fs.readFileSync('admin.html', 'utf8');
  assert.doesNotMatch(employer, /\.from\('hr_jobs'\)|\.from\('job_applications'\)/, 'employers never query job or applicant tables');
  assert.doesNotMatch(employer, /innerHTML\s*=/, 'listing text is rendered as text, not markup');
  // Staff can read every company, so a staff member signed in here must still get only their own.
  const companyReads = employer.match(/\.from\('employer_companies'\)[^;]*/g) || [];
  assert.ok(companyReads.length > 0);
  for (const read of companyReads) assert.match(read, /\.eq\('owner_id', user\.id\)/, read);
  for (const fn of ['employer_register', 'employer_post_job', 'employer_my_jobs', 'employer_close_job']) assert.ok(employer.includes(fn), fn);
  for (const fn of ['admin_employer_list', 'admin_employer_review']) assert.ok(admin.includes(fn), fn);
  assert.ok(fs.readFileSync('sitemap.xml', 'utf8').includes('/employer</loc>'));
});
