import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase, createAccount, readAccount, updateAccount, transaction } from '../db/banco.mjs';
import { handleAuth, sessionUser } from '../lib/auth.mjs';
import { handleAccount } from '../lib/account-api.mjs';
import { validateState } from '../lib/validacao.mjs';
import R from '../src/core.js';

const form = { name: 'Teste', email: 'teste@example.test', password: 'SenhaTeste_123', confirmPassword: 'SenhaTeste_123' };
const request = (method = 'GET', body, cookie = '', origin = 'https://repwise.test') =>
  new Request('https://repwise.test/api/account', {
    method, headers: { origin, cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
const auth = (db, action, body = form, cookie = '') => handleAuth(request('POST', body, cookie), action, db);
const cookieOf = response => response.headers.get('set-cookie').split(';')[0];
const count = (db, table) => db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;

test('as 14 tabelas do domínio armazenam registros do fluxo completo', () => {
  const db = openDatabase(':memory:');
  try {
    const state = R.seed();
    const proposal = R.propose(state, { goal: 'Hipertrofia', level: 'Iniciante', frequency: 3, duration: 45 });
    state.consent = true;
    state.audit.push({ type: 'consent-granted', at: new Date().toISOString() });
    state.messages.push({ id: 'pergunta', role: 'user', text: 'Sugira um treino.' });
    state.messages.push({ id: 'resposta', role: 'assistant', text: 'Proposta para revisar.', proposalId: proposal.id, feedback: 'useful' });
    R.applyProposal(state, proposal.id);
    createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state: validateState(state) });
    for (const table of ['usuarios', 'perfis_usuario', 'exercicios', 'fichas_treino', 'ficha_exercicios',
      'sessoes_treino', 'sessao_exercicios', 'series_executadas', 'consentimentos_ia', 'conversas_ia',
      'mensagens_ia', 'propostas_ia', 'feedbacks_ia', 'eventos_auditoria']) assert.ok(count(db, table) > 0, table);
    const loaded = readAccount(db, 'alice').state;
    assert.equal(loaded.workouts.length, state.workouts.length);
    assert.equal(loaded.sessions.length, state.sessions.length);
    assert.equal(loaded.messages[1].feedback, 'useful');
    assert.equal(loaded.proposals[0].workoutId, proposal.workoutId);
    assert.equal(loaded.consent, true);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check, 'ok');
  } finally { db.close(); }
});

test('a conta é recuperada após fechar e reabrir o banco', () => {
  const folder = mkdtempSync(join(tmpdir(), 'repwise-test-'));
  let db = openDatabase(join(folder, 'teste.sqlite'));
  try {
    const state = R.seed(new Date(), false);
    state.profile.name = 'Persistência';
    createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state });
    db.close();
    db = openDatabase(join(folder, 'teste.sqlite'));
    assert.equal(readAccount(db, 'alice').state.profile.name, 'Persistência');
    assert.equal(readAccount(db, 'alice').revision, 1);
  } finally {
    db.close();
    rmSync(folder, { recursive: true });
  }
});

test('isolamento de contas, referências e conflito de revisão preservam os registros', () => {
  const db = openDatabase(':memory:');
  try {
    const state = validateState(R.seed());
    createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state });
    createAccount(db, { id: 'bob', email: 'bob@example.test', password: 'hash', state });
    state.workouts[0].name = 'Alterado';
    assert.equal(updateAccount(db, 'alice', 1, state).revision, 2);
    assert.equal(updateAccount(db, 'alice', 1, state), null);
    assert.notEqual(readAccount(db, 'bob').state.workouts[0].name, 'Alterado');
    assert.throws(() => db.prepare("UPDATE sessoes_treino SET id_ficha_origem = 'ausente' WHERE id_usuario = 'alice'").run());
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  } finally { db.close(); }
});

test('falha numa restrição do banco desfaz a gravação inteira e a revisão', () => {
  const db = openDatabase(':memory:');
  try {
    const state = validateState(R.seed());
    createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state });
    const previous = JSON.stringify(readAccount(db, 'alice'));
    state.profile.name = 'Alteração que deve ser desfeita';
    state.workouts[0].items[0].weight = -1;
    assert.throws(() => updateAccount(db, 'alice', 1, state));
    assert.equal(JSON.stringify(readAccount(db, 'alice')), previous);
    assert.throws(() => transaction(db, () => {
      db.prepare("UPDATE usuarios SET nome = 'Errado' WHERE id_usuario = 'alice'").run();
      throw new Error('falha ao criar sessão');
    }));
    assert.equal(JSON.stringify(readAccount(db, 'alice')), previous);
  } finally { db.close(); }
});

test('sessão em andamento, campos vazios, arquivamento, revogação e limpeza da conversa', () => {
  const db = openDatabase(':memory:');
  try {
    let state = validateState(R.seed());
    const active = R.startSession(state, state.workouts[0].id);
    active.entries[0].rows[0].reps = '';
    state.messages.push({ id: 'm', role: 'assistant', text: 'Teste', feedback: 'inappropriate' });
    createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state: validateState(state) });
    state = readAccount(db, 'alice').state;
    assert.equal(state.active.entries[0].rows[0].reps, '');
    state.active.entries[0].rows[0] = { weight: 40, reps: 10, done: true };
    R.finishSession(state);
    state.workouts[0].status = 'archived';
    state.workouts[0].name = 'Renomeado';
    state.consent = false;
    state.messages = [];
    updateAccount(db, 'alice', 1, validateState(state));
    const loaded = readAccount(db, 'alice').state;
    assert.equal(loaded.active, null);
    assert.equal(loaded.sessions.at(-1).name, 'Push');
    assert.equal(loaded.workouts[0].name, 'Renomeado');
    assert.equal(count(db, 'feedbacks_ia'), 0);
    assert.equal(loaded.consent, false);
  } finally { db.close(); }
});

test('cadastro, senha, sessão, duplicidade, saída e expiração', async () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal((await auth(db, 'register', { ...form, confirmPassword: 'outra' })).status, 422);
    const registered = await auth(db, 'register');
    assert.equal(registered.status, 201);
    assert.match(registered.headers.get('set-cookie'), /HttpOnly.*SameSite=Lax.*Secure/);
    const cookie = cookieOf(registered);
    const user = sessionUser(request('GET', undefined, cookie), db);
    assert.equal(user.email, form.email);
    const hash = db.prepare('SELECT senha_hash FROM usuarios').get().senha_hash;
    assert.ok(!hash.includes(form.password));
    assert.equal(readAccount(db, user.userId).state.workouts.length, 0);
    assert.equal((await auth(db, 'register')).status, 409);
    assert.equal((await auth(db, 'login', { ...form, password: 'incorreta' })).status, 401);
    assert.equal((await auth(db, 'logout', {}, cookie)).status, 200);
    assert.equal(sessionUser(request('GET', undefined, cookie), db), null);
    const login = await auth(db, 'login');
    assert.equal(login.status, 200);
    db.prepare('UPDATE sessoes_autenticacao SET expira_em = 0').run();
    assert.equal(sessionUser(request('GET', undefined, cookieOf(login)), db), null);
  } finally { db.close(); }
});

test('demonstrações usam contas temporárias isoladas no mesmo esquema', async () => {
  const db = openDatabase(':memory:');
  try {
    const first = await auth(db, 'demo', {});
    const second = await auth(db, 'demo', {});
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const a = sessionUser(request('GET', undefined, cookieOf(first)), db);
    const b = sessionUser(request('GET', undefined, cookieOf(second)), db);
    assert.ok(a.demo && b.demo);
    assert.notEqual(a.userId, b.userId);
    assert.ok(readAccount(db, a.userId).state.sessions.length > 0);
    db.prepare('UPDATE usuarios SET expira_em = 0 WHERE id_usuario = ?').run(a.userId);
    assert.equal(sessionUser(request('GET', undefined, cookieOf(first)), db), null);
    assert.equal(sessionUser(request('GET', undefined, cookieOf(second)), db).userId, b.userId);
  } finally { db.close(); }
});

test('API valida acesso, origem, catálogo, duplicidade e formato antes da transação', async () => {
  const db = openDatabase(':memory:');
  try {
    assert.deepEqual(await (await handleAccount(request(), null, db)).json(), { user: null });
    assert.equal((await handleAccount(request('PUT', {}), null, db)).status, 401);
    const response = await auth(db, 'register');
    const user = sessionUser(request('GET', undefined, cookieOf(response)), db);
    let state = readAccount(db, user.userId).state;
    assert.equal((await handleAccount(request('PUT', { revision: 1, state }, '', 'https://outra.test'), user, db)).status, 403);
    state = R.seed();
    state.profile.name = 'Teste';
    assert.equal((await handleAccount(request('PUT', { revision: 1, state }), user, db)).status, 200);
    assert.equal((await handleAccount(request('PUT', { revision: 1, state }), user, db)).status, 409);
    state.workouts[0].items[0].exerciseId = 'ausente';
    assert.equal((await handleAccount(request('PUT', { revision: 2, state }), user, db)).status, 422);
    assert.equal(readAccount(db, user.userId).revision, 2);
    assert.equal((await handleAccount(request('POST', {}), user, db)).status, 405);
    for (let i = 0; i < 15; i++) await auth(db, 'login', { ...form, password: 'incorreta' });
    assert.equal((await auth(db, 'login')).status, 429);
  } finally { db.close(); }
});
