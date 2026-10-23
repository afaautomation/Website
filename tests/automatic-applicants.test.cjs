const test=require('node:test');
const assert=require('node:assert/strict');
const core=import('../js/automatic-applicants.mjs');
const UI=require('../js/local-ai-ui.js');
const applicant=(skills,extra={})=>({matching_evidence:{career:{skills},...extra}});

test('all career fields score without manually configured rules',async()=>{
  const {keywordScore}=await core;
  for(const area of Object.values(globalThis.CareerCatalog.areas)) {
    for(const [field,skills] of Object.entries(area)) {
      const result=keywordScore({skills:skills.join(', ')},applicant(skills));
      assert.equal(result.score,100,field);
      assert.equal(UI.review({match_result:{status:'unconfigured'},ai_result:result}).status,'matched',field);
    }
  }
  const unknown=keywordScore({requirements:'TIG welding, brazing'},applicant(['TIG welding','brazing']));
  assert.equal(unknown.score,100,'Novel occupations also work');
});

test('keyword boundaries, aliases, missing evidence and explanations are accurate',async()=>{
  const {keywordScore}=await core;
  assert.equal(keywordScore({skills:'Java'},applicant(['JavaScript'])).score,0);
  assert.equal(keywordScore({skills:'C++'},applicant(['C#'])).score,0);
  assert.equal(keywordScore({skills:'JavaScript'},applicant(['JS'])).score,100);
  assert.equal(keywordScore({skills:'Python'},applicant(['No experience in Python'])).score,0);
  assert.equal(keywordScore({requirements:'Python is not required. SQL'},applicant(['SQL'])).score,100);
  const unknown=keywordScore({skills:'Python'},applicant(["I don't know yet"]));
  assert.equal(unknown.score,0);
  assert.equal(UI.review({ai_result:unknown}).status,'needs_information');
  assert.equal(keywordScore({},applicant(['Python'])).score,null);
  const result=keywordScore({skills:'Python, SQL'},applicant(['Python']));
  assert.equal(result.score,50);
  assert.deepEqual(result.matchedKeywords,['Python']);assert.deepEqual(result.missingKeywords,['SQL']);
  const banner=UI.banner({ai_result:result},s=>String(s).replaceAll('<','&lt;'));
  assert.match(banner,/Python — found in/);assert.match(banner,/SQL — not found/);
});

test('keywords use professional evidence only; explicit eligibility still gates high scores',async()=>{
  const {keywordScore}=await core;
  const job={skills:'Python',applicationRequirements:{matching:{qualifications:['BSc'],specialisations:['Computer Science']}}};
  const a=applicant(['Python'],{qualification:'B.Sc.',specialisation:'Computer Science'});
  assert.equal(UI.review({ai_result:keywordScore(job,a)}).status,'matched');
  const wrong=applicant(['Python'],{qualification:'MBA',specialisation:'Computer Science'});
  assert.equal(UI.review({ai_result:keywordScore(job,wrong)}).status,'not_matched');
  const base=keywordScore({skills:'Python'},applicant([]));
  assert.deepEqual(keywordScore({skills:'Python'},{...applicant([]),name:'Python',college:'Python',gender:'Python',resume_text:'Python',skills:'Python'}),base);
  assert.equal(keywordScore({skills:'Python'},{skills:'Python'}).score,100,'Legacy profiles use professional skill text');
});

test('job keyword weights are independent of applicant pool and repeated text',async()=>{
  const {jobKeywords,keywordScore}=await core;
  assert.deepEqual(jobKeywords({requirements:'SQL SQL SQL'}),jobKeywords({requirements:'SQL'}));
  const job={skills:'Python',description:'SQL'};
  assert.ok(keywordScore(job,applicant(['Python'])).score>keywordScore(job,applicant(['SQL'])).score);
});

test('legacy null career fields preserve saved skills and split course from specialisation',async()=>{
  const {professionalEvidence,keywordScore}=await core;
  const app={degree:'B.Sc. · Artificial Intelligence',course_name:null,skills:'HTML / CSS, Python, SQL, Testing',
    matching_evidence:{career:{area:null,field:null,skills:null,softSkills:null},qualification:null,specialisation:null}};
  const evidence=professionalEvidence(app);
  assert.deepEqual(evidence.career.skills,['HTML / CSS','Python','SQL','Testing']);
  assert.equal(evidence.qualification,'B.Sc.');assert.equal(evidence.specialisation,'Artificial Intelligence');
  assert.equal(keywordScore({skills:'Python, SQL, Testing'},app).score,100);
  const result=keywordScore({title:'AI Engineer',skills:'communication, Leadership, '},app);
  assert.equal(result.score,10);
  assert.ok(result.matchedKeywords.includes('ai'));
  assert.ok(result.missingKeywords.includes('communication'));
  assert.equal(UI.review({ai_result:result}).status,'not_matched','Do not invent the missing listed skills to reach the threshold');
  const required={applicationRequirements:{matching:{qualifications:['bsc'],specialisations:['Artificial Intelligence']}}};
  assert.ok(keywordScore(required,app).checks.every(c=>c.status==='met'));
  for(const explicit of [[],["I don't know yet"]]) {
    assert.equal(keywordScore({skills:'Python'},{...app,matching_evidence:{...app.matching_evidence,career:{skills:explicit}}}).score,0);
  }
});

test('job keyword abbreviations recognise professional full names without equating distinct subjects',async()=>{
  const {keywordScore}=await core;
  for(const [abbreviation,full] of [['AI','Artificial Intelligence'],['ML','Machine Learning'],['NLP','Natural Language Processing'],['HR','Human Resources'],['SEO','Search Engine Optimization']]) {
    assert.equal(keywordScore({skills:abbreviation},applicant([full])).score,100);
    assert.equal(keywordScore({skills:full},applicant([abbreviation])).score,100);
  }
  assert.equal(keywordScore({skills:'AI'},applicant(['Computer Science'])).score,0);
  assert.equal(keywordScore({skills:'ML'},applicant(['HTML / CSS'])).score,0);
});

test('all pages and jobs are scored once per refresh; cancellation and errors cannot poison cache',async()=>{
  const {createAutomaticReview}=await core;
  const engine=createAutomaticReview();let calls=0;
  const rows=Array.from({length:205},(_,i)=>({id:i,...applicant(['Python'])}));
  const request={key:'one',job:{skills:'Python'},fetchPage:async offset=>{calls++;return {total:205,rows:rows.slice(offset,offset+100)};}};
  const result=await engine.load(request);
  assert.equal(result.length,205);assert.ok(result.every(a=>a.ai_result.score===100));assert.equal(calls,3);
  assert.equal(await engine.load(request),result);assert.equal(calls,3);
  await engine.load({...request,key:'two'});assert.equal(calls,6);
  engine.reset();await engine.load(request);assert.equal(calls,9);
  let release;
  const pending=engine.load({...request,key:'pending',fetchPage:()=>new Promise(resolve=>{release=resolve;})});
  engine.reset();release({total:0,rows:[]});await assert.rejects(pending,/cancelled/);
  await assert.rejects(engine.load({...request,fetchPage:async()=>{throw Error('Offline');}}),/Offline/);
  assert.equal((await engine.load(request)).length,205);
});
