import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import R from '../src/core.js';

export function transaction(db, action, write = true) {
  db.exec(write ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(readFileSync(new URL('./esquema.sql', import.meta.url), 'utf8'));
  const insert = db.prepare('INSERT OR IGNORE INTO exercicios VALUES (?, ?, ?, ?, ?, ?, ?)');
  transaction(db, () => R.exercises.forEach((e, i) =>
    insert.run(e.id, e.name, e.group, e.equipment, e.description, e.type, i + 1)));
  return db;
}

export function catalog(db) {
  return db.prepare(`SELECT id_exercicio AS id, nome AS name, grupo_muscular AS "group",
    equipamento AS equipment, descricao AS description, tipo AS type
    FROM exercicios ORDER BY ordem`).all();
}

function byKey(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const id = key(row);
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(row);
  }
  return groups;
}

export function readAccount(db, owner) {
  return transaction(db, () => {
    const user = db.prepare('SELECT nome, revisao, atualizado_em FROM usuarios WHERE id_usuario = ?').get(owner);
    if (!user) return null;
    const all = (table, order = 'ordem') => db.prepare(
      `SELECT * FROM ${table} WHERE id_usuario = ? ORDER BY ${order}`).all(owner);
    const profile = db.prepare('SELECT * FROM perfis_usuario WHERE id_usuario = ?').get(owner);
    const conversation = db.prepare('SELECT * FROM conversas_ia WHERE id_usuario = ?').get(owner);
    const item = row => ({
      exerciseId: row.id_exercicio, sets: row.series_planejadas,
      reps: row.repeticoes_planejadas, weight: row.carga_planejada
    });
    const workoutItems = byKey(all('ficha_exercicios'), row => row.id_ficha);
    const workouts = all('fichas_treino').map(w => ({
      id: w.id_ficha, name: w.nome, subtitle: w.subtitulo, style: w.estilo, status: w.status,
      origin: w.origem, items: (workoutItems.get(w.id_ficha) ?? []).map(item)
    }));
    const entries = byKey(all('sessao_exercicios'), row => row.id_sessao);
    const sets = byKey(all('series_executadas', 'numero_serie'), row => row.id_sessao + ':' + row.ordem_exercicio);
    const sessions = all('sessoes_treino', 'iniciada_em, id_sessao').map(s => ({
      id: s.id_sessao, workoutId: s.id_ficha_origem, name: s.nome_ficha_snapshot,
      status: s.status, startedAt: s.iniciada_em, endedAt: s.finalizada_em,
      duration: s.duracao_segundos, note: s.observacao,
      entries: (entries.get(s.id_sessao) ?? []).map(e => ({
        ...item(e), name: e.nome_exercicio_snapshot, note: e.observacao,
        rows: (sets.get(s.id_sessao + ':' + e.ordem) ?? []).map(r => ({
          weight: r.carga_kg ?? '', reps: r.repeticoes ?? '', done: Boolean(r.concluida)
        }))
      }))
    }));
    const proposalRows = all('propostas_ia');
    const origin = new Map(proposalRows.map(p => [p.id_mensagem_origem, p.id_proposta]));
    const feedback = new Map(all('feedbacks_ia', 'id_mensagem').map(f => [f.id_mensagem, f.classificacao]));
    return {
      revision: user.revisao, updatedAt: user.atualizado_em,
      state: {
        version: 1,
        profile: { name: user.nome, goal: profile.objetivo_treino, level: profile.nivel_experiencia,
          frequency: profile.frequencia_semanal, duration: profile.duracao_minutos, preferences: profile.preferencias },
        workouts, sessions: sessions.filter(s => s.status === 'finished'),
        active: sessions.find(s => s.status === 'active') ?? null,
        consent: Boolean(all('consentimentos_ia').at(-1)?.concedido),
        aiAvailable: Boolean(conversation.assistente_disponivel),
        messages: all('mensagens_ia').map(m => ({
          id: m.id_mensagem, role: m.papel, text: m.conteudo, at: m.criada_em,
          category: m.categoria ?? undefined, context: m.contexto ?? undefined,
          proposalId: origin.get(m.id_mensagem), feedback: feedback.get(m.id_mensagem)
        })),
        proposals: proposalRows.map(p => ({
          ...JSON.parse(p.payload_validado), id: p.id_proposta, status: p.status,
          createdAt: p.criada_em, expiresAt: p.expira_em,
          decidedAt: p.decidida_em ?? undefined, workoutId: p.id_ficha_resultante ?? undefined
        })),
        audit: all('eventos_auditoria').map(a => ({
          type: a.tipo_evento, at: a.ocorrido_em, proposalId: a.id_entidade ?? undefined
        }))
      }
    };
  }, false);
}

export function createAccount(db, { id, email, password, state, expires = null }, afterCreate = () => undefined) {
  const now = new Date().toISOString();
  return transaction(db, () => {
    db.prepare(`INSERT INTO usuarios
      (id_usuario, nome, email, senha_hash, demonstracao, criado_em, atualizado_em, expira_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, state.profile.name, email, password, Number(expires !== null), now, now, expires);
    writeState(db, id, state, now);
    return afterCreate();
  });
}

export function updateAccount(db, owner, revision, state) {
  const now = new Date().toISOString();
  return transaction(db, () => {
    const update = db.prepare(`UPDATE usuarios SET nome = ?, revisao = revisao + 1, atualizado_em = ?
      WHERE id_usuario = ? AND revisao = ?`).run(state.profile.name, now, owner, revision);
    if (update.changes === 0) return null;
    writeState(db, owner, state, now);
    return { revision: revision + 1, updatedAt: now };
  });
}

function writeState(db, owner, state, now) {
  const profile = state.profile;
  db.prepare(`INSERT INTO perfis_usuario VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id_usuario) DO UPDATE SET objetivo_treino = excluded.objetivo_treino,
    nivel_experiencia = excluded.nivel_experiencia, frequencia_semanal = excluded.frequencia_semanal,
    duracao_minutos = excluded.duracao_minutos, preferencias = excluded.preferencias`)
    .run(owner, profile.goal, profile.level, profile.frequency, profile.duration, profile.preferences);

  for (const table of ['propostas_ia', 'sessoes_treino', 'fichas_treino', 'mensagens_ia', 'consentimentos_ia', 'eventos_auditoria']) {
    db.prepare(`DELETE FROM ${table} WHERE id_usuario = ?`).run(owner);
  }

  const insertWorkout = db.prepare('INSERT INTO fichas_treino VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertItem = db.prepare('INSERT INTO ficha_exercicios VALUES (?, ?, ?, ?, ?, ?, ?)');
  const workoutIds = new Set(state.workouts.map(w => w.id));
  state.workouts.forEach((w, i) => {
    insertWorkout.run(owner, w.id, w.name, w.subtitle, w.style, w.status, w.origin, i + 1);
    w.items.forEach((e, j) => insertItem.run(owner, w.id, j + 1, e.exerciseId, e.sets, e.reps, e.weight));
  });

  const insertSession = db.prepare('INSERT INTO sessoes_treino VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertEntry = db.prepare('INSERT INTO sessao_exercicios VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSet = db.prepare('INSERT INTO series_executadas VALUES (?, ?, ?, ?, ?, ?, ?)');
  const sessions = state.active ? [...state.sessions, state.active] : state.sessions;
  for (const s of sessions) {
    insertSession.run(owner, s.id, workoutIds.has(s.workoutId) ? s.workoutId : null, s.name,
      s.status, s.startedAt, s.endedAt ?? null, s.duration ?? null, s.note);
    s.entries.forEach((e, i) => {
      insertEntry.run(owner, s.id, i + 1, e.exerciseId, e.name, e.sets, e.reps, e.weight, e.note);
      e.rows.forEach((r, j) => insertSet.run(owner, s.id, i + 1, j + 1,
        r.reps === '' ? null : r.reps, r.weight === '' ? null : r.weight, Number(r.done)));
    });
  }

  db.prepare(`INSERT INTO conversas_ia VALUES (?, ?, ?)
    ON CONFLICT(id_usuario) DO UPDATE SET assistente_disponivel = excluded.assistente_disponivel`)
    .run(owner, Number(state.aiAvailable), now);
  const insertMessage = db.prepare('INSERT INTO mensagens_ia VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertFeedback = db.prepare('INSERT INTO feedbacks_ia VALUES (?, ?, ?)');
  const messageByProposal = new Map();
  state.messages.forEach((m, i) => {
    insertMessage.run(owner, m.id, i + 1, m.role, m.text, m.category ?? null, m.context ?? null, m.at ?? now);
    if (m.feedback) insertFeedback.run(owner, m.id, m.feedback);
    if (m.proposalId) messageByProposal.set(m.proposalId, m.id);
  });
  const insertProposal = db.prepare('INSERT INTO propostas_ia VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  state.proposals.forEach((p, i) => insertProposal.run(owner, p.id, messageByProposal.get(p.id) ?? null,
    workoutIds.has(p.workoutId) ? p.workoutId : null, i + 1, 'CRIAR_FICHA',
    JSON.stringify({ params: p.params, workout: p.workout }), p.status, p.createdAt, p.expiresAt, p.decidedAt ?? null));
  const insertEvent = db.prepare('INSERT INTO eventos_auditoria VALUES (?, ?, ?, ?, ?)');
  const insertConsent = db.prepare('INSERT INTO consentimentos_ia VALUES (?, ?, ?, ?, ?)');
  let consent = false;
  let consentOrder = 0;
  state.audit.forEach((event, i) => {
    insertEvent.run(owner, i + 1, event.type, event.proposalId ?? null, event.at);
    if (['consent-granted', 'consent-revoked'].includes(event.type)) {
      consent = event.type === 'consent-granted';
      insertConsent.run(owner, ++consentOrder, 'PERSONALIZACAO_COM_HISTORICO', Number(consent), event.at);
    }
  });
  if (consent !== state.consent) {
    insertConsent.run(owner, ++consentOrder, 'PERSONALIZACAO_COM_HISTORICO', Number(state.consent), now);
  }
}
