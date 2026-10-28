/* Staff login shared by admin.html (HR) and marketing.html (Marketing).
   Each page provides #gate-screen, #gate-form and #admin-main, and the loaders
   it needs (loadApplicationsList, reloadAdminJobs, reloadAdminContent, renderReels);
   verify() calls only the ones the page defines. */
// Staff authorization comes from the authenticated database role.
(function () {
  const gate = document.getElementById('gate-screen'), main = document.getElementById('admin-main');
  const form = document.getElementById('gate-form'), input = document.getElementById('gate-key');
  const emailInput = document.getElementById('gate-email');
  const error = document.getElementById('gate-error');
  const success = document.getElementById('gate-success');
  let verificationVersion = 0;

  function clearNotices() {
    if (error) {
      error.textContent = '';
      if (error.classList && typeof error.classList.remove === 'function') {
        error.classList.remove('is-visible');
      }
    }
    if (success) {
      success.textContent = '';
      if (success.classList && typeof success.classList.remove === 'function') {
        success.classList.remove('is-visible');
      }
    }
  }

  function lock() {
    window.stopAutomaticApplicantReview?.();
    window.LocalApplicantAI?.reset();
    document.getElementById('applicant-details-dialog')?.close?.();
    if (typeof matchingRequest !== 'undefined') ++matchingRequest;
    verificationVersion++;
    gate.style.display = ''; main.style.display = 'none';
    if (input) input.value = '';
    const lockBtn = document.getElementById('btn-lock-console');
    if (lockBtn) lockBtn.style.display = 'none';
    // HR page only: drop the loaded applicants so they are not left in memory.
    if (typeof allCandidateApplications !== 'undefined') allCandidateApplications = [];
    const apps = document.getElementById('apps-container');
    if (apps) apps.replaceChildren();
  }

  async function verify() {
    lock();
    const version = verificationVersion;
    if (!isSupabaseConfigured()) throw new Error('Database connection is unavailable.');
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return;
    const { data: admin, error: roleError } = await supabaseClient.rpc('is_admin');
    if (version !== verificationVersion) return;
    if (roleError) throw roleError;
    if (admin !== true) throw new Error('This account does not have staff access. Contact the owner for an invitation.');
    gate.style.display = 'none'; main.style.display = 'block';
    const lockBtn = document.getElementById('btn-lock-console');
    if (lockBtn) lockBtn.style.display = 'inline-flex';
    if (window.loadApplicationsList) window.loadApplicationsList();
    if (window.renderLeads) window.renderLeads();
    if (window.reloadAdminJobs) window.reloadAdminJobs();
    if (window.reloadAdminContent) window.reloadAdminContent();
    if (window.renderReels) window.renderReels();
  }

  function showError(err) {
    clearNotices();
    if (error) {
      error.textContent = (err && err.message) || err || 'Sign-in failed. Please try again.';
      error.classList.add('is-visible');
    }
  }

  function showSuccess(msg) {
    clearNotices();
    if (success) {
      success.textContent = msg;
      success.classList.add('is-visible');
    }
  }

  // LOGIN (Existing Staff)
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      clearNotices();
      const email = (emailInput ? emailInput.value : '').trim().toLowerCase();
      const password = input ? input.value : '';
      const button = form.querySelector('button');
      if (button) button.disabled = true;

      try {
        const { error: signInError } = await supabaseClient.auth.signInWithPassword({
          email,
          password
        });
        if (signInError) throw signInError;
        await verify();
      } catch (err) {
        lock();
        showError(err);
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  const forgot = document.getElementById('gate-forgot-password');
  let recoveryAfter = 0;
  forgot.addEventListener('click', async () => {
    clearNotices();
    if (!emailInput.reportValidity() || !emailInput.value.trim()) return;
    if (Date.now() < recoveryAfter) { showError('Please wait a minute before requesting another link.'); return; }
    forgot.disabled = true;
    recoveryAfter = Date.now() + 60000;
    try {
      const { error: resetError } = await supabaseClient.auth.resetPasswordForEmail(emailInput.value.trim(), {
        redirectTo: new URL('admin-password.html', window.location.href).href
      });
      if (resetError) throw resetError;
      showSuccess('If this email has an account, a password reset link will arrive shortly.');
    } catch (err) {
      showError('Unable to send a reset link right now. Please wait and try again.');
    } finally { forgot.disabled = false; }
  });

  window.adminSignOut = async function () {
    lock();
    if (supabaseClient) {
      const { error: err } = await supabaseClient.auth.signOut();
      if (err) showError(err);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    verify().catch(showError);
    if (supabaseClient) {
      supabaseClient.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') lock();
        // Keep Supabase calls outside the auth event callback.
        if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          setTimeout(() => verify().catch(showError), 0);
        }
      });
    }
  });
})();
