// Read-only source/asset inventory. No network calls or credential output.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const zlib = require('node:zlib');
const vm = require('node:vm');
const { parseDocument, DomUtils: d } = require('../Resume/backend/node_modules/htmlparser2');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'output/preproduction-audit');
fs.mkdirSync(output, { recursive: true });
const files = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const syntaxErrors=[];
function insideLabel(n) { for(let p=n.parent;p;p=p.parent) if(p.name==='label') return true; return false; }
const pages = files.map(file => {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const doc = parseDocument(source);
  const elements = d.findAll(n => !!n.name, doc.children);
  const tags = name => elements.filter(n => n.name === name);
  for(const [i,n] of tags('script').entries()) if(!n.attribs.src && (!n.attribs.type || n.attribs.type==='text/javascript')) {
    try { new vm.Script(d.textContent(n),{filename:file+':inline-'+i}); }
    catch(error){syntaxErrors.push({file,script:i,error:error.message});}
  }
  const metas = Object.fromEntries(tags('meta').map(n => [n.attribs.name || n.attribs.property, n.attribs.content]));
  const links = tags('a').map(n => n.attribs.href).filter(Boolean);
  const resources = elements.filter(n => ['script', 'img', 'source', 'link', 'video', 'iframe'].includes(n.name))
    .map(n => ({ tag: n.name, url: n.attribs.src || n.attribs.href || n.attribs.poster })).filter(n => n.url);
  const missing = [...links.map(url => ({tag:'a', url})), ...resources].filter(({url}) => {
    if (/^(?:[a-z]+:|\/\/|#)/i.test(url) || url.includes('${') || url.startsWith('/Resume') || url.startsWith('Resume/')) return false;
    const rel = decodeURIComponent(url.split(/[?#]/)[0]).replace(/^\//, '') || 'index.html';
    return !fs.existsSync(path.join(root, rel)) && !fs.existsSync(path.join(root, rel + '.html'));
  });
  const ids = tags('label').map(n => n.attribs.for);
  const controls = elements.filter(n => ['input','select','textarea'].includes(n.name) && !['hidden','submit','button'].includes(n.attribs.type));
  return { file, bytes: Buffer.byteLength(source), gzipBytes: zlib.gzipSync(source).length,
    title: tags('title').map(d.textContent).join(''), description: metas.description || '',
    canonical: tags('link').find(n => n.attribs.rel === 'canonical')?.attribs.href || '',
    robots: metas.robots || '', ogTitle: metas['og:title'] || '', twitterCard: metas['twitter:card'] || '',
    h1: tags('h1').map(n => d.textContent(n).trim()), lang: tags('html')[0]?.attribs.lang || '',
    imageCount: tags('img').length, imagesWithoutAlt: tags('img').filter(n => !('alt' in n.attribs)).length,
    imagesWithoutDimensions: tags('img').filter(n => !n.attribs.width || !n.attribs.height).length,
    unlabelledControls: controls.filter(n => !n.attribs['aria-label'] && !n.attribs['aria-labelledby'] && !(n.attribs.id && ids.includes(n.attribs.id)) && !insideLabel(n)).map(n=>n.attribs.id||n.attribs.name||n.name),
    missing, resources, links, structuredData: tags('script').filter(n=>n.attribs.type==='application/ld+json').map(n=>{try{return {validJson:true,type:JSON.parse(d.textContent(n))['@type']};}catch{return {validJson:false};}}),
    inlineScriptCount: tags('script').filter(n=>!n.attribs.src && n.attribs.type!=='application/ld+json').length };
});
const tracked = ['', 'Resume'].flatMap(prefix => cp.execFileSync('git',['ls-files','-z'],{cwd:path.join(root,prefix),encoding:'utf8'}).split('\0').filter(Boolean).map(f=>prefix?prefix+'/'+f:f));
const sourceFiles = tracked.filter(f=>/\.(?:[cm]?js|ts|sql|html|toml|ya?ml|json|md)$/.test(f) && !f.endsWith('package-lock.json'));
const tables = new Set(), rpcs = new Set(), env = new Set(), endpoints = [], secrets = [];
for (const file of sourceFiles) {
  if (!fs.existsSync(path.join(root,file))) continue;
  const text = fs.readFileSync(path.join(root,file),'utf8');
  for(const m of text.matchAll(/\.from\(['"]([\w-]+)['"]\)/g)) tables.add(m[1]);
  for(const m of text.matchAll(/\.rpc\(['"]([\w-]+)['"]/g)) rpcs.add(m[1]);
  for(const m of text.matchAll(/(?:process\.env\.|env\(['"]|Deno\.env\.get\(['"])([A-Z][A-Z0-9_]+)/g)) env.add(m[1]);
  if(file.includes('/routes/')) for(const m of text.matchAll(/router\.(get|post|put|patch|delete|route)\(['"]([^'"]+)/g)) endpoints.push({file,method:m[1],path:m[2]});
  const patterns = {privateKey:/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, googleApiKey:/AIza[\w-]{35}/g, githubToken:/gh[pousr]_[A-Za-z0-9]{30,}/g, secretKey:/sb_secret_[\w-]{20,}/g};
  for(const [kind, re] of Object.entries(patterns)) { const hits=[...text.matchAll(re)].length; if(hits) secrets.push({file,kind,count:hits}); }
}
const assets = [];
function walk(dir) { for(const e of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory())walk(p);else assets.push({file:path.relative(path.join(root,'dist'),p).replaceAll('\\','/'),bytes:fs.statSync(p).size}); } }
if(fs.existsSync(path.join(root,'dist')))walk(path.join(root,'dist'));
assets.sort((a,b)=>b.bytes-a.bytes);
const dependencies=['','Resume/backend'].map(dir=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,dir,'package.json')));
  const lock=JSON.parse(fs.readFileSync(path.join(root,dir,'package-lock.json')));
  return {project:dir||'website',packages:Object.entries({...manifest.dependencies,...manifest.devDependencies}).map(([name,range])=>({name,range,version:lock.packages?.['node_modules/'+name]?.version,development:!!manifest.devDependencies?.[name]}))};
});
const assetGroups={};for(const a of assets){const ext=path.extname(a.file)||'other';assetGroups[ext]=(assetGroups[ext]||0)+a.bytes;}
const result={scope:'Source inspection; no browser layout or live workflow claims',pages,tables:[...tables].sort(),rpcs:[...rpcs].sort(),environmentNames:[...env].sort(),endpoints,secretPatternFindings:secrets,syntaxErrors,dependencies,assetGroups,trackedSourceCount:sourceFiles.length,assets,totalBuildBytes:assets.reduce((n,a)=>n+a.bytes,0)};
const dest=path.join(output,process.argv[2] === 'final' ? 'source-final.json' : 'source-baseline.json');
fs.writeFileSync(dest,JSON.stringify(result,null,2));
console.log(JSON.stringify({pages:pages.length,trackedSourceCount:result.trackedSourceCount,tables:result.tables,rpcs:result.rpcs,missingReferences:pages.flatMap(p=>p.missing.map(m=>({page:p.file,...m}))),secretPatternFindings:secrets,totalBuildBytes:result.totalBuildBytes,largestAssets:assets.slice(0,10),metadata:pages.map(({file,title,description,canonical,h1,robots,imagesWithoutAlt,unlabelledControls})=>({file,title,description:!!description,canonical,h1:h1.length,robots,imagesWithoutAlt,unlabelledControls}))},null,2));
