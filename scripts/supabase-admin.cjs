const fs = require('fs');
const path = require('path');

let cachedAdmin = null;

function getSupabaseAdmin() {
  if (cachedAdmin) return cachedAdmin;

  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseUrl = process.env.SUPABASE_URL || 'https://lmimmujaqznybtcinwdo.supabase.co';

  try {
    const envPath = path.join(__dirname, '..', 'Resume', 'backend', '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const val = match[2].trim();
          if (key === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceRoleKey) serviceRoleKey = val;
          if (key === 'SUPABASE_URL' && (!process.env.SUPABASE_URL)) supabaseUrl = val;
        }
      }
    }
  } catch (_) {}

  if (!serviceRoleKey || !supabaseUrl) return null;

  try {
    const { createClient } = require('../Resume/backend/node_modules/@supabase/supabase-js');
    cachedAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    return cachedAdmin;
  } catch (_) {
    return null;
  }
}

module.exports = { getSupabaseAdmin };
