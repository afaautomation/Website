(function () {
  const el = id => document.getElementById(id);
  const panel=el('notification-preferences'), button=el('save-notifications'), feedback=el('notification-feedback');
  let loaded=false, initial=null, existingDigest='off';
  function phoneVisibility() {
    el('notify-phone-row').hidden=!el('notify-whatsapp').checked;
    if(el('notify-whatsapp').checked && !el('notify-phone').value) {
      let value=(el('field-phone')?.value||'').replace(/[\s()-]/g,'');
      if(/^[6-9]\d{9}$/.test(value)) value='+91'+value;
      else if(/^91\d{10}$/.test(value)) value='+'+value;
      el('notify-phone').value=value;
    }
  }
  function values() {return {p_email:el('notify-email').checked,p_whatsapp:el('notify-whatsapp').checked,p_number:el('notify-phone').value.replace(/[\s()-]/g,''),p_digest:(el('notify-email').checked||el('notify-whatsapp').checked)?existingDigest:'off'};}
  function problem(message) {feedback.textContent=message; const error=new Error(message);error.notificationPreference=true;return error;}
  const ready=(async()=>{
    try {
      const {data:{session},error:authError}=await supabaseClient.auth.getSession();
      if(authError||!session) throw new Error('Sign in to manage notifications.');
      const {data,error}=await supabaseClient.from('notification_preferences').select('*').eq('user_id',session.user.id).maybeSingle();
      if(error) throw new Error('Notification settings are unavailable. Your profile can still be saved; existing choices will be preserved.');
      if(data) {el('notify-email').checked=data.email_enabled;el('notify-whatsapp').checked=data.whatsapp_enabled;el('notify-phone').value=data.whatsapp_number;existingDigest=data.job_digest||'off';}
      loaded=true;phoneVisibility();initial=JSON.stringify(values());el('notification-channels').disabled=false;button.disabled=false;
    } catch(error) {feedback.textContent=error.message;}
  })();
  async function save() {
    await ready;
    if(!loaded) return;
    const prefs=values();
    if(prefs.p_whatsapp&&!/^\+[1-9]\d{7,14}$/.test(prefs.p_number)) {el('notify-phone').focus();throw problem('Enter a WhatsApp number with its country code, or uncheck WhatsApp.');}
    if(JSON.stringify(prefs)===initial) return;
    try {
      const {error}=await supabaseClient.rpc('save_notification_preferences',prefs);if(error)throw error;
      initial=JSON.stringify(prefs);feedback.textContent='Your notification preferences are saved.';
    } catch {throw problem('Your notification choices could not be saved. Please retry so we can respect your preferences.');}
  }
  window.NotificationPreferences={save};
  el('notify-whatsapp').addEventListener('change',phoneVisibility);
  button.onclick=async()=>{button.disabled=true;try{await save();}catch{}finally{button.disabled=!loaded;}};
  // Keep email opt-out links independent of profile validation.
  if(location.hash==='#notification-preferences') {el('quick-apply-form').before(panel);button.hidden=false;}
})();
