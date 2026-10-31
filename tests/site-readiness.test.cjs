const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Pages has an actual 404 document and an indexable public sitemap',()=>{
  assert.ok(fs.existsSync(path.join(root,'404.html')));
  const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.ok(urls.length>=15);
  assert.equal(new Set(urls).size,urls.length);
  for(const value of urls){
    const url=new URL(value);assert.equal(url.origin,'https://kompetenzen.in');
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1)+'.html';
    const html=fs.readFileSync(path.join(root,name),'utf8');
    assert.ok(html.includes(`rel="canonical" href="${value}"`),name);
    assert.doesNotMatch(html,/<meta\s+name="robots"\s+content="[^"]*noindex/i,name);
  }
  assert.match(fs.readFileSync(path.join(root,'robots.txt'),'utf8'),/Sitemap: https:\/\/kompetenzen.in\/sitemap.xml/);
});
