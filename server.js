const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.json': 'application/json',
  '.ico': 'image/x-icon'
};

// Local development only: never serve files outside the site, private folders, or dotfiles.
const BLOCKED = /(^|[\\/])(\.|node_modules([\\/]|$)|Resume[\\/]backend([\\/]|$))|\.(sql|md|py|env|log)$/i;

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<h1>404 Not Found</h1>');
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Allow': 'GET, HEAD' });
    res.end();
    return;
  }

  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  if (reqPath === '/') {
    reqPath = '/index.html';
  }

  const filePath = path.resolve(PUBLIC_DIR, '.' + path.posix.normalize('/' + reqPath));
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (reqPath.includes('\0') || relative.startsWith('..') || path.isAbsolute(relative) || BLOCKED.test(relative) || relative === 'server.js') {
    notFound(res);
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      serveFile(filePath, res);
      return;
    }

    let htmlPath = filePath + '.html';
    fs.stat(htmlPath, (err2, stats2) => {
      if (!err2 && stats2.isFile()) {
        serveFile(htmlPath, res);
        return;
      }

      notFound(res);
    });
  });
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

// Bound to this computer only; other devices on the network cannot reach it.
server.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
