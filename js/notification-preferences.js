(async function () {
  const el = id => document.getElementById(id);
  const button = el('save-notifications'), feedback = el('notification-feedback');
  if (location.hash === '#notification-preferences') el('notification-preferences').open = true;
  try {
    const { data: { session }, error: authError } = await supabaseClient.auth.getSession();
    if (authError || !session) throw new Error('Sign in to manage notifications.');
    const { data, error } = await supabaseClient.from('notification_preferences').select('*').eq('user_id', session.user.id).maybeSingle();
    if (error) throw new Error('Notification settings are not available yet. Your profile can still be saved.');
    if (data) {
      el('notify-email').checked = data.email_enabled;
      el('notify-whatsapp').checked = data.whatsapp_enabled;
      el('notify-phone').value = data.whatsapp_number;
      el('notify-digest').value = data.job_digest;
    }
    button.disabled = false;
    button.onclick = async () => {
      const number = el('notify-phone').value.replace(/[\s()-]/g, '');
      if (el('notify-whatsapp').checked && !/^\+[1-9]\d{7,14}$/.test(number)) {
        feedback.textContent = 'Enter your WhatsApp number with its country code, such as +919876543210.'; return;
      }
      button.disabled = true;
      try {
        const { error } = await supabaseClient.rpc('save_notification_preferences', {
          p_email: el('notify-email').checked, p_whatsapp: el('notify-whatsapp').checked,
          p_number: number, p_digest: el('notify-digest').value
        });
        if (error) throw error;
        feedback.textContent = 'Notification preferences saved.';
      } catch { feedback.textContent = 'Could not save notification preferences. Please try again.'; }
      finally { button.disabled = false; }
    };
  } catch (error) { feedback.textContent = error.message; }
})();
