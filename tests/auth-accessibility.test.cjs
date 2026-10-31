const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('account dialog traps Tab in both directions and handles Escape only when open',()=>{
  const source=fs.readFileSync('js/auth-modal.js','utf8');
  const start=source.indexOf('    // Keep keyboard navigation inside the open dialog.');
  const end=source.indexOf('\n  }',start);
  let handler,focused,closed=0;
  const control=name=>({disabled:false,tabIndex:0,getClientRects:()=>[{}],focus:()=>{focused=name;}});
  const first=control('first'),last=control('last');
  const modal={style:{display:'flex'},querySelectorAll:()=>[first,last],contains:el=>[first,last].includes(el),focus:()=>{focused='modal';}};
  const doc={activeElement:last,getElementById:()=>modal,addEventListener:(_type,fn)=>{handler=fn;}};
  vm.runInNewContext(source.slice(start,end),{document:doc,closeJobsAuthModal:()=>{closed++;}});
  let prevented=0;const event=(key,shiftKey=false)=>({key,shiftKey,preventDefault(){prevented++;}});
  handler(event('Tab'));assert.equal(focused,'first');
  doc.activeElement=first;handler(event('Tab',true));assert.equal(focused,'last');
  handler(event('Escape'));assert.equal(closed,1);assert.equal(prevented,3);
  modal.style.display='none';handler(event('Escape'));assert.equal(closed,1);
});
