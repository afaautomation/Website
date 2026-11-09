// Cache-busting for the published site. Browsers may keep JS and CSS for hours (Cloudflare's
// Browser Cache TTL), while pages are re-checked on every visit. So each page asks for its own
// scripts and stylesheets with ?v=<content hash>: a changed file gets a new address and is
// fetched straight away, an unchanged file keeps its address and stays cached.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// src/href of a <script> or <link> that points at a local js/, css/ or supabase-config.js file
// (relative, ./ or root-absolute), with any existing ?v=… or other query replaced.
const LOCAL_ASSET = /(<(?:script|link)\b[^>]*?\b(?:src|href)=")((?:\.\/|\/)?(?:(?:js|css)\/[^"?#]+\.(?:m?js|css)|supabase-config\.js))(?:\?[^"#]*)?(")/gi;

function versionAssets(html, hashOf) {
  return html.replace(LOCAL_ASSET, (match, before, file, after) => {
    const version = hashOf(file.replace(/^\.?\//, ''));
    return version ? before + file + '?v=' + version + after : match;
  });
}

// Rewrites every top-level .html file in dir; returns how many references were versioned.
function versionSite(dir) {
  const cache = new Map();
  const hashOf = rel => {
    if (!cache.has(rel)) {
      const file = path.join(dir, rel);
      cache.set(rel, fs.existsSync(file) ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10) : null);
    }
    return cache.get(rel);
  };
  let count = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    const file = path.join(dir, name);
    const before = fs.readFileSync(file, 'utf8');
    const after = versionAssets(before, rel => { const v = hashOf(rel); if (v) count++; return v; });
    if (after !== before) fs.writeFileSync(file, after);
  }
  return count;
}

module.exports = { versionAssets, versionSite };
