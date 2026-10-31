const test=require('node:test'),assert=require('node:assert/strict');
const server=require('../server');
test('local preview serves pages and refuses private workspace files',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  try{
    for(const p of ['/','/jobs','/jobs.html']) assert.equal((await fetch(base+p)).status,200,p);
    assert.match((await fetch(base+'/robots.txt')).headers.get('content-type'),/^text\/plain/);
    assert.match((await fetch(base+'/sitemap.xml')).headers.get('content-type'),/^application\/xml/);
    for(const p of ['/package.json','/tmp/audit-live-schema.json','/migration-backup/test.json','/.git/config','/server.js','/supabase_schema.sql','/not-a-real-page']) assert.equal((await fetch(base+p)).status,404,p);
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
    assert.equal((await fetch(base+'/%E0%A4%A')).status,400);
    const head=await fetch(base+'/',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
