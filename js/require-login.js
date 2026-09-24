/**
 * Kompetenzen — sign-in gate for member-only pages (job listings, job details).
 *
 * Load this AFTER supabase-config.js, js/auth-modal.js and js/payment-modal.js.
 *
 * Mode is set on the script tag:
 *   <script src="js/require-login.js" data-require="login"></script>  (default)
 *   <script src="js/require-login.js" data-require="pro"></script>
 *
 * Scope note: this overlay is a user-experience gate, not the security boundary.
 * The boundary is in the database — `hr_jobs` carries a
 * `for select to authenticated` policy, so a signed-out visitor who removes
 * this overlay from devtools still receives an empty result set. Both layers
 * are needed: the policy stops the data leaving, this stops people staring at
 * an inexplicably empty page.
 */
(function () {
  'use strict';

  const OVERLAY_ID = 'kompetenzen-login-gate';

  // "login" = any signed-in member; "pro" = an active Career Pro Pass.
  const REQUIREMENT = (function () {
    const tag = document.currentScript;
    const value = tag && tag.getAttribute('data-require');
    return value === 'pro' ? 'pro' : 'login';
  })();

  function injectStyles() {
    if (document.getElementById('kp-login-gate-styles')) return;
    const style = document.createElement('style');
    style.id = 'kp-login-gate-styles';
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 99990;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: rgba(8, 10, 17, 0.92);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        font-family: 'Google Sans', 'Outfit', 'Plus Jakarta Sans', system-ui, sans-serif;
      }
      #${OVERLAY_ID} .kp-gate-card {
        width: 100%;
        max-width: 440px;
        background: #0F172A;
        border: 1px solid rgba(59, 130, 246, 0.3);
        border-radius: 22px;
        padding: 36px 32px;
        text-align: center;
        color: #F8FAFC;
        box-shadow: 0 24px 64px -18px rgba(0, 0, 0, 0.8);
      }
      #${OVERLAY_ID} .kp-gate-icon {
        width: 54px; height: 54px;
        border-radius: 16px;
        margin: 0 auto 18px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(59, 130, 246, 0.16);
        font-size: 24px;
      }
      #${OVERLAY_ID} h2 {
        font-size: 21px; font-weight: 800; margin: 0 0 10px;
        letter-spacing: -0.02em;
      }
      #${OVERLAY_ID} p {
        font-size: 14px; line-height: 1.6; color: #94A3B8; margin: 0 0 24px;
      }
      #${OVERLAY_ID} .kp-gate-actions {
        display: flex; flex-direction: column; gap: 10px;
      }
      #${OVERLAY_ID} button, #${OVERLAY_ID} a.kp-gate-secondary {
        font: inherit;
        font-size: 14px; font-weight: 700;
        padding: 12px 22px;
        border-radius: 99px;
        border: none;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex; align-items: center; justify-content: center;
        transition: transform 0.15s ease, background 0.15s ease;
      }
      #${OVERLAY_ID} .kp-gate-primary {
        background: #2563EB; color: #FFFFFF;
      }
      #${OVERLAY_ID} .kp-gate-primary:hover { background: #1D4ED8; transform: translateY(-1px); }
      #${OVERLAY_ID} .kp-gate-secondary {
        background: transparent; color: #94A3B8;
        border: 1px solid rgba(255,255,255,0.14);
      }
      #${OVERLAY_ID} .kp-gate-secondary:hover { color: #E2E8F0; }
      @media (max-width: 480px) {
        #${OVERLAY_ID} .kp-gate-card { padding: 28px 20px; }
      }
    `;
    document.head.appendChild(style);
  }

  function showGate(reason) {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      if (existing.getAttribute('data-reason') === reason) return;
      existing.remove();
    }
    injectStyles();

    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'kp-gate-title');
    overlay.setAttribute('data-reason', reason);
    const needsPayment = reason === 'pro';
    overlay.innerHTML = needsPayment
      ? `
      <div class="kp-gate-card">
        <div class="kp-gate-icon">&#11088;</div>
        <h2 id="kp-gate-title">Unlock this opening</h2>
        <p>
          Full job details, requirements and direct applications are part of the
          Career Pro Pass &mdash; &#8377;499 for a year, covering every opening
          plus the Resume Builder.
        </p>
        <div class="kp-gate-actions">
          <button type="button" class="kp-gate-primary" id="kp-gate-pay">Get Career Pro Pass (&#8377;499)</button>
          <a class="kp-gate-secondary" href="jobs.html">Back to all openings</a>
        </div>
      </div>
    `
      : `
      <div class="kp-gate-card">
        <div class="kp-gate-icon">&#128274;</div>
        <h2 id="kp-gate-title">Sign in to view job openings</h2>
        <p>
          Our live openings are available to registered Kompetenzen candidates.
          Creating an account is free and takes about a minute.
        </p>
        <div class="kp-gate-actions">
          <button type="button" class="kp-gate-primary" id="kp-gate-signin">Sign in / Create account</button>
          <a class="kp-gate-secondary" href="index.html">Back to home</a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    const signInBtn = document.getElementById('kp-gate-signin');
    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        if (typeof window.openAuthModal === 'function') {
          window.openAuthModal('signup', window.location.href);
        } else {
          // Pages without the shared auth modal fall back to the home page,
          // which always has it.
          window.location.href = 'index.html#jobs-auth';
        }
      });
    }

    const payBtn = document.getElementById('kp-gate-pay');
    if (payBtn) {
      payBtn.addEventListener('click', function () {
        if (typeof window.openPaymentModal === 'function') {
          // Reload on success so the page re-fetches with the new entitlement.
          window.openPaymentModal('job_details', function () { window.location.reload(); });
        } else {
          window.location.href = 'jobs.html';
        }
      });
    }
  }

  function hideGate() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
  }

  async function evaluate() {
    // Fail closed: if the auth client is unavailable we show the gate rather
    // than assuming the visitor is signed in.
    if (typeof supabaseClient === 'undefined' || !supabaseClient) {
      showGate('login');
      return;
    }

    let signedIn = false;
    try {
      const { data } = await supabaseClient.auth.getSession();
      signedIn = !!(data && data.session && data.session.user);
    } catch (e) {
      signedIn = false;
    }

    if (!signedIn) {
      showGate('login');
      return;
    }

    if (REQUIREMENT === 'login') {
      hideGate();
      return;
    }

    // "pro" mode: ask the server, which reads the subscriptions table.
    let isPro = false;
    try {
      if (typeof window.refreshProStatus === 'function') {
        const status = await window.refreshProStatus();
        isPro = !!(status && status.isPro);
      }
    } catch (e) {
      isPro = false;
    }

    if (isPro) hideGate(); else showGate('pro');
  }

  function start() {
    evaluate();
    if (typeof supabaseClient !== 'undefined' && supabaseClient) {
      supabaseClient.auth.onAuthStateChange(function () { evaluate(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
