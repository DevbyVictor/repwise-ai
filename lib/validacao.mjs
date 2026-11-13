import R from '../src/core.js';

const goals = ['Hipertrofia', 'Força', 'Condicionamento', 'Qualidade de vida'];
const levels = ['Iniciante', 'Intermediário', 'Avançado'];

function requireValue(condition, message = 'Revise os dados do perfil e dos treinos.') {
  if (!condition) throw new Error(message);
}
function text(value, max, empty = true) {
  requireValue(typeof value === 'string' && value.length <= max && (empty || value.trim().length > 0));
}
function integer(value, min, max) {
  requireValue(Number.isInteger(value) && value >= min && value <= max);
}
function identifier(value) {
  requireValue(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,200}$/.test(value));
}
function date(value) {
  requireValue(typeof value === 'string' && Number.isFinite(Date.parse(value)));
}
function list(value, max) {
  requireValue(Array.isArray(value) && value.length <= max);
}
function uniqueIds(values) {
  requireValue(new Set(values.map(value => value.id)).size === values.length, 'Os dados contêm identificadores duplicados.');
}
function validateWorkout(workout, proposal = false) {
  requireValue(workout && ['push', 'pull', 'legs'].includes(workout.style));
  if (!proposal) {
    identifier(workout.id);
    requireValue(['draft', 'active', 'archived'].includes(workout.status));
  }
  list(workout.items, 30);
  R.validateWorkout(workout);
  text(workout.subtitle ?? '', 300);
  requireValue(workout.origin === undefined || ['user', 'ai'].includes(workout.origin));
  if (workout.status === 'active') requireValue(workout.items.length > 0);
}
function validateSession(session, active = false) {
  identifier(session.id);
  text(session.name, 100, false);
  date(session.startedAt);
  if (session.workoutId != null) identifier(session.workoutId);
  text(session.note ?? '', 1000);
  list(session.entries, 30);
  requireValue(session.entries.length > 0 && session.status === (active ? 'active' : 'finished'));
  if (!active) {
    date(session.endedAt);
    requireValue(Date.parse(session.endedAt) >= Date.parse(session.startedAt));
    integer(session.duration, 1, Number.MAX_SAFE_INTEGER);
  }
  for (const entry of session.entries) {
    R.validateItem(entry);
    text(entry.name, 120, false);
    text(entry.note ?? '', 500);
    list(entry.rows, 20);
    requireValue(entry.rows.length > 0);
    for (const row of entry.rows) {
      requireValue(typeof row.done === 'boolean');
      requireValue(row.weight === '' || (typeof row.weight === 'number' && Number.isFinite(row.weight) && row.weight >= 0 && row.weight <= 1000));
      if (row.reps !== '') integer(row.reps, 0, 200);
      if (row.done) requireValue(R.validRow(row));
    }
  }
  if (!active) requireValue(session.entries.some(entry => entry.rows.some(row => row.done)));
}
export function validateState(input) {
  requireValue(input && input.version === 1 && input.profile);
  const state = structuredClone(input);
  const profile = state.profile;
  text(profile.name, 80, false);
  requireValue(goals.includes(profile.goal) && levels.includes(profile.level));
  integer(profile.frequency, 1, 7);
  integer(profile.duration, 15, 120);
  text(profile.preferences, 500);
  requireValue(typeof state.consent === 'boolean' && typeof state.aiAvailable === 'boolean');
  list(state.workouts, 200);
  list(state.sessions, 2000);
  list(state.messages, 2000);
  list(state.proposals, 500);
  list(state.audit, 10000);
  uniqueIds(state.workouts);
  uniqueIds(state.sessions);
  uniqueIds(state.messages);
  uniqueIds(state.proposals);
  state.workouts.forEach(workout => validateWorkout(workout));
  state.sessions.forEach(session => validateSession(session));
  requireValue(state.active === null || (state.active && typeof state.active === 'object'));
  if (state.active) {
    validateSession(state.active, true);
    requireValue(!state.sessions.some(session => session.id === state.active.id));
  }
  const proposalIds = new Set(state.proposals.map(proposal => proposal.id));
  const appliedIds = new Set();
  for (const message of state.messages) {
    identifier(message.id);
    requireValue(['user', 'assistant'].includes(message.role));
    text(message.text, 10000);
    if (message.category != null) text(message.category, 80);
    if (message.context != null) text(message.context, 500);
    if (message.at != null) date(message.at);
    if (message.proposalId != null) requireValue(message.role === 'assistant' && proposalIds.has(message.proposalId));
    if (message.feedback != null) requireValue(message.role === 'assistant' && ['useful', 'inappropriate'].includes(message.feedback));
  }
  for (const proposal of state.proposals) {
    identifier(proposal.id);
    requireValue(['pending', 'applied', 'rejected'].includes(proposal.status));
    date(proposal.createdAt);
    date(proposal.expiresAt);
    if (proposal.decidedAt != null) date(proposal.decidedAt);
    requireValue(proposal.params && goals.includes(proposal.params.goal) && levels.includes(proposal.params.level));
    integer(proposal.params.frequency, 1, 7);
    integer(proposal.params.duration, 15, 120);
    validateWorkout(proposal.workout, true);
    if (proposal.status === 'applied') {
      identifier(proposal.workoutId);
      requireValue(!appliedIds.has(proposal.workoutId));
      appliedIds.add(proposal.workoutId);
      requireValue(state.workouts.some(workout => workout.id === proposal.workoutId && workout.origin === 'ai'));
    }
  }
  for (const event of state.audit) {
    text(event.type, 100, false);
    date(event.at);
    if (event.proposalId != null) identifier(event.proposalId);
  }
  for (const workout of state.workouts) {
    workout.subtitle ??= '';
    workout.origin ??= 'user';
  }
  for (const session of [...state.sessions, ...(state.active ? [state.active] : [])]) {
    session.note ??= '';
    for (const entry of session.entries) entry.note ??= '';
  }
  return state;
}
export function validateCredentials(input, registration) {
  requireValue(input && typeof input === 'object');
  text(input.email, 254, false);
  const email = input.email.trim().toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  text(input.password, 128, false);
  requireValue(input.password.length >= 8);
  if (registration) {
    text(input.name, 80, false);
    requireValue(input.password === input.confirmPassword);
  }
  return { email, password: input.password, name: input.name?.trim() };
}
