const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('expired listings leave the public pages but keep their applications', async () => {
  // Optional local test dependency; installation instructions are in migrations/README.md.
  const { PGlite } = require(process.env.PGLITE_MODULE || '../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false') = 'true'$$;`);
    const schema = fs.readFileSync('supabase_schema.sql', 'utf8');
    for (const name of ['hr_jobs', 'job_applications']) {
      await db.exec(schema.match(new RegExp('create table if not exists public\\.' + name + ' \\([\\s\\S]*?\\n\\);'))[0]);
    }
    await db.exec(`alter table public.job_applications add column user_id uuid, add column job_id uuid;
      alter table public.hr_jobs add column application_requirements jsonb not null default '{}';
      alter table public.hr_jobs enable row level security;
      create policy "Admins can manage jobs" on public.hr_jobs for all to authenticated using (public.is_admin()) with check (public.is_admin());
      grant select, insert, update on public.hr_jobs to anon, authenticated; grant usage on schema public to anon;`);
    const migration = fs.readFileSync('migrations/20261103_listing_expiry.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // rerunnable

    const today = "(now() at time zone 'Asia/Kolkata')::date";
    const [open, lastDay, expired] = (await db.query(`insert into public.hr_jobs(title, expires_on) values
      ('No expiry', null), ('Last day', ${today}), ('Expired', ${today} - 1) returning id`)).rows.map(r => r.id);

    const user = '00000000-0000-0000-0000-000000000001';
    await assert.rejects(db.query('insert into public.job_applications(user_id, job_id, name) values ($1, $2, $3)', [user, expired, 'Late']), /closed/);
    // Staff can still record an application (here: one made before the listing expired).
    await db.exec(`set test.admin = 'true'`);
    await db.query('insert into public.job_applications(user_id, job_id, name) values ($1, $2, $3)', [user, expired, 'Earlier applicant']);
    await db.exec(`set test.admin = 'false'`);
    await db.query('insert into public.job_applications(user_id, job_id, name) values ($1, $2, $3)', [user, lastDay, 'On time']);

    await db.exec('set role anon');
    const visible = (await db.query('select title from public.hr_jobs order by title')).rows.map(r => r.title);
    assert.deepEqual(visible, ['Last day', 'No expiry']);
    assert.equal((await db.query('select * from public.job_details($1)', [expired])).rows.length, 0);
    assert.equal((await db.query('select * from public.job_details($1)', [open])).rows.length, 1);
    await db.exec('reset role');

    // Candidates who applied and staff can still open the expired listing.
    await db.exec(`set test.uid = '${user}'`);
    assert.equal((await db.query('select * from public.job_details($1)', [expired])).rows.length, 1);
    await db.exec(`set test.uid = ''; set test.admin = 'true'`);
    assert.equal((await db.query('select * from public.job_details($1)', [expired])).rows.length, 1);
    assert.equal((await db.query('select count(*)::int n from public.job_applications where job_id = $1', [expired])).rows[0].n, 1);
  } finally {
    await db.close();
  }
});
