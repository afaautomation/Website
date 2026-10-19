// WhatsApp Cloud API (Meta) helpers shared by the worker and the inbound webhook.

// Approved template name per notification event. Override with WHATSAPP_TEMPLATE_<EVENT>.
export const DEFAULT_TEMPLATES = {
  received: 'application_received',
  matched: 'application_matched',
  not_matched: 'application_not_matched',
  hr_status: 'application_status_update',
  digest: 'job_digest'
};

// Template parameters may not contain newlines, tabs or more than four consecutive spaces.
const param = (text, max) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, max);

// Request body for POST /{phone-number-id}/messages. Body variables: {{1}} role/title, {{2}} update text.
export function templateMessage(destination, templateName, language, title, text) {
  return {
    messaging_product: 'whatsapp',
    to: String(destination).replace(/^\+/, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: [{ type: 'body', parameters: [
        { type: 'text', text: param(title, 200) || 'Kompetenzen' },
        { type: 'text', text: param(text, 700) }
      ] }]
    }
  };
}

// Meta reports throttling as HTTP 400/429 with these error codes; treat them as an explicit
// rate-limit rejection (safe to retry). Anything else keeps its real HTTP status.
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131056]);
export function effectiveStatus(httpStatus, errorCode) {
  return RATE_LIMIT_CODES.has(Number(errorCode)) ? 429 : httpStatus;
}

// X-Hub-Signature-256: "sha256=" + hex HMAC-SHA256(app secret, raw request body).
export async function validSignature(appSecret, rawBody, header) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = 'sha256=' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  let difference = expected.length ^ header.length;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (header.charCodeAt(i) || 0);
  return difference === 0;
}

const STOP_WORDS = /^(stop|unsubscribe|cancel|end|quit|stop all)$/i;

// Senders (E.164, with +) who replied with an opt-out keyword.
export function optOutSenders(payload) {
  const numbers = new Set();
  for (const entry of payload?.entry || []) for (const change of entry.changes || []) {
    for (const m of change.value?.messages || []) {
      const said = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? '';
      const phone = '+' + String(m.from || '').replace(/\D/g, '');
      if (STOP_WORDS.test(String(said).trim()) && /^\+[1-9]\d{7,14}$/.test(phone)) numbers.add(phone);
    }
  }
  return [...numbers];
}

// Messages Meta accepted but later could not deliver: [{ id, code }].
export function failedDeliveries(payload) {
  const failed = [];
  for (const entry of payload?.entry || []) for (const change of entry.changes || []) {
    for (const s of change.value?.statuses || []) {
      if (s.status === 'failed' && s.id) failed.push({ id: s.id, code: s.errors?.[0]?.code ?? null });
    }
  }
  return failed;
}
