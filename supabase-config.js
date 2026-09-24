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
  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { name: name, phone: phone }
    }
  });
  if (error) throw error;
  return data.user
    ? { name: name, email: email, phone: phone, authType: 'Email Signup' }
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

async function supabaseGetSessionUser() {
  const { data } = await supabaseClient.auth.getSession();
  if (!data || !data.session || !data.session.user) return null;
  const user = data.session.user;
  const meta = user.user_metadata || {};
  return {
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
