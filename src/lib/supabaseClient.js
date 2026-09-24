import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xgnluardsgflfxttvgwc.supabase.co";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_OTub68LVVtzOUFHG3tt-8g_dF9X0ECf";

export const supabase = (typeof window !== 'undefined' || SUPABASE_URL) 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      }
    })
  : null;

export const KOMPETENZEN_API_BASE = (() => {
  if (typeof window === 'undefined') return 'https://afaautomation-resume.hf.space/api';
  const host = window.location.hostname || '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1' ||
    host.startsWith('192.168.') || host.startsWith('10.');
  if (isLocalDev) return 'http://localhost:5000/api';
  return 'https://afaautomation-resume.hf.space/api';
})();

export async function kompetenzenAuthHeaders() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) return null;
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

export async function supabaseSignUp(name, email, phone, password) {
  if (!supabase) throw new Error("Supabase is not initialized");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, phone }
    }
  });
  if (error) throw error;
  return data.user
    ? { name, email, phone, authType: 'Email Signup' }
    : null;
}

export async function supabaseSignIn(email, password) {
  if (!supabase) throw new Error("Supabase is not initialized");
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (error) throw error;
  const meta = data.user?.user_metadata || {};
  return {
    name: meta.name || email,
    email: data.user.email,
    phone: meta.phone || '',
    authType: 'Direct Login'
  };
}

export async function supabaseSignInWithGoogle(redirectUrl) {
  if (!supabase) throw new Error("Supabase is not initialized");
  if (typeof window !== 'undefined' && redirectUrl) {
    try {
      localStorage.setItem('kompetenzen_pending_auth_redirect', redirectUrl);
    } catch (e) {}
  }
  const redirectTo = typeof window !== 'undefined' ? window.location.href : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  });
  if (error) throw error;
}

export async function supabaseGetSessionUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (!data?.session?.user) return null;
  const user = data.session.user;
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.name || meta.full_name || user.email,
    email: user.email,
    phone: meta.phone || '',
    authType: (user.app_metadata?.provider === 'google') ? 'Google Auth' : 'Direct Login'
  };
}

export async function supabaseSignOut() {
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch (e) {}
}

export async function supabaseResetPassword(email) {
  if (!supabase) throw new Error("Supabase is not initialized");
  const redirectTo = typeof window !== 'undefined' ? window.location.href : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo
  });
  if (error) throw error;
}
