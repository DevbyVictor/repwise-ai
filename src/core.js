(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RepWise = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const exercises = [
    ['bench', 'Supino reto com barra', 'Peito', 'Barra', 'Movimento composto de empurrar na posição deitada. Use suportes ajustados e orientação para aprender a execução.', 'Composto'],
    ['incline', 'Supino inclinado com halteres', 'Peito', 'Halteres', 'Variação de supino em banco inclinado, com um halter em cada mão.', 'Composto'],
    ['fly', 'Crucifixo na máquina', 'Peito', 'Máquina', 'Aproximação dos braços à frente do tronco em uma máquina com apoio.', 'Isolado'],
    ['press', 'Desenvolvimento com halteres', 'Ombros', 'Halteres', 'Movimento de empurrar os halteres acima dos ombros.', 'Composto'],
    ['lateral', 'Elevação lateral', 'Ombros', 'Halteres', 'Elevação dos braços lateralmente com amplitude controlada.', 'Isolado'],
    ['triceps', 'Tríceps na polia', 'Tríceps', 'Polia', 'Extensão de cotovelos utilizando a resistência de uma polia alta.', 'Isolado'],
    ['pulldown', 'Puxada frontal', 'Costas', 'Máquina', 'Puxada de uma barra em direção à parte superior do peito em polia alta.', 'Composto'],
    ['row', 'Remada baixa', 'Costas', 'Polia', 'Movimento de remada na posição sentada, com apoio estável.', 'Composto'],
    ['curl', 'Rosca direta', 'Bíceps', 'Barra', 'Flexão de cotovelos com barra para trabalho dos bíceps.', 'Isolado'],
    ['hammer', 'Rosca martelo', 'Bíceps', 'Halteres', 'Flexão de cotovelos com as palmas voltadas uma para a outra.', 'Isolado'],
    ['squat', 'Agachamento livre', 'Pernas', 'Barra', 'Movimento composto com flexão de quadris e joelhos. Aprenda a técnica com um profissional.', 'Composto'],
    ['legpress', 'Leg press 45°', 'Pernas', 'Máquina', 'Extensão de pernas em equipamento com plataforma inclinada.', 'Composto'],
    ['extension', 'Cadeira extensora', 'Pernas', 'Máquina', 'Extensão de joelhos na posição sentada, com ajuste do equipamento.', 'Isolado'],
    ['flexion', 'Mesa flexora', 'Pernas', 'Máquina', 'Flexão dos joelhos em equipamento com apoio para o corpo.', 'Isolado'],
    ['calf', 'Panturrilha em pé', 'Pernas', 'Máquina', 'Elevação dos calcanhares com apoio estável.', 'Isolado'],
    ['crunch', 'Abdominal na máquina', 'Abdômen', 'Máquina', 'Flexão de tronco com resistência e apoio em máquina.', 'Isolado']
  ].map(([id, name, group, equipment, description, type]) => ({ id, name, group, equipment, description, type }));
  const exercise = id => exercises.find(e => e.id === id);
  const item = (exerciseId, sets = 3, reps = 12, weight = 20) => ({ exerciseId, sets, reps, weight });
  function seed(now = new Date(), populated = true) {
    const workouts = populated ? [
      { id: 'push', name: 'Push', subtitle: 'Peito, ombros e tríceps', style: 'push', origin: 'user', status: 'active', items: [item('bench', 4, 10, 50), item('incline', 3, 12, 20), item('press', 3, 10, 16), item('lateral', 3, 12, 8), item('triceps', 3, 12, 25)] },
      { id: 'pull', name: 'Pull', subtitle: 'Costas e bíceps', style: 'pull', origin: 'user', status: 'active', items: [item('pulldown', 4, 10, 45), item('row', 3, 12, 40), item('curl', 3, 12, 20), item('hammer', 3, 12, 10)] },
      { id: 'legs', name: 'Legs', subtitle: 'Pernas e abdômen', style: 'legs', origin: 'user', status: 'active', items: [item('squat', 4, 10, 60), item('legpress', 3, 12, 120), item('extension', 3, 12, 35), item('flexion', 3, 12, 30), item('calf', 3, 15, 40), item('crunch', 3, 15, 20)] }
    ] : [];
    const sessions = [];
    if (populated) for (let days = 54; days >= 1; days--) {
      const date = new Date(now); date.setDate(date.getDate() - days); date.setHours(18, 0, 0, 0);
      if (![1, 3, 5].includes(date.getDay())) continue;
      const w = workouts[[1, 3, 5].indexOf(date.getDay())];
      const progress = Math.floor((54 - days) / 14) * 2.5;
      const entries = w.items.map(it => ({ ...clone(it), name: exercise(it.exerciseId).name, note: '', rows: Array.from({ length: it.sets }, () => ({ weight: Math.max(0, it.weight - 7.5 + progress), reps: it.reps, done: true })) }));
      sessions.push({ id: uid(), workoutId: w.id, name: w.name, startedAt: date.toISOString(), endedAt: new Date(+date + 48 * 60000).toISOString(), duration: 48 * 60, status: 'finished', note: '', entries });
    }
    return { version: 1, profile: { name: populated ? 'Victor Silva' : '', goal: 'Hipertrofia', level: 'Intermediário', frequency: 4, duration: 50, preferences: '' }, workouts, sessions, active: null, consent: false, aiAvailable: true, messages: [], proposals: [], audit: [] };
  }
  function validateItem(it) {
    if (!exercise(it.exerciseId)) throw Error('Escolha um exercício do catálogo.');
    if (!Number.isInteger(+it.sets) || +it.sets < 1 || +it.sets > 20) throw Error('Informe de 1 a 20 séries.');
    if (!Number.isInteger(+it.reps) || +it.reps < 1 || +it.reps > 200) throw Error('Informe de 1 a 200 repetições planejadas.');
    if (!Number.isFinite(+it.weight) || +it.weight < 0 || +it.weight > 1000) throw Error('A carga deve estar entre 0 e 1.000 kg.');
  }
  function validateWorkout(w) {
    if (!w.name?.trim() || w.name.trim().length > 80) throw Error('Informe um nome com até 80 caracteres.');
    if (w.items.length > 30) throw Error('Use até 30 exercícios por ficha.');
    w.items.forEach(validateItem);
  }
  function startSession(state, id) {
    if (state.active) return state.active;
    const w = state.workouts.find(w => w.id === id && w.status === 'active');
    if (!w || !w.items.length) throw Error('Adicione pelo menos um exercício à ficha para começar.');
    validateWorkout(w);
    state.active = { id: uid(), workoutId: w.id, name: w.name, startedAt: new Date().toISOString(), status: 'active', note: '', entries: w.items.map(it => ({ ...clone(it), name: exercise(it.exerciseId).name, note: '', rows: Array.from({ length: it.sets }, () => ({ weight: it.weight, reps: it.reps, done: false })) })) };
    return state.active;
  }
  function validRow(row) { return Number.isFinite(+row.weight) && row.weight !== '' && +row.weight >= 0 && +row.weight <= 1000 && Number.isInteger(+row.reps) && row.reps !== '' && +row.reps >= 0 && +row.reps <= 200; }
  function completedRows(session) { return session.entries.flatMap(e => e.rows.filter(r => r.done)); }
  function volume(session) { return completedRows(session).reduce((sum, r) => sum + +r.weight * +r.reps, 0); }
  function finishSession(state) {
    const s = state.active;
    if (!s) throw Error('Não há treino em andamento.');
    const rows = completedRows(s);
    if (!rows.length) throw Error('Registre ao menos uma série antes de finalizar.');
    if (rows.some(r => !validRow(r))) throw Error('Revise as séries marcadas. Há valores inválidos.');
    const endedAt = new Date();
    const finished = { ...clone(s), status: 'finished', endedAt: endedAt.toISOString(), duration: Math.max(1, Math.round((+endedAt - +new Date(s.startedAt)) / 1000)) };
    if (!state.sessions.some(old => old.id === finished.id)) state.sessions.push(finished);
    state.active = null;
    return finished;
  }
  function since(days, now = new Date()) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - days + 1); return d; }
  function inPeriod(s, days, now = new Date()) { return +new Date(s.endedAt) >= +since(days, now) && +new Date(s.endedAt) <= +now; }
  function series(state, exerciseId, days = 56, now = new Date()) {
    return state.sessions.filter(s => s.status === 'finished' && inPeriod(s, days, now)).sort((a,b) => new Date(a.endedAt) - new Date(b.endedAt)).flatMap(s => {
      const rows = s.entries.filter(e => !exerciseId || e.exerciseId === exerciseId).flatMap(e => e.rows.filter(r => r.done));
      return rows.length ? [{ date: s.endedAt, load: Math.max(...rows.map(r => +r.weight)), reps: rows.reduce((n,r) => n + +r.reps, 0), volume: rows.reduce((n,r) => n + +r.weight * +r.reps, 0), sessionId: s.id }] : [];
    });
  }
  function stats(state, now = new Date()) {
    const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
    const week = state.sessions.filter(s => s.status === 'finished' && new Date(s.endedAt) >= monday && new Date(s.endedAt) <= now);
    const previous = state.sessions.filter(s => s.status === 'finished' && +new Date(s.endedAt) >= +monday - 7*86400000 && new Date(s.endedAt) < monday);
    const weekVolume = week.reduce((n,s) => n + volume(s),0), previousVolume = previous.reduce((n,s) => n + volume(s),0);
    return { week, weekVolume, previousVolume, delta: previousVolume ? Math.round((weekVolume / previousVolume - 1) * 100) : null, total: state.sessions.length };
  }
  function propose(state, params) {
    if (!params.goal || !params.level || !Number.isInteger(+params.frequency) || +params.frequency < 1 || +params.frequency > 7 || +params.duration < 15 || +params.duration > 120) throw Error('Informe objetivo, nível, frequência e duração de 15 a 120 minutos.');
    const short = +params.duration <= 30;
    const chosen = short ? ['legpress','row','bench'] : ['legpress','row','bench','lateral','curl'];
    const p = { id: uid(), status: 'pending', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+86400000).toISOString(), params: clone(params), workout: { name: 'Full body · sugestão', subtitle: `${params.goal} · ${params.duration} min`, style: 'pull', origin: 'ai', items: chosen.map(id => item(id, params.level === 'Iniciante' ? 2 : 3, 10, 0)) } };
    state.proposals.push(p); return p;
  }
  function applyProposal(state, id, edited) {
    const p = state.proposals.find(p => p.id === id);
    if (!p || p.status !== 'pending') throw Error('Esta proposta já foi processada.');
    if (new Date(p.expiresAt) <= new Date()) throw Error('A proposta expirou. Gere uma nova sugestão.');
    const w = clone(edited || p.workout); validateWorkout(w);
    if (!w.items.length) throw Error('A sugestão precisa de ao menos um exercício.');
    w.id = uid(); w.origin = 'ai'; w.status = 'active'; state.workouts.push(w);
    p.status = 'applied'; p.workoutId = w.id; p.decidedAt = new Date().toISOString();
    state.audit.push({ type: 'proposal-confirmed', at: p.decidedAt, proposalId: p.id });
    return w;
  }
  function respond(state, text) {
    const q = normalize(text);
    if (!state.aiAvailable) return { category: 'unavailable', text: 'O assistente está indisponível nesta simulação. Seus treinos e registros continuam disponíveis. Reative o assistente no painel ao lado para testar novamente.' };
    if (/dor|doi|lesao|tontura|desmai|falta de ar|sintoma|diagnost|tratamento/.test(q)) return { category: 'health', text: 'Esta demonstração não avalia sintomas nem faz diagnósticos. Interrompa movimentos que provoquem dor e procure avaliação de um profissional de saúde. Sintomas intensos ou potencialmente graves exigem atendimento imediato. Não vou sugerir um treino para contornar esses sintomas.' };
    if (/maxim|extrem|anabol|esteroid|sem descanso|ignorar.*dor/.test(q)) return { category: 'risk', text: 'Não vou propor práticas extremas ou tentativas de carga máxima sem acompanhamento. Você pode usar o registro para conversar sobre a execução e o planejamento com um profissional de Educação Física.' };
    if (/crie|criar|monte|montar|sugest|troqu|substitu|alter|apague|exclu/.test(q)) return { category: 'proposal', text: 'Posso preparar uma ficha demonstrativa. Use “Gerar sugestão” para informar objetivo, experiência, frequência e tempo disponível. A ficha só será criada depois de você revisar e confirmar. Pedidos para alterar ou excluir fichas existentes devem ser feitos em Meus treinos.' };
    if (/evol|histor|progres|meu.*supino|minha.*carga|volume/.test(q)) {
      if (!state.consent) return { category: 'consent', text: 'Para analisar seus registros, preciso da sua autorização em “Usar meu histórico”. Sem ela, posso explicar como consultar a aba Evolução. Nenhum dado é enviado para fora do navegador nesta demonstração.' };
      const match = exercises.find(e => q.includes(normalize(e.name))) || (q.includes('supino') ? exercise('bench') : null);
      if (!match) return { category: 'clarify', text: 'Qual exercício você quer analisar? Tente “Como estou evoluindo no supino reto com barra?”. Assim uso somente os registros relevantes à sua pergunta.' };
      const points = series(state, match.id, 56);
      if (points.length < 2) return { category: 'history', text: `Ainda não há pelo menos duas sessões de ${match.name} nas últimas 8 semanas para comparar. Registre novos treinos para acompanhar a evolução.` };
      return { category: 'history', text: `Com base em ${points.length} sessões registradas de ${match.name} nas últimas 8 semanas, a maior carga por sessão passou de ${points[0].load.toLocaleString('pt-BR')} kg para ${points.at(-1).load.toLocaleString('pt-BR')} kg. O volume somado foi ${points.reduce((n,p) => n+p.volume,0).toLocaleString('pt-BR')} kg. Esses registros descrevem seu histórico e não determinam uma carga segura para o próximo treino.`, context: `${match.name} · ${points.length} sessões · sem identificadores pessoais` };
    }
    if (/como.*(us|registr|ficha)|aplicativo|plataforma/.test(q)) return { category: 'general', text: 'Em Meus treinos, crie ou escolha uma ficha e toque em Iniciar. Registre carga e repetições e marque cada série concluída. Ao finalizar, revise o resumo e confirme. Seus dados aparecem em Histórico e Evolução, e ficam salvos neste navegador.' };
    if (/forca|hipertrof|treino|serie|repet|descanso|exercicio/.test(q)) return { category: 'general', text: 'O RepWise ajuda a organizar fichas e comparar séries, repetições e cargas ao longo do tempo. Força e hipertrofia são objetivos relacionados, mas o planejamento depende de contexto e acompanhamento. Nesta versão, as respostas são exemplos fixos: você pode testar uma análise do supino ou gerar uma ficha para revisão.' };
    return { category: 'scope', text: 'Sou o assistente demonstrativo do RepWise. Posso explicar o uso do app, consultar a evolução de um exercício com sua autorização ou preparar uma sugestão de ficha para você revisar. Experimente uma das perguntas sugeridas.' };
  }
  return { clone, uid, normalize, exercises, exercise, seed, validateWorkout, validateItem, startSession, validRow, completedRows, volume, finishSession, since, inPeriod, series, stats, propose, applyProposal, respond };
});
