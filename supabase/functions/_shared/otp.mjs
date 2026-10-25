// Signup OTP helpers shared by whatsapp-otp (sends codes) and phone-signup (checks them).

// Signup is limited to Indian mobile numbers, matching the browser form.
export const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

export function allowedOrigins(env) {
  return new Set(['https://kompetenzen.pages.dev', 'https://kompetenzen.in', 'https://www.kompetenzen.in', 'http://localhost:5500', 'http://127.0.0.1:5500', env('SITE_URL')]);
}

// JSON responder with CORS for allowed browser origins. `early` is set for preflight and rejected requests.
export function jsonEndpoint(request, allowed) {
  const origin = request.headers.get('origin');
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
    ...(allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
  const respond = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
  let early = null;
  if (origin && !allowed.has(origin)) early = respond({ error: 'Website not authorised' }, 403);
  else if (request.method === 'OPTIONS') early = new Response(null, { status: 204, headers });
  else if (request.method !== 'POST') early = respond({ error: 'Method not allowed' }, 405);
  return { respond, early };
}

// Uniform 6-digit code from the platform CSPRNG.
export function newCode() {
  const buffer = new Uint32Array(1);
  do crypto.getRandomValues(buffer); while (buffer[0] >= 4294000000);
  return String(buffer[0] % 1000000).padStart(6, '0');
}

// Keyed hash so a database leak does not reveal live codes (6 digits are trivial to brute-force unkeyed).
export async function otpHash(secret, phone, code) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(phone + ':' + code)));
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function serviceHeaders(key) {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
