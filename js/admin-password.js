(async function () {
  const form = document.getElementById('password-form');
  const message = document.getElementById('password-message');
  const button = document.getElementById('save-password');
  function tell(text, error = false) {
    message.textContent = text;
    message.dataset.error = String(error);
  }
  try {
    if (!isSupabaseConfigured()) throw new Error('Password setup is unavailable. Please try again later.');
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.has('error')) throw new Error('This link has expired or was already used. Request a new link from staff login.');
    // Supabase initializes the session from the link before getSession resolves.
    const { data, error } = await supabaseClient.auth.getSession();
    const verified = data?.session && await supabaseClient.auth.getUser();
    history.replaceState(null, '', window.location.pathname);
    if (error || !data?.session || verified?.error || !verified?.data?.user) {
      throw new Error('This link has expired or was already used. Request a new link from staff login.');
    }
    form.hidden = false;
    tell('Your account is verified. You can now set your password.');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const password = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (password.length < 12 || password.length > 128) { tell('Use 12 to 128 characters.', true); return; }
      if (password !== confirm) { tell('Passwords do not match.', true); return; }
      button.disabled = true;
      try {
        const { error: updateError } = await supabaseClient.auth.updateUser({ password });
        if (updateError) throw updateError;
        form.reset();
        form.hidden = true;
        const { error: signOutError } = await supabaseClient.auth.signOut();
        tell(signOutError ? 'Password saved. Please use Back to staff login to continue.' : 'Password saved. Sign in using your new password.');
      } catch (err) {
        tell(err.message || 'Could not save your password. Please try again.', true);
      } finally { button.disabled = false; }
    });
  } catch (err) {
    history.replaceState(null, '', window.location.pathname);
    tell(err.message, true);
  }
})();
