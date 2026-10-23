const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const core = import('../js/local-ai-core.mjs');
const AI = require('../js/local-ai-ui.js');

test('integrated match suggestions respect eligibility, missing evidence and the AI threshold', () => {
  const app = (status, score) => ({ match_result: { status }, ai_result: { score } });
  assert.equal(AI.review(app('matched', 75), 60).status, 'matched');
  assert.equal(AI.review(app('matched', 59.9), 60).status, 'not_matched');
  assert.equal(AI.review(app('not_matched', 100), 60).status, 'not_matched');
  assert.equal(AI.review(app('needs_information', 100), 60).status, 'needs_information');
  assert.equal(AI.review(app('matched', 0), 60).score, 0);
  assert.equal(AI.review(app('matched', NaN), 60).status, 'needs_information');
  assert.equal(AI.review({match_result:{status:'matched'},ai_error:'Unavailable'}).score, null);
  assert.equal(AI.review({match_result:{status:'unconfigured'}}).status, 'unconfigured');
});

test('AI ordering, counts and pagination are based on the whole applicant set', () => {
  const rows = Array.from({length: 60}, (_, id) => ({id:String(id), match_result:{status:'matched'},ai_result:{score:id}}));
  const first = AI.page(rows, {status:'matched',minimum:30});
  assert.equal(first.total, 30); assert.equal(first.rows[0].id, '59');
  assert.equal(first.counts.all, 60); assert.equal(first.counts.not_matched, 30);
  const second = AI.page(rows, {status:'matched',minimum:30,offset:25});
  assert.equal(second.rows.length, 5); assert.equal(second.rows[0].id, '34');
  assert.equal(AI.page(rows, {status:'matched',minimum:59,offset:25}).offset, 0);
});

test('model analysis is reused for tabs; reset cancels workers and stale results cannot replace a new job', async () => {
  const original = global.Worker;
  const workers = [];
  global.Worker = class {
    constructor() { workers.push(this); }
    postMessage(data) { this.data = data; }
    terminate() { this.stopped = true; }
  };
  const rules = {skills:[{name:'Python'}]};
  const inputs = id => ({key:id,rules,fetchPage:async()=>({total:1,rows:[{id,matching_evidence:{career:{skills:['Python']}}}]})});
  const waitForWorker = async count => {
    for (let i=0;i<100 && workers.length<count;i++) await new Promise(resolve=>setImmediate(resolve));
    assert.equal(workers.length,count);
  };
  try {
    const first = AI.load(inputs('one')).catch(e=>e);
    await waitForWorker(1);
    const second = AI.load(inputs('two'));
    await waitForWorker(2);
    assert.equal(workers[0].stopped,true);
    workers[0].onmessage({data:{type:'complete',results:[{id:'one',result:{score:1}}]}});
    workers[1].onmessage({data:{type:'complete',results:[{id:'two',result:{score:90}}]}});
    assert.match((await first).message,/cancelled/);
    const rows = await second;
    assert.equal(rows[0].id,'two'); assert.equal(rows[0].ai_result.score,90);
    AI.setHRStatus('two', 'under_review');
    assert.equal(AI.page(rows).rows[0].hr_status,'under_review');
    assert.equal(await AI.load({...inputs('two'),fetchPage:()=>{throw Error('Must use cached analysis');}}),rows);
    assert.equal(workers.length,2);
  } finally { AI.reset(); global.Worker = original; }
});

test('model inputs exclude identity, college, age and unknown answers', async () => {
  const { makePlan } = await core;
  const rules = { skills: [{ name: 'Python', importance: 2 }], careerField: 'Software Development' };
  const evidence = { name: 'Secret Name', college: 'Secret College', age: 42,
    career: { skills: ["I don't know yet"], field: 'Software Development', offerPreference: 'Money' } };
  const plan = JSON.stringify(makePlan(rules, evidence));
  for (const excluded of ['Secret', '42', 'Money', "I don't know yet"]) assert.ok(!plan.includes(excluded));
});

test('all applicant pages are included; changing lists and cancellation fail explicitly', async () => {
  const { collectApplicants } = await core;
  const rows = Array.from({ length: 201 }, (_, id) => ({ id }));
  assert.equal((await collectApplicants(async offset => ({ rows: rows.slice(offset, offset + 100), total: 201 }))).length, 201);
  await assert.rejects(collectApplicants(async offset => ({ rows: rows.slice(0, 100), total: 201 })), /order changed/);
  await assert.rejects(collectApplicants(async () => ({ rows: [], total: 3 })), /Incomplete/);
  await assert.rejects(collectApplicants(async () => ({}), () => false), /cancelled/);
});

test('missing evidence scores zero; criteria-free jobs do not get an invented AI score', async () => {
  const { scoreProfile, cosine } = await core;
  const result = await scoreProfile({ skills: [{ name: 'Python' }] }, {}, () => { throw Error('Should not embed missing evidence'); });
  assert.equal(result.score, 0); assert.equal(result.coverage, 0);
  await assert.rejects(scoreProfile({}, {}, () => []), /Configure/);
  assert.throws(() => cosine([NaN], [1]), /Non-finite/);
});

test('degree aliases preserve distinct disciplines and skills', () => {
  const { canonical, expand, compact } = require('../js/matching-terms.js');
  assert.equal(canonical('B.Sc.', 'qualification'), canonical('BSc', 'qualification'));
  assert.equal(canonical('B.Tech', 'qualification'), canonical('BTech', 'qualification'));
  assert.notEqual(canonical('AI', 'specialisation'), canonical('CS', 'specialisation'));
  assert.notEqual(canonical('AI', 'specialisation'), canonical('AI/ML', 'specialisation'));
  assert.notEqual(canonical('Java', 'skills'), canonical('JavaScript', 'skills'));
  assert.notEqual(canonical('C#', 'skills'), canonical('C++', 'skills'));
  assert.deepEqual(compact(expand(['BSc', 'BTech'], 'qualification'), 'qualification'), ['bsc', 'btech']);
});

test('approved academic alternatives and configured weights produce explainable scores', async () => {
  const { scoreProfile } = await core;
  const rules = {
    weights:{skills:70,academics:20,experience:10},
    qualifications:['bsc','btech','bca'],
    specialisations:['Computer Science','Artificial Intelligence','Artificial Intelligence and Machine Learning'],
    skills:[{name:'Python',importance:3},{name:'Git',importance:1},{name:'SQL',importance:2},{name:'Testing',importance:1}],
    softSkills:['Communication','Teamwork','Problem-solving','Time management','Creativity','Presentation skills'].map(name=>({name,importance:1})),
    careerArea:'Technology & Data',careerField:'Software Development',preferredMonths:12,minimumMonths:0,experienceScope:'Testing'
  };
  const first = {qualification:'B.Sc.',specialisation:'Artificial Intelligence',relevantMonths:null,experienceScope:'Testing',
    career:{area:'Technology & Data',field:'Software Development',skills:['HTML / CSS','Python','Git','SQL','Testing'],
      softSkills:['Communication','Teamwork','Problem-solving','Critical thinking','Leadership','Creativity','Attention to detail']}};
  const second = {...first,qualification:'B.Tech',specialisation:'Artificial Intelligence and Machine Learning',relevantMonths:0,
    career:{...first.career,skills:['Python','Git','SQL'],softSkills:['Communication','Teamwork','Problem-solving','Time management','Adaptability','Leadership']}};
  // Even maximum semantic similarity must not invent missing evidence.
  const embed = async () => [1,0];
  const a = await scoreProfile(rules,first,embed), b = await scoreProfile(rules,second,embed);
  assert.equal(a.score,79.2); assert.equal(b.score,73.8);
  assert.deepEqual(a.components,{skills:{points:59.2,weight:70},academics:{points:20,weight:20},experience:{points:0,weight:10}});
  for (const result of [a,b]) {
    assert.ok(result.checks.every(c=>c.status==='met'));
    assert.equal(AI.review({match_result:{status:'matched'},ai_result:result},60).status,'matched');
  }
  const restricted = await scoreProfile({...rules,specialisations:['Computer Science']},first,embed);
  const review = AI.review({match_result:{status:'not_matched'},ai_result:restricted});
  assert.equal(review.status,'not_matched');
  assert.match(review.explanation,/requires computer science; reported Artificial Intelligence/);
  assert.equal((await scoreProfile(rules,{...first,relevantMonths:12},embed)).score,89.2);
  assert.equal((await scoreProfile(rules,{...first,relevantMonths:12,experienceScope:'Unrelated'},embed)).score,79.2);
  const missing = await scoreProfile({...rules,minimumMonths:1},first,embed);
  assert.equal(AI.review({match_result:{status:'matched'},ai_result:missing}).status,'needs_information');
  const failed = await scoreProfile({...rules,minimumMonths:1},second,embed);
  assert.equal(AI.review({match_result:{status:'matched'},ai_result:failed}).status,'not_matched');
  await assert.rejects(scoreProfile({...rules,weights:{skills:100,academics:20,experience:10}},first,embed),/total 100/);
});

test('fresh rule snapshots supersede stale job cache and mixed versions fail visibly', async () => {
  const { resolveRules } = await core;
  const fresh = {skills:[{name:'Python',importance:3}],specialisations:['AI']};
  assert.deepEqual(resolveRules([{match_result:{rules:fresh}},{match_result:{rules:{specialisations:['AI'],skills:[{importance:3,name:'Python'}]}}}],{}),fresh);
  assert.throws(()=>resolveRules([{match_result:{rules:fresh}},{match_result:{rules:{specialisations:['CS']}}}],{}),/rules changed/);
});

test('real downloaded model runs offline and ranks related evidence above unrelated evidence', async () => {
  const { scoreProfile, MODEL_ID } = await core;
  const prefix = require('node:fs').existsSync('node_modules/@huggingface/transformers') ? 'node_modules' : 'tmp/local-ai/node_modules';
  const modulePath = path.resolve(prefix, '@huggingface/transformers/dist/transformers.node.mjs');
  const { pipeline, env } = await import(pathToFileURL(modulePath).href);
  env.allowRemoteModels = false;
  env.allowLocalModels = true;
  env.localModelPath = path.resolve('js/models') + path.sep;
  const previousFetch = global.fetch;
  global.fetch = () => { throw Error('Network forbidden during inference'); };
  let extractor;
  try {
    extractor = await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'cpu', local_files_only: true });
    const cache = new Map();
    const embed = async text => {
      if (!cache.has(text)) cache.set(text, Array.from((await extractor(text, { pooling: 'mean', normalize: true })).data));
      return cache.get(text);
    };
    const rules = { skills: [{ name: 'Software testing', importance: 1, essential: true }] };
    const related = await scoreProfile(rules, { career: { skills: ['Quality assurance testing'] } }, embed);
    const unrelated = await scoreProfile(rules, { career: { skills: ['Food preparation'] } }, embed);
    const exact = await scoreProfile(rules, { career: { skills: ['Software testing'] } }, embed);
    assert.equal(exact.score, 100);
    assert.ok(related.details[0].similarity > unrelated.details[0].similarity + 15, JSON.stringify({ related, unrelated }));
    assert.equal(related.score, 0, 'Semantic similarity cannot prove an unreported skill');
    assert.equal(unrelated.score, 0);
    assert.equal(related.checks[0].status, 'missing');
    assert.equal(related.details[0].exact, false);
    assert.equal(related.reviewRequired, true);
    assert.equal('status' in related, false, 'AI cannot override eligibility or decide hiring');
    console.log(`Offline model text similarity: exact=${exact.details[0].similarity}, related=${related.details[0].similarity}, unrelated=${unrelated.details[0].similarity}`);
  } finally {
    global.fetch = previousFetch;
    await extractor?.dispose();
  }
});
