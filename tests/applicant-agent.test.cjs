const test=require('node:test');
const assert=require('node:assert/strict');
const UI=require('../js/local-ai-ui.js');
const core=import('../js/automatic-applicants.mjs');

test('agent flags contradictory skills and under-specified jobs without changing HR status',async()=>{
  const {createAutomaticReview}=await core;
  const engine=createAutomaticReview();
  const load=async(key,job,skills)=>engine.load({key,job,fetchPage:async()=>({total:1,rows:[{id:'one',hr_status:'received',skills}]})});
  const [conflict]=await load('conflict',{skills:'Excel'},'Excel, I have never used Excel');
  assert.equal(UI.review(conflict).status,'needs_information');
  assert.match(conflict.ai_result.agent.concerns[0],/Conflicting/);
  assert.equal(conflict.hr_status,'received');
  const [title]=await load('title',{title:'Excel'},'Excel');
  assert.equal(UI.review(title).status,'needs_information');
  assert.match(title.ai_result.agent.concerns[0],/no explicit/);
});

test('semantic review uses allowlisted professional evidence and never awards score points',async()=>{
  const {createAutomaticReview}=await core;let sent;
  const engine=createAutomaticReview({semanticReviewer:{reset(){},async review(items){sent=items;return items.map(i=>({id:i.id,hints:[{requirement:'Software testing',evidence:'Quality assurance testing',similarity:80}]}));}}});
  const [row]=await engine.load({key:'job',job:{skills:'Software testing'},fetchPage:async()=>({total:1,rows:[{id:'private-id',name:'Private Name',email:'private@example.invalid',college:'Private College',skills:'Quality assurance testing'}]})});
  assert.equal(row.ai_result.score,0);assert.equal(row.ai_result.agent.semanticStatus,'complete');
  for(const forbidden of ['private-id','Private','@'])assert.ok(!JSON.stringify(sent).includes(forbidden));
  assert.match(UI.banner(row,String),/no score points added/);
  assert.ok(row.ai_result.agent.questions.length);
});

test('model failures retain scores with an explicit unavailable notice',async()=>{
  const {createAutomaticReview}=await core;
  const engine=createAutomaticReview({semanticReviewer:{reset(){},async review(){throw Error('Missing weights');}}});
  const [row]=await engine.load({key:'job',job:{skills:'Bookkeeping, Excel'},fetchPage:async()=>({total:1,rows:[{id:'one',skills:'Excel'}]})});
  assert.equal(row.ai_result.score,50);assert.equal(row.ai_result.agent.semanticStatus,'unavailable');
  assert.match(UI.banner(row,String),/comparison unavailable/);
});

test('late semantic results cannot repopulate a signed-out session',async()=>{
  const {createAutomaticReview}=await core;let complete;
  const engine=createAutomaticReview({semanticReviewer:{reset(){},review(){return new Promise(resolve=>{complete=resolve;});}}});
  const pending=engine.load({key:'job',job:{skills:'SQL'},fetchPage:async()=>({total:1,rows:[{id:'one',skills:'Excel'}]})});
  for(let i=0;i<100 && !complete;i++)await new Promise(r=>setImmediate(r));
  assert.ok(complete);engine.reset();complete([{id:0,hints:[]}]);
  await assert.rejects(pending,/cancelled/);
});
