const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup(saved=null,failLoad=false,failSave=false,hash='') {
  const fields={};for(const id of ['notification-preferences','save-notifications','notification-feedback','notify-phone-row','notify-whatsapp','notify-email','notify-phone','notify-digest','field-phone','notification-channels','quick-apply-form']) fields[id]={checked:false,value:'',hidden:true,disabled:true,addEventListener(e,f){this[e]=f;},focus(){},before(){this.moved=true;}};
  fields['notify-digest'].value='off';fields['field-phone'].value='9876543210';const calls=[];
  const context={document:{getElementById:id=>fields[id]},location:{hash},window:{},supabaseClient:{auth:{getSession:async()=>({data:{session:{user:{id:'user'}}}})},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:saved,error:failLoad?{}:null})})})}),rpc:async(name,prefs)=>{calls.push(prefs);return {error:failSave?{}:null};}}};
  vm.runInNewContext(fs.readFileSync('js/notification-preferences.js','utf8'),context);
  return {fields,calls,save:context.window.NotificationPreferences.save};
}
test('no consent is assumed; changed preferences save with profile and only once',async()=>{
  const c=setup();await c.save();assert.equal(c.calls.length,0);assert.equal(c.fields['notify-email'].checked,false);
  c.fields['notify-email'].checked=true;await c.save();assert.equal(c.calls[0].p_email,true);assert.equal(c.calls[0].p_whatsapp,false);
  await c.save();assert.equal(c.calls.length,1);
});
test('WhatsApp reveals contact only after selection and validates before saving',async()=>{
  const c=setup();await c.save();c.fields['notify-whatsapp'].checked=true;c.fields['notify-whatsapp'].change();
  assert.equal(c.fields['notify-phone-row'].hidden,false);assert.equal(c.fields['notify-phone'].value,'+919876543210');
  c.fields['notify-phone'].value='bad';await assert.rejects(c.save(),/country code/);assert.equal(c.calls.length,0);
});
test('opt-out works from email link without completing profile or retaining digests',async()=>{
  const c=setup({email_enabled:true,whatsapp_enabled:false,whatsapp_number:'',job_digest:'weekly'},false,false,'#notification-preferences');
  await c.save();assert.equal(c.fields['save-notifications'].hidden,false);assert.equal(c.fields['quick-apply-form'].moved,true);
  c.fields['notify-email'].checked=false;await c.save();assert.equal(c.calls[0].p_digest,'off');assert.equal(c.calls[0].p_email,false);
});
test('settings load failure preserves choices; save failure is not reported as success',async()=>{
  const unavailable=setup(null,true);await unavailable.save();assert.equal(unavailable.calls.length,0);assert.equal(unavailable.fields['notification-channels'].disabled,true);
  const failed=setup(null,false,true);await failed.save();failed.fields['notify-email'].checked=true;await assert.rejects(failed.save(),/could not be saved/);
});
