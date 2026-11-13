import { validateState } from './validacao.mjs';
import { readAccount, updateAccount } from '../db/banco.mjs';
import { json } from './auth.mjs';

export async function handleAccount(request, user, db) {
  if (!['GET', 'PUT'].includes(request.method)) return json({ error: 'Método não permitido.' }, 405);
  if (request.method === 'PUT' && (request.headers.get('origin') !== new URL(request.url).origin
    || request.headers.get('sec-fetch-site') === 'cross-site')) {
    return json({ error: 'Origem não autorizada.' }, 403);
  }
  if (!user) return request.method === 'GET' ? json({ user: null }) : json({ error: 'Entre na sua conta para continuar.' }, 401);
  try {
    if (request.method === 'GET') {
      return json({
        user: { id: user.userId, email: user.email, name: user.fullName, demo: user.demo },
        account: readAccount(db, user.userId)
      });
    }
    if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return json({ error: 'Envie dados em JSON.' }, 415);
    const raw = await request.text();
    if (Buffer.byteLength(raw) > 2_000_000) return json({ error: 'Os dados excedem o limite de 2 MB. Exporte um backup.' }, 413);
    let body, state;
    try {
      body = JSON.parse(raw);
      state = validateState(body.state);
      if (!Number.isSafeInteger(body.revision) || body.revision < 1) throw new Error('Versão dos dados inválida.');
    } catch {
      return json({ error: 'Revise os dados do perfil e dos treinos.' }, 422);
    }
    const result = updateAccount(db, user.userId, body.revision, state);
    return result ? json(result) : json({ error: 'Seus dados mudaram em outro aparelho ou aba. Exporte o backup e recarregue para continuar.' }, 409);
  } catch (error) {
    console.error('Falha ao acessar os registros', error.code ?? error.name);
    return json({ error: 'Não foi possível acessar sua conta. Tente novamente em instantes.' }, 503);
  }
}
