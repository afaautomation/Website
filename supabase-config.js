/**
 * Supabase Configuration & Helper Functions
 * Kompetenzen Website
 * 
 * Replace YOUR_SUPABASE_URL and YOUR_SUPABASE_ANON_KEY below with your actual
 * credentials from https://supabase.com (Project Settings -> API).
 */

const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

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
