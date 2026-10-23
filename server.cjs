const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let requested;
  try { requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const target = path.resolve(root, '.' + (requested === '/' ? '/index.html' : requested));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative) || !['index.html', 'manifest.webmanifest', 'src', 'assets'].includes(relative.split(path.sep)[0])) { res.writeHead(404).end('Não encontrado'); return; }
  fs.readFile(target, (err, data) => {
    if (err) { res.writeHead(404).end('Não encontrado'); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(data);
  });
});
server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? `A porta ${port} já está em uso. Abra http://localhost:${port} ou defina outra PORT.` : err.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`RepWise AI disponível em http://localhost:${port}\nUse Ctrl+C para encerrar.`));
