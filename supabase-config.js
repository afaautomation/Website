/**
 * Supabase Configuration & Helper Functions
 * Kompetenzen Website
 * 
 * Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below with your actual
 * credentials from https://supabase.com (Project Settings -> API).
 */

const SUPABASE_URL = "https://xgnluardsgflfxttvgwc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_OTub68LVVtzOUFHG3tt-8g_dF9X0ECf";

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
 * Kompetenzen API base.
 *
 * All money and all entitlement decisions happen here, on the server. The
 * Razorpay Key ID is issued per-checkout by POST /api/payments/create-order —
 * it is deliberately NOT stored in the browser any more. The previous version
 * read it from localStorage and fell back to a prompt(), which let a visitor
 * substitute their own Razorpay account and "pay" themselves into Pro.
 */
const KOMPETENZEN_API_BASE = (function () {
  const host = window.location.hostname || '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' ||
    host.startsWith('192.168.') || host.startsWith('10.');
  if (isLocalDev) return 'http://localhost:5000/api';
  return 'https://afaautomation-resume.hf.space/api';
})();

/**
 * Attaches the caller's Supabase access token to an API request.
 * Returns null when nobody is signed in — callers must treat that as "not Pro"
 * rather than falling back to any locally cached claim.
 */
async function kompetenzenAuthHeaders() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getSession();
  const token = data && data.session && data.session.access_token;
  if (!token) return null;
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
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

async function supabaseSignIn(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });
  if (error) throw error;
  const meta = (data.user && data.user.user_metadata) || {};
  return {
    name: meta.name || email,
    email: data.user.email,
    phone: meta.phone || '',
    authType: 'Direct Login'
  };
}

async function supabaseSignInWithGoogle(redirectUrl) {
  try {
    if (redirectUrl) localStorage.setItem('kompetenzen_pending_auth_redirect', redirectUrl);
  } catch (e) {}
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
        refreshToken: params.get('refresh_token')
      };
    }
  } catch (e) {}
  return null;
}

/**
 * Immediately parses and persists Auth session from URL hash on script load.
 */
(function syncOAuthHashImmediately() {
  const tokens = extractTokenFromHash();
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
      const pendingRedirect = localStorage.getItem('kompetenzen_pending_auth_redirect');
      if (pendingRedirect) {
        localStorage.removeItem('kompetenzen_pending_auth_redirect');
        setTimeout(() => { window.location.href = pendingRedirect; }, 300);
      }
    } catch (e) {}
  }
})();

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
