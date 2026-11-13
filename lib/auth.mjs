import { randomBytes, createHash, pbkdf2, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { createAccount } from '../db/banco.mjs';
import { validateCredentials } from './validacao.mjs';
import R from '../src/core.js';

const derive = promisify(pbkdf2);
const digest = text => createHash('sha256').update(text).digest('hex');
const cookieName = request => new URL(request.url).protocol === 'https:' ? '__Host-repwise_session' : 'repwise_session';
const cookie = (request, token, maxAge = 604800) =>
  `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`;
const tokenOf = request => (request.headers.get('cookie') ?? '').split(';')
  .map(value => value.trim()).find(value => value.startsWith(cookieName(request) + '='))?.split('=')[1] ?? '';
export const json = (body, status = 200, headers = {}) => Response.json(body, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers }
});

export async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const hash = await derive(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha512');
  return { scheme: 'pbkdf2-sha512-100000', salt, hash: hash.toString('hex') };
}
async function passwordMatches(password, stored) {
  const value = JSON.parse(stored);
  if (value.scheme !== 'pbkdf2-sha512-100000') return false;
  const candidate = await passwordHash(password, value.salt);
  return timingSafeEqual(Buffer.from(candidate.hash, 'hex'), Buffer.from(value.hash, 'hex'));
}
export function sessionUser(request, db) {
  const token = tokenOf(request);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db.prepare(`SELECT u.id_usuario, u.email, u.nome, u.demonstracao FROM sessoes_autenticacao s
    JOIN usuarios u ON u.id_usuario = s.id_usuario
    WHERE s.token_hash = ? AND s.expira_em > ? AND (u.expira_em IS NULL OR u.expira_em > ?)`)
    .get(digest(token), Date.now(), Date.now());
  return row ? { userId: row.id_usuario, email: row.email, fullName: row.nome, demo: Boolean(row.demonstracao) } : null;
}
function newSession(request, db, userId, demo = false) {
  const token = randomBytes(32).toString('hex');
  const lifetime = demo ? 86400 : 604800;
  db.prepare('INSERT INTO sessoes_autenticacao VALUES (?, ?, ?)').run(digest(token), userId, Date.now() + lifetime * 1000);
  return cookie(request, token, lifetime);
}
export function limited(db, key, limit) {
  const now = Date.now();
  const window = Math.floor(now / 900000);
  const row = db.prepare(`INSERT INTO tentativas_autenticacao VALUES (?, 1, ?)
    ON CONFLICT(chave) DO UPDATE SET quantidade = quantidade + 1 RETURNING quantidade`)
    .get(digest(key + ':' + window), (window + 1) * 900000);
  return row.quantidade > limit;
}
export async function handleAuth(request, action, db) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'Origem não autorizada.' }, 403);
  }
  try {
    if (action === 'logout') {
      const token = tokenOf(request);
      db.prepare('DELETE FROM sessoes_autenticacao WHERE token_hash = ?').run(digest(token));
      return json({ ok: true }, 200, { 'Set-Cookie': cookie(request, '', 0) });
    }
    if (!['register', 'login', 'demo'].includes(action)) return json({ error: 'Operação não encontrada.' }, 404);
    const client = request.headers.get('x-repwise-client') ?? 'test';
    if (action === 'demo') {
      if (limited(db, 'demo:' + client, 30)) return json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' }, 429);
      if (sessionUser(request, db)) return json({ error: 'Saia da conta antes de iniciar outra demonstração.' }, 409);
      const id = crypto.randomUUID();
      const state = R.seed();
      state.profile.name = 'Visitante';
      const setCookie = createAccount(db, {
        id, email: null, password: null, state, expires: Date.now() + 86400000
      }, () => newSession(request, db, id, true));
      return json({ ok: true }, 201, { 'Set-Cookie': setCookie });
    }
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) {
      return json({ error: 'Envie os dados em JSON.' }, 415);
    }
    let credentials;
    try {
      const raw = await request.text();
      if (raw.length > 4096) return json({ error: 'Formulário muito grande.' }, 413);
      credentials = validateCredentials(JSON.parse(raw), action === 'register');
    } catch {
      return json({ error: action === 'register'
        ? 'Preencha nome, e-mail e senha de 8 a 128 caracteres. A confirmação deve ser igual à senha.'
        : 'Informe um e-mail válido e a senha de 8 a 128 caracteres.' }, 422);
    }
    const { email, password, name } = credentials;
    if (limited(db, action + ':ip:' + client, action === 'register' ? 15 : 50)
      || limited(db, action + ':email:' + email, action === 'register' ? 5 : 15)) {
      return json({ error: 'Muitas tentativas. Aguarde até 15 minutos e tente novamente.' }, 429, { 'Retry-After': '900' });
    }
    if (action === 'register') {
      const id = crypto.randomUUID();
      const state = R.seed(new Date(), false);
      state.profile.name = name;
      const hash = JSON.stringify(await passwordHash(password));
      let setCookie;
      try {
        setCookie = createAccount(db, { id, email, password: hash, state }, () => newSession(request, db, id));
      } catch (error) {
        if (String(error).includes('UNIQUE constraint failed: usuarios.email')) {
          return json({ error: 'Já existe uma conta com este e-mail. Entre na sua conta.' }, 409);
        }
        throw error;
      }
      return json({ ok: true }, 201, { 'Set-Cookie': setCookie });
    }
    const record = db.prepare('SELECT id_usuario, senha_hash FROM usuarios WHERE email = ? AND demonstracao = 0').get(email);
    if (!record) {
      await passwordHash(password, '00000000000000000000000000000000');
      return json({ error: 'E-mail ou senha inválidos.' }, 401);
    }
    if (!await passwordMatches(password, record.senha_hash)) return json({ error: 'E-mail ou senha inválidos.' }, 401);
    return json({ ok: true }, 200, { 'Set-Cookie': newSession(request, db, record.id_usuario) });
  } catch (error) {
    console.error('Falha de autenticação', error.code ?? error.name);
    return json({ error: 'Não foi possível acessar a conta agora. Tente novamente em instantes.' }, 503);
  }
}
