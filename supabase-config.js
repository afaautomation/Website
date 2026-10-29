/**
 * Supabase Configuration & Helper Functions
 * Kompetenzen Website
 * 
 * Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below with your actual
 * credentials from https://supabase.com (Project Settings -> API).
 */

const SUPABASE_URL = "https://lmimmujaqznybtcinwdo.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3Sq9ZteA_RLrGgP-nSx1gA_zncBTMdG";

let supabaseClient = null;

if (typeof supabase !== 'undefined' && SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY") {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Helper to check if Supabase is active
 */
function isSupabaseConfigured() {
  return supabaseClient !== null;
}

/**
 * ===== Shared Auth Helpers (Supabase Auth) =====
 * Used by js/auth-modal.js and the inline auth implementations
 * on index.html and job-details.html.
 */

async function supabaseSignUp(name, email, phone, password) {
  let redirectUrl = 'http://localhost:3000/';
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http')) {
    redirectUrl = window.location.origin + window.location.pathname;
  }
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { name: name, phone: phone },
      emailRedirectTo: redirectUrl
    }
  });
  if (error) throw error;
  return data.user
    ? {
        name: name,
        email: email,
        phone: phone,
        authType: 'Email Signup',
        needsConfirmation: !data.session,
        session: data.session
      }
    : null;
}

// WhatsApp-number login. Supabase issues and checks the OTP; the send-sms-hook Edge Function
// delivers it on WhatsApp. shouldCreateUser:false keeps login from creating accounts.
async function supabaseSendLoginOtp(phone) {
  const { error } = await supabaseClient.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
  if (error) throw error;
}

async function supabaseVerifyLoginOtp(phone, code) {
  const { data, error } = await supabaseClient.auth.verifyOtp({ phone, token: code, type: 'sms' });
  if (error) throw error;
  const user = data.user;
  const meta = (user && user.user_metadata) || {};
  return {
    id: user.id,
    name: meta.name || 'Candidate',
    email: user.email || '',
    phone: meta.phone || (user.phone ? '+' + user.phone : phone),
    authType: 'WhatsApp OTP Login'
  };
}

async function supabaseSendWhatsAppOtp(phone) {
  const response = await fetch(SUPABASE_URL + '/functions/v1/whatsapp-otp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ phone })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.sent) throw new Error(result?.error || 'Could not send the WhatsApp code. Please retry shortly.');
  return result;
}

async function supabasePhoneSignUp(name, email, password, phone, code) {
  const response = await fetch(SUPABASE_URL + '/functions/v1/phone-signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ name, email, password, phone, code })
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.session) throw new Error(result?.error || 'Phone signup is unavailable. Please retry shortly.');
  const { data, error } = await supabaseClient.auth.setSession(result.session);
  if (error || !data.session) throw new Error('Could not save your sign-in session. Please retry.');
  return data;
}

// Where to go after a sign-in started on this page (e.g. a job's apply link).
// Saved with a timestamp and always replaced by the next sign-in attempt, so an
// abandoned sign-in (Google page closed, email link opened much later) cannot
// redirect the visitor into a job application days afterwards.
const PENDING_AUTH_REDIRECT_KEY = 'kompetenzen_pending_auth_redirect';
const PENDING_AUTH_REDIRECT_MAX_AGE_MS = 30 * 60 * 1000;

function savePendingAuthRedirect(url) {
  try {
    if (url) localStorage.setItem(PENDING_AUTH_REDIRECT_KEY, JSON.stringify({ url, at: Date.now() }));
    else localStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
  } catch (e) {}
}

// Returns the saved redirect once, or null if there is none or it has expired.
function takePendingAuthRedirect() {
  try {
    const raw = localStorage.getItem(PENDING_AUTH_REDIRECT_KEY);
    localStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
    const saved = raw && JSON.parse(raw);
    const fresh = saved && typeof saved.url === 'string' && Date.now() - saved.at < PENDING_AUTH_REDIRECT_MAX_AGE_MS;
    return fresh ? saved.url : null;
  } catch (e) {
    return null;
  }
}

async function supabaseSignInWithGoogle(redirectUrl) {
  savePendingAuthRedirect(redirectUrl);
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (error) throw error;
}

/**
 * Extracts access_token and refresh_token from URL hash if returning from OAuth / Email Confirmation.
 */
function extractTokenFromHash() {
  try {
    if (typeof window !== 'undefined' && window.location.hash && window.location.hash.includes('access_token=')) {
      const hash = window.location.hash.replace(/^#/, '');
      const params = new URLSearchParams(hash);
      return {
        accessToken: params.get('access_token'),
        refreshToken: params.get('refresh_token'),
        type: params.get('type')
      };
    }
  } catch (e) {}
  return null;
}

/**
 * Immediately parses and persists Auth session from URL hash on script load.
 */
(function syncOAuthHashImmediately() {
  // This page owns invitation/recovery handling; avoid competing session setup.
  if (/\/admin-password(?:\.html)?\/?$/.test(window.location.pathname)) return;
  const tokens = extractTokenFromHash();
  if (tokens && tokens.type === 'invite') {
    window.location.replace(new URL('admin-password.html', window.location.href).pathname + window.location.hash);
    return;
  }
  if (tokens && tokens.accessToken && tokens.type === 'recovery') {
    // Password-reset link: sign in with the link's session, then ask for a new password.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    const sessionReady = (supabaseClient && tokens.refreshToken)
      ? supabaseClient.auth.setSession({ access_token: tokens.accessToken, refresh_token: tokens.refreshToken }).catch(() => {})
      : Promise.resolve();
    showPasswordRecoveryForm(sessionReady);
    return;
  }
  if (tokens && tokens.accessToken) {
    try {
      localStorage.setItem('token', tokens.accessToken);
      localStorage.setItem('access_token', tokens.accessToken);
      const parts = tokens.accessToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const meta = payload.user_metadata || {};
        const isGoogle = (meta.provider === 'google' || (payload.app_metadata && payload.app_metadata.provider === 'google'));
        const userObj = {
          name: meta.name || meta.full_name || (payload.email ? payload.email.split('@')[0] : 'Candidate'),
          email: payload.email || '',
          phone: meta.phone || '',
          authType: isGoogle ? 'Google Auth' : 'Email Signup',
          loginTime: new Date().toISOString()
        };
        localStorage.setItem('kompetenzen_google_user', JSON.stringify(userObj));
        localStorage.setItem('kompetenzen_user', JSON.stringify(userObj));
        localStorage.setItem('user', JSON.stringify(userObj));
      }

      if (supabaseClient && tokens.refreshToken) {
        supabaseClient.auth.setSession({
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken
        }).catch(() => {});
      }

      // Check for pending redirect after email verification
      const pendingRedirect = takePendingAuthRedirect();
      if (pendingRedirect) {
        setTimeout(() => { window.location.href = pendingRedirect; }, 300);
      }
    } catch (e) {}
  }
})();

/**
 * Shown after a password-reset email link: lets the user choose a new password.
 */
function showPasswordRecoveryForm(sessionReady) {
  const render = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,0.6);display:flex;align-items:center;justify-content:center;padding:16px;';
    overlay.innerHTML =
      '<form style="background:#fff;color:#0f172a;border-radius:16px;padding:24px;width:100%;max-width:380px;font-family:inherit;display:flex;flex-direction:column;gap:10px;">' +
      '<h3 style="margin:0;font-size:1.2rem;">Set a new password</h3>' +
      '<label for="recovery-password" style="font-size:0.85rem;font-weight:600;">New password (min 6 characters)</label>' +
      '<input id="recovery-password" type="password" minlength="6" required autocomplete="new-password" style="padding:10px;border:1px solid #cbd5e1;border-radius:10px;font-size:1rem;">' +
      '<p id="recovery-msg" role="alert" style="margin:0;font-size:0.85rem;min-height:1.2em;"></p>' +
      '<button type="submit" style="padding:11px;border:0;border-radius:999px;background:#1947FF;color:#fff;font-weight:700;cursor:pointer;">Save password</button>' +
      '</form>';
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form'), msg = overlay.querySelector('#recovery-msg');
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const password = overlay.querySelector('#recovery-password').value;
      form.querySelector('button').disabled = true;
      msg.style.color = '#64748b';
      msg.textContent = 'Saving…';
      await Promise.race([sessionReady, new Promise(r => setTimeout(r, 8000))]);
      const { data: current } = await supabaseClient.auth.getSession();
      const { error } = current && current.session
        ? await supabaseClient.auth.updateUser({ password })
        : { error: new Error('This reset link has expired. Please request a new one.') };
      form.querySelector('button').disabled = false;
      msg.style.color = error ? '#B91C1C' : '#15803D';
      msg.textContent = error ? error.message : 'Password updated. You are signed in.';
      if (!error) setTimeout(() => overlay.remove(), 1500);
    });
  };
  if (document.body) render(); else document.addEventListener('DOMContentLoaded', render);
}

async function supabaseGetSessionUser() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data || !data.session || !data.session.user) return null;
  const user = data.session.user;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.name || meta.full_name || user.email,
    email: user.email,
    phone: meta.phone || '',
    authType: (user.app_metadata && user.app_metadata.provider === 'google') ? 'Google Auth' : 'Direct Login'
  };
}

async function supabaseSignOut() {
  try { await supabaseClient.auth.signOut(); } catch (e) {}
}

async function supabaseResetPassword(email) {
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href
  });
  if (error) throw error;
}
