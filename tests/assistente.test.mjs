import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, createAccount, updateAccount } from '../db/banco.mjs';
import { handleAssistant } from '../lib/assistente.mjs';
import { validateState } from '../lib/validacao.mjs';
import R from '../src/core.js';

const user = { userId: 'alice', email: 'alice@example.test', fullName: 'Alice', demo: false };
const request = (body, origin = 'https://repwise.test') => new Request('https://repwise.test/api/assistant/x', {
  method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
function setup(consent = false) {
  const db = openDatabase(':memory:');
  const state = R.seed();
  state.consent = consent;
  createAccount(db, { id: 'alice', email: 'alice@example.test', password: 'hash', state: validateState(state) });
  return db;
}

test('pergunta usa o modelo com contexto de academia e respeita o consentimento', async () => {
  for (const consent of [false, true]) {
    const db = setup(consent);
    let sent;
    const chat = async messages => { sent = messages; return 'Resposta da IA.'; };
    const response = await handleAssistant(request({ text: 'Quantas séries devo fazer?' }), 'message', user, db, chat);
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.category, 'ai');
    assert.equal(body.text, 'Resposta da IA.');
    assert.equal(sent[0].role, 'system');
    assert.match(sent[0].content, /Hipertrofia/);
    assert.equal(/Resumo dos registros/.test(sent[0].content), consent);
    assert.ok(!sent[0].content.includes('alice@example.test'));
    assert.deepEqual(sent.at(-1), { role: 'user', content: 'Quantas séries devo fazer?' });
    db.close();
  }
});

test('sintomas e indisponibilidade não chegam ao modelo; falha do Ollama usa regras', async () => {
  const db = setup();
  let calls = 0;
  const chat = async () => { calls++; throw new Error('connect ECONNREFUSED'); };
  const health = await (await handleAssistant(request({ text: 'Sinto dor no ombro' }), 'message', user, db, chat)).json();
  assert.equal(health.category, 'health');
  assert.equal(calls, 0);
  const fallback = await (await handleAssistant(request({ text: 'Como registrar meu treino?' }), 'message', user, db, chat)).json();
  assert.equal(calls, 1);
  assert.equal(fallback.fallback, true);
  assert.equal(fallback.category, 'general');
  const state = validateState({ ...R.seed(), aiAvailable: false });
  updateAccount(db, 'alice', 1, state);
  const off = await (await handleAssistant(request({ text: 'Oi' }), 'message', user, db, chat)).json();
  assert.equal(off.category, 'unavailable');
  assert.equal(calls, 1);
  db.close();
});

test('acesso, origem e formato são validados antes de chamar o modelo', async () => {
  const db = setup();
  const chat = async () => assert.fail('não deveria chamar o modelo');
  assert.equal((await handleAssistant(request({ text: 'Oi' }), 'message', null, db, chat)).status, 401);
  assert.equal((await handleAssistant(request({ text: 'Oi' }, 'https://outro.test'), 'message', user, db, chat)).status, 403);
  assert.equal((await handleAssistant(request({ text: '' }), 'message', user, db, chat)).status, 422);
  assert.equal((await handleAssistant(request({ text: 'x'.repeat(1001) }), 'message', user, db, chat)).status, 422);
  assert.equal((await handleAssistant(request({ goal: 'Voar', level: 'Iniciante', frequency: 3, duration: 45 }),
    'proposal', user, db, chat)).status, 422);
  db.close();
});

test('ficha gerada é filtrada pelo catálogo, sem carga, e vira proposta válida', async () => {
  const db = setup();
  let format;
  const chat = async (messages, schema) => {
    format = schema;
    return JSON.stringify({ name: 'Peito e costas', subtitle: 'Foco em hipertrofia', style: 'push', items: [
      { exerciseId: 'bench', sets: 9, reps: 10 }, { exerciseId: 'inventado', sets: 3, reps: 10 },
      { exerciseId: 'bench', sets: 3, reps: 10 }, { exerciseId: 'row', sets: 3, reps: 50 },
      { exerciseId: 'lateral', sets: 3, reps: 12 }] });
  };
  const params = { goal: 'Hipertrofia', level: 'Iniciante', frequency: 3, duration: 45 };
  const body = await (await handleAssistant(request(params), 'proposal', user, db, chat)).json();
  assert.ok(format.properties.items.items.properties.exerciseId.enum.includes('bench'));
  assert.deepEqual(body.workout.items.map(i => i.exerciseId), ['bench', 'row', 'lateral']);
  assert.ok(body.workout.items.every(i => i.weight === 0 && i.sets <= 3 && i.reps <= 20));
  const state = R.seed();
  const proposal = R.propose(state, params, body.workout);
  R.applyProposal(state, proposal.id);
  validateState(state);

  const broken = await (await handleAssistant(request(params), 'proposal', user, db, async () => 'não é json')).json();
  assert.deepEqual(broken, { workout: null, fallback: true });
  db.close();
});
