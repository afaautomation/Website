const test = require('node:test');
const assert = require('node:assert/strict');
const UI = require('../js/local-ai-ui.js');
const core = import('../js/automatic-applicants.mjs');
const profile = (skills, softSkills = []) => ({matching_evidence:{career:{skills,softSkills}}});

test('every career field supports candidate ranking, alternatives, negative claims and missing evidence',async()=>{
  const {keywordScore}=await core;
  let fields=0, skillChecks=0;
  for(const [area, roles] of Object.entries(globalThis.CareerCatalog.areas)) {
    for(const [field, skills] of Object.entries(roles)) {
      fields++;
      const label=area+' / '+field, job={skills:skills.join(', ')};
      const scored=(id,app)=>({id,...app,ai_result:keywordScore(job,app)});
      const ranked=UI.page([scored('unrelated',profile(['Unrelated placeholder occupation'])),
        scored('missing',profile([])),scored('partial',profile([skills[0]])),scored('full',profile(skills))]);
      assert.equal(ranked.rows[0].id,'full',label);
      assert.equal(ranked.rows[0].ai_result.score,100,label);
      assert.equal(ranked.counts.matched,1,label);
      assert.equal(ranked.counts.needs_information,1,label);
      assert.equal(ranked.counts.not_matched,2,label);
      for(const skill of skills) {
        skillChecks++;
        assert.equal(keywordScore({skills:skill},profile([skill])).score,100,label+' exact '+skill);
        assert.equal(keywordScore({skills:skill},profile(['I have never used '+skill])).score,0,label+' negative '+skill);
        for(const source of ['skills','requirements']) {
          const option=keywordScore({[source]:skill+' or Alternative occupational skill'},profile([skill]));
          assert.equal(option.score,100,label+' OR '+skill);
        }
      }
    }
  }
  console.log(`Cross-sector coverage: ${Object.keys(globalThis.CareerCatalog.areas).length} areas, ${fields} fields, ${skillChecks} field-specific skill entries.`);
});

test('soft skill alternatives retain meaningful phrases across all occupations',async()=>{
  const {keywordScore}=await core;
  for(const skill of globalThis.CareerCatalog.softSkills) {
    assert.equal(keywordScore({skills:skill+' or Teamwork'},profile([],[skill])).score,100,skill);
  }
  assert.equal(keywordScore({skills:'Time management or Teamwork'},profile(['Product management'])).score,0);
  assert.equal(keywordScore({skills:'Attention to detail or Teamwork'},profile(['Attention'])).score,0);
});

test('unlisted occupations and skills use the same analysis without adding a role template',async()=>{
  const {keywordScore}=await core;
  for(const [role,skills] of [
    ['Marine technician',['Sonar calibration','Hull inspection']],
    ['Dental technician',['Dental CAD','Ceramic layering']],
    ['Renewable energy technician',['Solar panel installation','Inverter diagnostics']],
    ['Textile specialist',['Pattern grading','Fabric inspection']]
  ]) {
    const result=keywordScore({title:role,skills:skills.join(', ')},profile(skills));
    assert.ok(result.score>=80,role);
    assert.equal(UI.review({ai_result:result}).status,'matched',role);
    assert.equal(keywordScore({skills:skills[0]+' or '+skills[1]},profile([skills[1]])).score,100,role);
  }
});

test('nontechnical qualification spellings match without equating different degrees',async()=>{
  const {keywordScore}=await core;
  for(const [accepted,reported] of [['BCom','B.Com.'],['MCom','Master of Commerce'],['BA','B.A.'],['MBA','M.B.A.'],
    ['BEd','Bachelor of Education'],['MSW','Master of Social Work'],['LLB','LL.B.'],['BPharm','B.Pharm.'],['BDS','B.D.S.'],['MBBS','M.B.B.S.']]) {
    const job={applicationRequirements:{matching:{qualifications:[accepted]}}};
    const ai_result=keywordScore(job,profileWithDegree(reported));
    assert.equal(UI.review({ai_result}).status,'matched',accepted);
    assert.equal(UI.review({ai_result:keywordScore(job,profileWithDegree('Unrelated qualification'))}).status,'not_matched',accepted);
  }
  function profileWithDegree(qualification){return {matching_evidence:{qualification}};}
});
