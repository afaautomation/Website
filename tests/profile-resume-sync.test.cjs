const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sync = require('../js/profile-resume-sync.js');
const profile = {name:'Test Student',email:'test@example.invalid',whatsapp:'9876543210',career_stage:'studying',qualification:'B.Tech',specialisation:'Computer Science',institution:'Test College',grad_year:'2028',skills:'Python, SQL',preferred_location:'Bengaluru',career_preferences:{skills:['SQL',"I don't know yet"],softSkills:['Communication']}};

test('profile fills real editor fields without inventing work history or current location', () => {
  const content = sync.profileToResume({},profile);
  assert.equal(content.contact.name,'Test Student');
  assert.equal(content.contact.phone,'9876543210');
  assert.equal(content.contact.location,undefined);
  assert.equal(content.experience,undefined);
  assert.deepEqual(content.education,[{institution:'Test College',degree:'B.Tech · Computer Science',endDate:'2028'}]);
  assert.deepEqual(content.skills,['Python','SQL','Communication']);
});
test('existing resume edits, education entries and skill choices are preserved', () => {
  const source = {contact:{name:'Edited Name'},education:[{institution:'Different College',degree:'MCA'}],skills:['Java'],projects:[{name:'My project'}]};
  const result = sync.profileToResume(source,profile);
  assert.equal(result.contact.name,'Edited Name');
  assert.deepEqual(result.education,source.education);
  assert.deepEqual(result.skills,['Java']);
  assert.deepEqual(result.projects,source.projects);
  assert.equal(source.contact.email,undefined);
  assert.deepEqual(sync.profileToResume(result,profile),result);
});
test('saved resume fills profile education and contact without guessing career stage', () => {
  const result = sync.resumeToProfile({},sync.profileToResume({},profile),[['B.Tech']]);
  assert.equal(result.qualification,'B.Tech');
  assert.equal(result.specialisation,'Computer Science');
  assert.equal(result.institution,'Test College');
  assert.equal(result.grad_year,'2028');
  assert.equal(result.whatsapp,profile.whatsapp);
  assert.equal(result.career_stage,undefined);
  assert.equal(result.experience,undefined);
});
test('unstructured degree is retained and mismatched qualifications are not combined', () => {
  const content = {contact:{name:'Resume Name'},education:[{institution:'Other College',degree:'Custom Diploma',endDate:'2018–2021'}],skills:[{name:'Excel'}]};
  const result = sync.resumeToProfile({},content);
  assert.equal(result.qualification,'Custom Diploma');
  assert.equal(result.grad_year,'2021');
  assert.equal(result.skills,'Excel');
  const existing = sync.resumeToProfile({name:'Profile Name',institution:'Saved College',qualification:'MBA'},content);
  assert.equal(existing.name,'Profile Name');
  assert.equal(existing.qualification,'MBA');
  assert.equal(existing.grad_year,undefined);
});
function client(owner, value, error = null) {
  const calls = [];
  const query = {};
  for (const name of ['select','eq','order','limit']) query[name] = (...args) => { calls.push([name,...args]); return query; };
  query.maybeSingle = async () => ({data:value,error});
  return {calls,auth:{getSession:async()=>({data:{session:owner ? {user:{id:owner}} : null}})},from:table=>{calls.push(['from',table]);return query;}};
}
test('queries are scoped to the authenticated account and latest saved resume', async () => {
  const db = client('owner',{content:{contact:{name:'Owner'}}});
  assert.equal((await sync.readLatestResume(db,'owner')).contact.name,'Owner');
  assert.ok(db.calls.some(c=>c[0]==='eq' && c[1]==='user_id' && c[2]==='owner'));
  assert.ok(db.calls.some(c=>c[0]==='order' && c[1]==='updated_at' && !c[2].ascending));
  assert.ok(db.calls.some(c=>c[0]==='limit' && c[1]===1));
  const other = client('other',profile);
  assert.equal(await sync.readProfile(other,'owner'),null);
  assert.deepEqual(other.calls,[]);
  const signedOut = client(null,profile);
  assert.equal(await sync.readLatestResume(signedOut,'owner'),null);
  assert.deepEqual(signedOut.calls,[]);
});
test('query errors are surfaced without returning misleading empty success', async () => {
  await assert.rejects(sync.readProfile(client('owner',null,{message:'offline'}),'owner'),/Could not load/);
  await assert.rejects(sync.readLatestResume(client('owner',null,{message:'offline'}),'owner'),/Could not load/);
});
test('both separately deployed sites ship the identical shared mapping', () => {
  assert.equal(fs.readFileSync(path.join(__dirname,'../js/profile-resume-sync.js'),'utf8'),fs.readFileSync(path.join(__dirname,'../Resume/frontend/profile-resume-sync.js'),'utf8'));
});
