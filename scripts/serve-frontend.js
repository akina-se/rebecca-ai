/**
 * @file serve-frontend.js
 * @description Lightweight Local Static Asset Web Server & API Reverse Proxy for E2E / Development.
 *
 * Architecture Role:
 *   In production, Firebase Hosting serves static Angular SPA bundles from Global CDN edge caches
 *   and automatically rewrites `/api/**` routes directly to the Cloud Run Dashboard BFF container.
 *   In local development and Playwright E2E test environments, this server simulates the Firebase
 *   Hosting reverse-proxy layer by:
 *     1. Serving compiled Angular 18 assets (`apps/dashboard-frontend/dist/dashboard-frontend/browser`)
 *        with proper MIME types and path traversal protections.
 *     2. Routing single-page application (SPA) client-side routes fallback to `index.html`.
 *     3. Transparently proxying all `/api/*` HTTP requests to the local Express BFF server (port 8081).
 *
 * Usage:
 *   node scripts/serve-frontend.js
 *   (Listens on http://127.0.0.1:4200, forwards /api/* to http://127.0.0.1:8081)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4200;
const BFF_PORT = 8081;
const DIST_DIR = path.resolve(__dirname, '../apps/dashboard-frontend/dist/dashboard-frontend/browser');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // 1. Reverse Proxy: forward /api/* requests to BFF backend running on port 8081
  if ((req.url || '').startsWith('/api/')) {
    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port: BFF_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${BFF_PORT}` },
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
        proxyRes.on('data', (chunk) => res.write(chunk));
        proxyRes.on('end', () => res.end());
      }
    );
    proxyReq.on('error', (err) => {
      const safeMsg = String(err?.message || '').replace(/[\r\n]/g, '');
      console.error('[Proxy Error] %s', safeMsg);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway: Dashboard BFF unreachable' }));
    });
    if (req.method === 'GET' || req.method === 'HEAD') {
      proxyReq.end();
    } else {
      req.pipe(proxyReq);
    }
    return;
  }

  // 2. Static File Resolution: resolve safe path within DIST_DIR
  const rawUrl = (req.url || '/').split('?')[0];
  const safeRelativePath = path.normalize(rawUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.resolve(DIST_DIR, '.' + path.sep + safeRelativePath);

  // Security Guard: Prevent directory/path traversal attacks
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Attempt direct file read (atomic operation without TOCTOU race conditions)
  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Content-Length': content.length
    });
    return res.end(content);
  } catch (_err) {
    // Fall through to SPA fallback if file not found, directory, or not readable
  }

  // 3. SPA Fallback: return index.html for Angular client-side router navigation
  const indexPath = path.join(DIST_DIR, 'index.html');
  try {
    const content = fs.readFileSync(indexPath);
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': content.length
    });
    return res.end(content);
  } catch (_err) {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SPA Server] Running on http://127.0.0.1:${PORT} (Proxying /api/ -> 127.0.0.1:${BFF_PORT})`);
});
