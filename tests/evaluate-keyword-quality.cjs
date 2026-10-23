// Exploratory quality checks, not a labelled hiring-accuracy benchmark.
// Run explicitly: node tests/evaluate-keyword-quality.cjs
const UI=require('../js/local-ai-ui.js');
(async()=>{
  const {keywordScore,createAutomaticReview}=await import('../js/automatic-applicants.mjs');
  const app=(skills,extra={})=>({matching_evidence:{career:{skills},...extra}});
  const cases=[
    {name:'Exact declared skills',job:{skills:'Python, SQL'},app:app(['Python','SQL']),expected:'matched'},
    {name:'Unrelated declared skills',job:{skills:'Python, SQL'},app:app(['Bookkeeping']),expected:'not_matched'},
    {name:'Missing profile',job:{skills:'Python'},app:{},expected:'needs_information'},
    {name:'AI abbreviation',job:{skills:'AI'},app:app(['Artificial Intelligence']),expected:'matched'},
    {name:'Java must differ from JavaScript',job:{skills:'Java'},app:app(['JavaScript']),expected:'not_matched'},
    {name:'Configured essential degree mismatch',job:{skills:'Python',applicationRequirements:{matching:{qualifications:['BSc']}}},app:app(['Python'],{qualification:'MBA'}),expected:'not_matched'},
    {name:'Alternative requirements: Python OR Java',job:{requirements:'Python or Java'},app:app(['Python']),expected:'matched'},
    {name:'Explicit absence: never used Python',job:{skills:'Python'},app:app(['I have never used Python']),expected:'not_matched'},
    {name:'Career interest alone is not skill evidence',job:{skills:'Python'},app:{matching_evidence:{career:{skills:[],field:'Python'}}},expected:'needs_information'},
    {name:'Degree present but required skill evidence absent',job:{skills:'Python'},app:app([],{qualification:'B.Sc.'}),expected:'needs_information'},
    {name:'Generic prose must not outweigh all listed skills',job:{skills:'Python',description:'Build scalable reliable maintainable services deliver innovative solutions collaborate stakeholders'},app:app(['Python']),expected:'matched'}
  ];
  const results=cases.map(c=>{
    const ai_result=keywordScore(c.job,c.app),review=UI.review({...c.app,ai_result});
    return {scenario:c.name,expected:c.expected,actual:review.status,score:review.score,passed:c.expected===review.status};
  });
  const engine=createAutomaticReview(),rows=Array.from({length:1000},(_,id)=>({id,...app(['Python','SQL'])}));
  const started=performance.now();
  const scored=await engine.load({key:'synthetic-load',job:{skills:'Python, SQL'},fetchPage:async offset=>({total:rows.length,rows:rows.slice(offset,offset+100)})});
  console.log(JSON.stringify({note:'Synthetic cases with declared expectations; no real applicants changed; not a hiring accuracy estimate.',
    results,passed:results.filter(r=>r.passed).length,total:results.length,
    loadTest:{profiles:scored.length,allScored:scored.every(r=>r.ai_result.score===100),elapsedMs:Math.round(performance.now()-started)},
    careerFields:Object.values(globalThis.CareerCatalog.areas).reduce((n,a)=>n+Object.keys(a).length,0)},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
