import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, relative, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase, catalog } from './db/banco.mjs';
import { handleAuth, sessionUser, json } from './lib/auth.mjs';
import { handleAccount } from './lib/account-api.mjs';
import { handleAssistant, ollamaConfig } from './lib/assistente.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? '127.0.0.1';
const origin = process.env.APP_ORIGIN ?? `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`;
const db = openDatabase(resolve(process.env.REPWISE_DB ?? resolve(root, 'dados/repwise.sqlite')));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.json': 'application/json; charset=utf-8' };

async function bodyOf(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2_000_000) throw Object.assign(new Error('Os dados excedem o limite de 2 MB.'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin);
    let result;
    if (url.pathname.startsWith('/api/')) {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (value !== undefined && name !== 'x-repwise-client') headers.set(name, String(value));
      }
      headers.set('x-repwise-client', req.socket.remoteAddress ?? 'unknown');
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await bodyOf(req);
      const request = new Request(url, { method: req.method, headers, body });
      if (url.pathname === '/api/catalog' && req.method === 'GET') {
        result = json({ exercises: catalog(db) });
      } else if (/^\/api\/auth\/[a-z]+$/.test(url.pathname)) {
        result = await handleAuth(request, url.pathname.split('/').at(-1), db);
      } else if (/^\/api\/assistant\/(message|proposal)$/.test(url.pathname)) {
        result = await handleAssistant(request, url.pathname.split('/').at(-1), sessionUser(request, db), db);
      } else if (url.pathname === '/api/account') {
        result = await handleAccount(request, sessionUser(request, db), db);
      } else {
        result = json({ error: 'Operação não encontrada.' }, 404);
      }
    } else {
      if (!['GET', 'HEAD'].includes(req.method)) {
        result = json({ error: 'Método não permitido.' }, 405);
      } else {
        const target = resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
        const path = relative(root, target);
        const top = path.split(/[\\/]/)[0];
        if (path.startsWith('..') || !['index.html', 'manifest.webmanifest', 'src', 'assets'].includes(top)) {
          result = new Response('Não encontrado', { status: 404 });
        } else {
          try {
            const file = await readFile(target);
            result = new Response(file, { headers: { 'Content-Type': types[extname(target)] ?? 'application/octet-stream' } });
          } catch {
            result = new Response('Não encontrado', { status: 404 });
          }
        }
      }
    }
    result.headers.set('Cache-Control', 'no-store');
    result.headers.set('X-Content-Type-Options', 'nosniff');
    result.headers.set('Referrer-Policy', 'same-origin');
    res.writeHead(result.status, Object.fromEntries(result.headers));
    res.end(req.method === 'HEAD' ? undefined : Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    res.writeHead(error.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error.status ? error.message : 'Não foi possível concluir a operação.' }));
  }
});
function cleanup() {
  db.prepare('DELETE FROM usuarios WHERE demonstracao = 1 AND expira_em < ?').run(Date.now());
  db.prepare('DELETE FROM sessoes_autenticacao WHERE expira_em < ?').run(Date.now());
  db.prepare('DELETE FROM tentativas_autenticacao WHERE expira_em < ?').run(Date.now());
}
cleanup();
const timer = setInterval(cleanup, 900000);
timer.unref();
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `A porta ${port} já está em uso.` : error.message);
  process.exitCode = 1;
});
server.listen(port, host, () => console.log(`RepWise AI 0.6.0 disponível em ${origin}\nAssistente: Ollama em ${ollamaConfig.url} com o modelo ${ollamaConfig.model}\nUse Ctrl+C para encerrar.`));
function shutdown() {
  clearInterval(timer);
  server.close(() => { db.close(); });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
