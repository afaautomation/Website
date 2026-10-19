const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/auth-modal.js','utf8');
test('failed Firebase script downloads can be retried instead of hanging',async()=>{
  const code=source.slice(source.indexOf('  function loadScriptAsync('),source.indexOf('  async function ensureFirebaseAuth('));
  let current=null;
  const element=()=>({listeners:{},attrs:{},addEventListener(k,fn){this.listeners[k]=fn;},removeEventListener(k){delete this.listeners[k];},getAttribute(k){return this.attrs[k];},setAttribute(k,v){this.attrs[k]=v;},remove(){current=null;}});
  const context={document:{querySelector:()=>current,createElement:element,head:{appendChild:s=>current=s}},setTimeout,clearTimeout,Error};
  vm.createContext(context);vm.runInContext(code,context);
  const first=context.loadScriptAsync('https://example.test/firebase.js');
  current.listeners.error();await assert.rejects(first,/Could not load phone verification/);
  assert.equal(current,null);
  const second=context.loadScriptAsync('https://example.test/firebase.js');
  current.listeners.load();await second;
  await context.loadScriptAsync('https://example.test/firebase.js');
  assert.equal(current.attrs['data-loaded'],'true');
});
test('OTP guidance distinguishes localhost, billing and region settings without bypassing verification',()=>{
  assert.match(source,/Real SMS verification is not supported on localhost/);
  assert.match(source,/auth\/billing-not-enabled/);
  assert.match(source,/SMS region policy allows India/);
  assert.doesNotMatch(source,/Please open the page via http:\/\/localhost:5500/);
  assert.doesNotMatch(source,/appVerificationDisabledForTesting\s*=\s*true/);
});
