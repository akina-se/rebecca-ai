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
  // Proxy /api/* requests to BFF backend on port 8081
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
        proxyRes.pipe(res);
      }
    );
    proxyReq.on('error', (err) => {
      console.error('[Proxy Error]', err.message);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Bad Gateway: BFF unreachable' }));
    });
    req.pipe(proxyReq);
    return;
  }

  const cleanUrl = (req.url || '/').split('?')[0];
  let filePath = path.join(DIST_DIR, cleanUrl);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(filePath).pipe(res);
  }

  // SPA fallback to index.html
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(indexPath).pipe(res);
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[SPA Server] Running on http://127.0.0.1:${PORT} (Proxying /api/ -> 127.0.0.1:${BFF_PORT})`);
});
