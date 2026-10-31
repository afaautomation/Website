// Cloudflare Pages Function: serves an Instagram reel's cover image at /reel-cover/<shortcode>.
// The homepage reel carousel shows these covers instead of full Instagram embeds, which are
// heavy. Instagram's image URLs are signed and expire, so the cover is fetched here and kept
// in Cloudflare's edge cache for a week; a failure returns 404 and the page falls back to the embed.
const SHORTCODE = /^[A-Za-z0-9_-]{6,64}$/;
const WEEK = 7 * 24 * 60 * 60;

export async function onRequest({ request, params, waitUntil }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  const id = String(params.id || '');
  if (!SHORTCODE.test(id)) return new Response('Not found', { status: 404 });

  const cacheKey = new Request(new URL(`/reel-cover/${id}`, request.url).href, { method: 'GET' });
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const cached = cache && await cache.match(cacheKey);
  if (cached) return cached;

  let upstream;
  try {
    upstream = await fetch(`https://www.instagram.com/p/${id}/media/?size=l`, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KompetenzenReelCover/1.0)' }
    });
  } catch {
    return new Response('Cover unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const type = upstream.headers.get('Content-Type') || '';
  if (!upstream.ok || !type.startsWith('image/')) {
    return new Response('Cover unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const response = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=86400, s-maxage=${WEEK}`,
      'X-Content-Type-Options': 'nosniff'
    }
  });
  if (cache) {
    const store = cache.put(cacheKey, response.clone());
    if (waitUntil) waitUntil(store); else await store;
  }
  return response;
}
