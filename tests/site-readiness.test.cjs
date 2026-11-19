const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
test('Pages has an actual 404 document and an indexable public sitemap',()=>{
  assert.ok(fs.existsSync(path.join(root,'404.html')));
  const sitemap=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');
  const urls=[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);
  assert.ok(urls.length>=15);
  assert.equal(new Set(urls).size,urls.length);
  for(const value of urls){
    const url=new URL(value);assert.equal(url.origin,'https://www.kompetenzen.in');
    if(url.pathname==='/Resume/')continue; // served by functions/Resume/[[path]].js
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1)+'.html';
    const html=fs.readFileSync(path.join(root,name),'utf8');
    assert.ok(html.includes(`rel="canonical" href="${value}"`),name);
    assert.doesNotMatch(html,/<meta\s+name="robots"\s+content="[^"]*noindex/i,name);
  }
  assert.match(fs.readFileSync(path.join(root,'robots.txt'),'utf8'),/Sitemap: https:\/\/www\.kompetenzen\.in\/sitemap\.xml/);
});
test('every redirect in _redirects lands on a page or file that exists',()=>{
  const lines=fs.readFileSync(path.join(root,'_redirects'),'utf8').split(/\r?\n/).filter(l=>l.trim()&&!l.trim().startsWith('#'));
  assert.ok(lines.length>=14);
  for(const line of lines){
    const [from,to,status]=line.trim().split(/\s+/);
    assert.equal(status,'301',line);
    assert.notEqual(from,to,line);
    const target=decodeURIComponent(to==='/'?'index.html':to.slice(1));
    assert.ok(fs.existsSync(path.join(root,target))||fs.existsSync(path.join(root,target+'.html')),'missing target for: '+line);
  }
});
