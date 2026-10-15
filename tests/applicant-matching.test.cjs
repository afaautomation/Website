const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Matching = require('../js/applicant-matching.js');
const values = {skills:'Python | essential | 3\nSQL | preferred | 2\nGit | preferred | 1', qualifications:'BCA, BTech', preferredQualifications:'BCA', skillsWeight:70, academicsWeight:20, experienceWeight:10, preferred:10, experienceScope:'Python projects, internships or employment; no overlapping months'};
const rules = Matching.parse(values);
test('configuration rejects duplicate skills, invalid weights and undefined experience', () => {
  assert.throws(()=>Matching.parse({...values,skills:'Python | essential | 3\n python | preferred | 2'}),/unique/);
  assert.throws(()=>Matching.parse({...values,skillsWeight:80}),/total 100/);
  assert.throws(()=>Matching.parse({...values,experienceScope:''}),/Describe/);
  assert.throws(()=>Matching.parse({...values,skills:'SQL | essential | -1'}),/Importance/);
});

test('database matching: eligibility, ranking, security, snapshots and stable pagination', async () => {
  // Optional local test dependency; installation instructions are in migrations/README.md.
  const { PGlite } = require(process.env.PGLITE_MODULE || '../tmp/matching-tests/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
      create function public.is_admin() returns boolean language sql as $$select coalesce(current_setting('test.admin',true),'false') = 'true'$$;`);
    const schema=fs.readFileSync('supabase_schema.sql','utf8');
    for(const name of ['hr_jobs','job_applications','candidate_profiles']) {
      const match=schema.match(new RegExp('create table if not exists public\\.'+name+' \\([\\s\\S]*?\\n\\);'));
      assert.ok(match,name); await db.exec(match[0]);
    }
    await db.exec(`alter table public.job_applications add column user_id uuid, add column job_id uuid;
      create unique index on public.job_applications(user_id,job_id);
      alter table public.hr_jobs add column if not exists responsibilities text, add column if not exists requirements text, add column if not exists about_company text, add column if not exists apply_url text, add column if not exists is_direct_link boolean default false;`);
    for(const file of ['20261011_candidate_onboarding.sql','20261011_application_requirements.sql','20261015_applicant_matching.sql']) await db.exec(fs.readFileSync('migrations/'+file,'utf8'));
    // Migration is rerunnable.
    await db.exec(fs.readFileSync('migrations/20261015_applicant_matching.sql','utf8'));
    const evaluate = async (e,r=rules) => (await db.query('select public.evaluate_applicant_match($1,$2) result',[JSON.stringify(r),JSON.stringify(e)])).rows[0].result;
    const evidence = {qualification:'BCA', skills:['Python','SQL','Git'],relevantMonths:8,experienceScope:rules.experienceScope};
    const expected = [[['Python','SQL','Git'],8,98],[['Python','SQL'],10,88.3],[['Python','Git'],5,71.7],[['Python'],0,55]];
    for(const [skills,months,score] of expected) {
      const r=await evaluate({...evidence,skills,relevantMonths:months}); assert.equal(r.status,'matched'); assert.equal(r.score,score);
    }
    assert.equal((await evaluate({...evidence,skills:['SQL']})).status,'needs_information');
    const fail=await evaluate({...evidence,skills:['SQL'],confirmedSkills:['Python'],selectedSkills:[]});
    assert.equal(fail.status,'not_matched'); assert.equal(fail.score,null);
    assert.equal((await evaluate({...evidence,qualification:''})).status,'needs_information');
    assert.equal((await evaluate({...evidence,qualification:'MBA'})).status,'not_matched');
    assert.equal((await evaluate({...evidence,qualification:'BTech'})).score,78);
    const fresher = Matching.parse({...values,preferred:0});
    assert.equal((await evaluate(evidence,fresher)).components.skills.weight,80);
    const noAcademics = Matching.parse({...values,preferredQualifications:'',preferred:0});
    assert.equal((await evaluate(evidence,noAcademics)).components.skills.weight,100);
    assert.equal((await evaluate({...evidence,relevantMonths:null})).score,90);
    assert.equal((await evaluate({...evidence,relevantMonths:null},{...rules,minimumMonths:2})).status,'needs_information');
    assert.equal((await evaluate({...evidence,relevantMonths:1},{...rules,minimumMonths:2})).status,'not_matched');
    assert.deepEqual(await evaluate({...evidence,experience_stage:'Leading',career_priority:'Growth-first',college:'Prestige',experience:'20 years'}),await evaluate(evidence));
    assert.equal((await evaluate({...evidence,skills:['Pythonista','SQL']})).status,'needs_information');
    assert.equal((await evaluate({...evidence,skills:[' PYTHON ','python','SQL','Git']})).score,98);
    assert.equal((await evaluate({...evidence,experienceScope:'unrelated'})).score,90);

    const uid='00000000-0000-0000-0000-000000000001', job='00000000-0000-0000-0000-000000000002';
    await db.exec(`insert into auth.users values ('${uid}','synthetic@example.invalid');
      insert into public.candidate_profiles(user_id,name,whatsapp,qualification,skills) values ('${uid}','Synthetic','000','BCA','Python,SQL,Git');
      set test.uid = '${uid}';`);
    await db.query('insert into public.hr_jobs(id,title,application_requirements) values ($1,$2,$3)',[job,'Python trainee',JSON.stringify({matching:rules})]);
    const apply=async answers => (await db.query('select public.apply_to_job($1,$2) result',[job,JSON.stringify(answers)])).rows[0].result;
    assert.equal((await apply({})).status,'responses_required');
    assert.equal((await apply({matching:{confirmed:true,rules,selectedSkills:['Python','SQL'],relevantMonths:10}})).status,'applied');
    let app=(await db.query('select * from public.job_applications')).rows[0];
    assert.equal(app.match_result.score,88.3);
    const original=app.submitted_matching_evidence;
    assert.equal((await apply({matching:{confirmed:true,rules,selectedSkills:[],relevantMonths:0}})).status,'already_applied');
    assert.equal((await db.query('select match_result from public.job_applications')).rows[0].match_result.score,88.3);
    await assert.rejects(db.query('select public.admin_matched_applicants($1)',[job]),/Staff access/);
    await db.exec("set test.admin = 'true'");
    const page=async (status='matched',offset=0,limit=25) => (await db.query('select public.admin_matched_applicants($1,$2,$3,$4) result',[job,status,offset,limit])).rows[0].result;
    assert.equal((await page()).total,1);
    await db.exec("update public.candidate_profiles set qualification='MBA'");
    assert.equal((await page()).total,0);
    assert.equal((await page('not_matched')).total,1);
    assert.deepEqual((await db.query('select submitted_matching_evidence from public.job_applications')).rows[0].submitted_matching_evidence,original);
    await db.exec("update public.candidate_profiles set qualification='BCA'");
    await db.query('update public.hr_jobs set application_requirements=$1 where id=$2',[JSON.stringify({matching:{...rules,minimumMonths:12}}),job]);
    assert.equal((await page('not_matched')).total,1);
    await db.query('update public.hr_jobs set application_requirements=$1 where id=$2',[JSON.stringify({matching:rules}),job]);
    // Synthetic rows with identical scores: earliest submission first, then UUID.
    await db.query("insert into public.job_applications(id,job_id,skills,degree,created_at) values ('00000000-0000-0000-0000-000000000003',$1,'Python','BCA','2020-01-01'),('00000000-0000-0000-0000-000000000004',$1,'Python','BCA','2020-01-01')",[job]);
    const all=await page('matched'); assert.equal(all.total,3);
    assert.equal(all.rows[1].id,'00000000-0000-0000-0000-000000000003');
    assert.equal((await page('matched',2,1)).rows[0].id,'00000000-0000-0000-0000-000000000004');
    const overview=(await db.query('select public.admin_matching_overview() result')).rows[0].result;
    assert.equal(overview.total,3); assert.equal(overview.jobs[0].matched_count,3);
    await assert.rejects(db.query('update public.hr_jobs set application_requirements=$1 where id=$2',[JSON.stringify({matching:{...rules,weights:{skills:100,academics:100,experience:0}}}),job]),/total 100/);
    await db.exec('set role authenticated');
    await assert.rejects(db.query('select public.apply_to_job_before_matching($1,$2)',[job,'{}']),/permission denied/);
    await db.exec('reset role');
    await db.exec(fs.readFileSync('migrations/20261015_career_matching.sql','utf8'));
    await db.exec(fs.readFileSync('migrations/20261015_career_matching.sql','utf8'));
    const careerRules = {...rules,careerArea:'Technology & Data',careerField:'Software Development',softSkills:[{name:'Communication',essential:true,importance:1}]};
    const career = {area:'Technology & Data',field:'Software Development',skills:['Python','SQL','Git'],softSkills:['Communication']};
    const careerEvidence = {...evidence,career};
    assert.equal((await evaluate(careerEvidence,careerRules)).score,98);
    assert.equal((await evaluate({...evidence,skills:['Python','SQL','Git']},careerRules)).status,'needs_information','Legacy skill evidence is ignored');
    assert.equal((await evaluate({...careerEvidence,career:{...career,field:'Data Analytics'}},careerRules)).status,'not_matched');
    assert.equal((await evaluate({...careerEvidence,career:{...career,softSkills:["I don't know yet"]}},careerRules)).status,'needs_information');
    assert.equal((await evaluate({...careerEvidence,career:{...career,skills:["I don't know yet"]}},careerRules)).status,'needs_information');
    assert.deepEqual(await evaluate({...careerEvidence,career:{...career,experience:'leading',offerPreference:'earn_first'}},careerRules),await evaluate(careerEvidence,careerRules));
    await db.query('update public.hr_jobs set application_requirements=$1 where id=$2',[JSON.stringify({matching:careerRules}),job]);
    await db.query('update public.candidate_profiles set career_preferences=$1 where user_id=$2',[JSON.stringify(career),uid]);
    assert.equal((await page()).total,1,'Career update rematches the real applicant');
    const beforeLegacy=(await page()).rows[0].match_result;
    await db.exec("update public.candidate_profiles set skills='Unrelated legacy skill'");
    assert.deepEqual((await page()).rows[0].match_result,beforeLegacy);
    await db.query('update public.candidate_profiles set career_preferences=$1 where user_id=$2',[JSON.stringify({...career,field:'Data Analytics'}),uid]);
    assert.equal((await page('not_matched')).total,1);
  } finally { await db.close(); }
});

