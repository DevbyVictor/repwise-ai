import { readFileSync } from 'node:fs';
import R from '../src/core.js';
import { readAccount } from '../db/banco.mjs';
import { json, limited } from './auth.mjs';

const contexto = JSON.parse(readFileSync(new URL('./contexto-academia.json', import.meta.url), 'utf8'));
const goals = ['Hipertrofia', 'Força', 'Condicionamento', 'Qualidade de vida'];
const levels = ['Iniciante', 'Intermediário', 'Avançado'];

export const ollamaConfig = {
  url: process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434',
  model: process.env.OLLAMA_MODEL ?? 'qwen2.5:0.5b',
  timeout: Number(process.env.OLLAMA_TIMEOUT_MS ?? 120000)
};

// Chama o Ollama (/api/chat) sem streaming. `format` pode ser um JSON Schema para respostas estruturadas.
export async function ollamaChat(messages, format) {
  const response = await fetch(new URL('/api/chat', ollamaConfig.url), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: ollamaConfig.model, messages, stream: false,
      options: { temperature: format ? 0.2 : 0.5, num_ctx: 4096 },
      ...(format ? { format } : {})
    }),
    signal: AbortSignal.timeout(ollamaConfig.timeout)
  });
  if (!response.ok) throw new Error(`Ollama respondeu ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const result = await response.json();
  const content = result.message?.content?.trim();
  if (!content) throw new Error('Ollama retornou uma resposta vazia.');
  return content;
}

const kg = value => Number(value).toLocaleString('pt-BR');

function historySummary(state) {
  if (!state.sessions.length) return 'O usuário ainda não finalizou nenhuma sessão de treino.';
  const lines = [`Sessões finalizadas no total: ${state.sessions.length}.`];
  const stats = R.stats(state);
  lines.push(`Nesta semana: ${stats.week.length} sessões, volume de ${kg(stats.weekVolume)} kg`
    + (stats.delta === null ? '.' : ` (${stats.delta >= 0 ? '+' : ''}${stats.delta}% em relação à semana anterior).`));
  const recent = [...state.sessions].sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt)).slice(0, 5);
  lines.push('Últimas sessões: ' + recent.map(s =>
    `${s.name} em ${new Date(s.endedAt).toLocaleDateString('pt-BR')} (${Math.max(1, Math.round(s.duration / 60))} min, volume ${kg(R.volume(s))} kg)`).join('; ') + '.');
  const perExercise = [];
  for (const exercise of R.exercises) {
    const points = R.series(state, exercise.id, 56);
    if (!points.length) continue;
    perExercise.push(`- ${exercise.name}: ${points.length} sessões; maior carga por sessão foi de ${kg(points[0].load)} kg `
      + `(${new Date(points[0].date).toLocaleDateString('pt-BR')}) para ${kg(points.at(-1).load)} kg `
      + `(${new Date(points.at(-1).date).toLocaleDateString('pt-BR')}); volume somado ${kg(points.reduce((n, p) => n + p.volume, 0))} kg.`);
  }
  if (perExercise.length) lines.push('Evolução por exercício nas últimas 8 semanas (somente séries concluídas):', ...perExercise);
  return lines.join('\n');
}

function systemPrompt(state) {
  const p = state.profile;
  const workouts = state.workouts.filter(w => w.status === 'active');
  return [
    contexto.persona,
    'Regras obrigatórias:\n' + contexto.regras.map(r => '- ' + r).join('\n'),
    'Princípios gerais de treino que você pode usar:\n' + contexto.principios_de_treino.map(r => '- ' + r).join('\n'),
    'Como usar o aplicativo:\n' + contexto.uso_do_app.map(r => '- ' + r).join('\n'),
    'Catálogo de exercícios do app: ' + R.exercises.map(e => `${e.name} (${e.group}, ${e.equipment})`).join('; ') + '.',
    `Perfil do usuário: objetivo ${p.goal}; experiência ${p.level}; ${p.frequency} treinos por semana; ${p.duration} minutos por treino`
      + (p.preferences.trim() ? `; preferências: ${p.preferences.trim()}` : '') + '.',
    'Fichas ativas: ' + (workouts.length
      ? workouts.map(w => `${w.name} (${w.items.map(i => R.exercise(i.exerciseId)?.name).filter(Boolean).join(', ')})`).join('; ')
      : 'nenhuma') + '.',
    state.consent
      ? 'O usuário AUTORIZOU o uso do histórico. Resumo dos registros:\n' + historySummary(state)
      : 'O usuário NÃO autorizou o uso do histórico. Você não tem acesso aos registros de treino dele.'
  ].join('\n\n');
}

function conversation(state, text) {
  const previous = state.messages.slice(-12);
  // O cliente salva a pergunta antes de chamar a API; evita enviá-la duas vezes.
  if (previous.at(-1)?.role === 'user' && previous.at(-1).text === text) previous.pop();
  return previous.slice(-10).map(m => ({ role: m.role, content: m.text.slice(0, 2000) }));
}

function originAllowed(request) {
  return request.headers.get('origin') === new URL(request.url).origin
    && request.headers.get('sec-fetch-site') !== 'cross-site';
}

async function readJson(request) {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return null;
  const raw = await request.text();
  if (raw.length > 8000) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function handleAssistant(request, action, user, db, chat = ollamaChat) {
  if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
  if (!originAllowed(request)) return json({ error: 'Origem não autorizada.' }, 403);
  if (!user) return json({ error: 'Entre na sua conta para continuar.' }, 401);
  const body = await readJson(request);
  if (!body) return json({ error: 'Envie os dados em JSON.' }, 422);
  if (limited(db, 'assistant:' + user.userId, 40)) {
    return json({ error: 'Você fez muitas perguntas seguidas. Aguarde alguns minutos.' }, 429, { 'Retry-After': '900' });
  }
  const account = readAccount(db, user.userId);
  if (!account) return json({ error: 'Conta não encontrada.' }, 404);
  const state = account.state;

  if (action === 'message') {
    if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 1000) {
      return json({ error: 'Escreva uma pergunta com até 1.000 caracteres.' }, 422);
    }
    const text = body.text.trim();
    // Respostas de segurança e indisponibilidade continuam fixas e não passam pelo modelo.
    const rule = R.respond(state, text);
    if (['unavailable', 'health', 'risk'].includes(rule.category)) return json(rule);
    try {
      const answer = await chat([{ role: 'system', content: systemPrompt(state) }, ...conversation(state, text),
        { role: 'user', content: text }]);
      return json({
        category: 'ai', text: answer.slice(0, 4000),
        context: state.consent ? 'Perfil e resumo do histórico · sem identificadores pessoais' : 'Perfil de treino · sem histórico'
      });
    } catch (error) {
      console.error('Falha no Ollama', error.name, error.message);
      return json({ ...rule, fallback: true,
        text: 'A IA local não respondeu agora, então segue uma resposta automática. ' + rule.text });
    }
  }

  if (action === 'proposal') {
    const params = { goal: body.goal, level: body.level, frequency: +body.frequency, duration: +body.duration };
    if (!goals.includes(params.goal) || !levels.includes(params.level) || !Number.isInteger(params.frequency)
      || params.frequency < 1 || params.frequency > 7 || !Number.isInteger(params.duration)
      || params.duration < 15 || params.duration > 120) {
      return json({ error: 'Informe objetivo, nível, frequência e duração de 15 a 120 minutos.' }, 422);
    }
    try {
      return json({ workout: await proposeWorkout(state, params, chat) });
    } catch (error) {
      console.error('Falha ao gerar ficha com o Ollama', error.name, error.message);
      return json({ workout: null, fallback: true });
    }
  }
  return json({ error: 'Operação não encontrada.' }, 404);
}

const proposalSchema = ids => ({
  type: 'object',
  properties: {
    name: { type: 'string' },
    subtitle: { type: 'string' },
    style: { type: 'string', enum: ['push', 'pull', 'legs'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          exerciseId: { type: 'string', enum: ids },
          sets: { type: 'integer' },
          reps: { type: 'integer' }
        },
        required: ['exerciseId', 'sets', 'reps']
      }
    }
  },
  required: ['name', 'subtitle', 'style', 'items']
});

export async function proposeWorkout(state, params, chat = ollamaChat) {
  const ids = R.exercises.map(e => e.id);
  const prompt = [
    'Monte UMA ficha de treino de musculação para revisão do usuário. Responda apenas com o JSON pedido.',
    `Objetivo: ${params.goal}. Experiência: ${params.level}. Disponibilidade: ${params.frequency} dias por semana. Tempo por treino: ${params.duration} minutos.`,
    state.profile.preferences.trim() ? `Preferências declaradas: ${state.profile.preferences.trim()}` : '',
    'Use somente exercícios desta lista (campo exerciseId = id antes dos dois-pontos):',
    R.exercises.map(e => `${e.id}: ${e.name} (${e.group}, ${e.equipment}, ${e.type})`).join('\n'),
    'Regras: entre 3 e 8 exercícios sem repetir; comece pelos compostos; séries entre 2 e 5 (iniciantes: 2 ou 3); '
      + 'repetições entre 5 e 20 de acordo com o objetivo; caiba no tempo informado. '
      + 'name: nome curto da ficha (até 40 caracteres). subtitle: uma frase curta explicando o foco. '
      + 'style: push se a ficha é focada em empurrar, pull se em puxar ou corpo inteiro, legs se em pernas.'
  ].filter(Boolean).join('\n\n');
  const raw = await chat([{ role: 'system', content: contexto.persona + '\n' + contexto.regras.join('\n') },
    { role: 'user', content: prompt }], proposalSchema(ids));
  const data = JSON.parse(raw);
  const seen = new Set();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Math.round(Number(value) || min)));
  const items = (Array.isArray(data.items) ? data.items : [])
    .filter(item => ids.includes(item?.exerciseId) && !seen.has(item.exerciseId) && seen.add(item.exerciseId))
    .slice(0, 8)
    .map(item => ({
      exerciseId: item.exerciseId,
      sets: clamp(item.sets, 2, params.level === 'Iniciante' ? 3 : 5),
      reps: clamp(item.reps, 5, 20),
      weight: 0 // a carga é sempre definida pelo usuário
    }));
  if (items.length < 3) throw new Error('A ficha gerada tem poucos exercícios válidos.');
  const workout = {
    name: (typeof data.name === 'string' && data.name.trim() ? data.name.trim() : 'Sugestão da IA').slice(0, 60),
    subtitle: (typeof data.subtitle === 'string' ? data.subtitle.trim() : '').slice(0, 200)
      || `${params.goal} · ${params.duration} min`,
    style: ['push', 'pull', 'legs'].includes(data.style) ? data.style : 'pull',
    origin: 'ai', items
  };
  R.validateWorkout(workout);
  return workout;
}
