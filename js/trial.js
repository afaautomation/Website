/**
 * Kompetenzen — free trial (3 job applications + 3 resume downloads).
 *
 * Load AFTER supabase-config.js. Exposes window.KompetenzenTrial.
 *
 * The browser only displays the counters. Every decision is made in the
 * database: apply_to_job() takes the credit and records the application in
 * one transaction, and trial_status() reports what is left (see
 * supabase_schema.sql section 11). Nothing here reads localStorage for
 * entitlement, so editing browser storage cannot unlock anything.
 */
(function () {
  'use strict';

  let cachedStatus = null;

  async function getSession() {
    if (typeof supabaseClient === 'undefined' || !supabaseClient) return null;
    try {
      const { data } = await supabaseClient.auth.getSession();
      return (data && data.session) || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * { is_pro, limit, applications_left, downloads_left, has_profile },
   * or null when signed out or the database is unreachable.
   */
  async function status(force) {
    if (cachedStatus && !force) return cachedStatus;
    if (!(await getSession())) return null;
    try {
      const { data, error } = await supabaseClient.rpc('trial_status');
      if (error || !data) return null;
      cachedStatus = data;
      renderCounters(data);
      return data;
    } catch (e) {
      return null;
    }
  }

  /**
   * Submits an application for the signed-in candidate.
   * Resolves to the apply_to_job() result: { status, apply_url?, applications_left?, is_pro? }.
   * status: applied | already_applied | profile_required | trial_exhausted |
   *         auth_required | job_not_found | error
   */
  async function applyToJob(jobId) {
    if (!(await getSession())) return { status: 'auth_required' };
    try {
      const { data, error } = await supabaseClient.rpc('apply_to_job', { p_job_id: jobId });
      if (error) {
        // A duplicate submission racing this one raises inside the function.
        if (/already submitted/i.test(error.message || '')) return { status: 'already_applied' };
        // PGRST202 here means supabase_schema.sql section 11 has not been run.
        console.error('apply_to_job failed:', error);
        return { status: 'error', message: error.message };
      }
      cachedStatus = null;
      status(true);
      return data || { status: 'error' };
    } catch (e) {
      return { status: 'error', message: e && e.message };
    }
  }

  function applicationsText(s) {
    if (!s) return '';
    if (s.is_pro) return '★ Career Pro active — unlimited applications';
    const left = s.applications_left;
    if (left <= 0) return 'Free applications used · Career Pro unlocks unlimited';
    return `${left} of ${s.limit} free applications left`;
  }

  /**
   * Fills any element marked data-trial-counter="applications" | "downloads".
   * Shows [data-trial-show="anon"] (sign-up prompts) only to signed-out
   * visitors, and [data-trial-show="low"] (upgrade prompts) only to signed-in,
   * non-Pro users with at most one free application left.
   */
  function renderCounters(s) {
    document.querySelectorAll('[data-trial-counter="applications"]').forEach(el => {
      el.textContent = applicationsText(s);
      el.style.display = s ? '' : 'none';
    });
    document.querySelectorAll('[data-trial-counter="downloads"]').forEach(el => {
      if (!s || s.is_pro) { el.style.display = 'none'; return; }
      el.textContent = s.downloads_left > 0
        ? `${s.downloads_left} of ${s.limit} free resume downloads left`
        : 'Free resume downloads used';
      el.style.display = '';
    });
    document.querySelectorAll('[data-trial-show="low"]').forEach(el => {
      const low = !!s && !s.is_pro && s.applications_left <= 1;
      el.style.display = low ? '' : 'none';
    });
    document.querySelectorAll('[data-trial-show="anon"]').forEach(el => {
      el.style.display = s ? 'none' : '';
    });
  }

  window.KompetenzenTrial = { getSession, status, applyToJob, applicationsText, renderCounters };

  function init() {
    status(true).then(s => { if (!s) renderCounters(null); });
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      supabaseClient.auth.onAuthStateChange(function () {
        cachedStatus = null;
        status(true).then(s => { if (!s) renderCounters(null); });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
