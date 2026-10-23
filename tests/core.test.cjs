const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../src/core.js');

test('dados iniciais possuem sessões coerentes e volume calculado a partir das séries', () => {
  const state = R.seed(new Date('2026-10-16T12:00:00-03:00'));
  assert.ok(state.sessions.length >= 20);
  assert.equal(R.volume(state.sessions[0]), state.sessions[0].entries.flatMap(e=>e.rows).reduce((n,r)=>n+r.weight*r.reps,0));
  assert.ok(state.sessions.every(s=>s.status==='finished'&&new Date(s.endedAt)<new Date('2026-10-16T12:00:00-03:00')));
});
test('conta nova começa sem fichas e sem histórico de outra conta', () => {
  const fresh=R.seed(new Date(),false),demo=R.seed();
  assert.equal(fresh.sessions.length,0);assert.equal(fresh.workouts.length,0);assert.equal(fresh.consent,false);
  fresh.profile.name='Outra pessoa';assert.notEqual(fresh.profile.name,demo.profile.name);
});
test('ficha vazia não inicia; rascunho vazio pode ser validado', () => {
  const state=R.seed();const w={id:'empty',name:'Rascunho',status:'draft',items:[]};
  R.validateWorkout(w);state.workouts.push(w);assert.throws(()=>R.startSession(state,'empty'));
});
test('sessão contém snapshot e alterações futuras da ficha não mudam o histórico', () => {
  const state=R.seed();R.startSession(state,'push');const name=state.active.entries[0].name;
  state.workouts[0].name='Outro nome';state.workouts[0].items[0].weight=999;
  state.active.entries[0].rows[0]={weight:50,reps:10,done:true};
  const finished=R.finishSession(state);const length=state.sessions.length;
  assert.equal(finished.name,'Push');assert.equal(finished.entries[0].name,name);assert.equal(R.volume(finished),500);
  assert.equal(finished.entries[0].rows[1].weight,50);
  state.workouts[0].status='archived';assert.equal(state.sessions.at(-1).name,'Push');
  assert.throws(()=>R.finishSession(state));assert.equal(state.sessions.length,length);
});
test('iniciar outra ficha retoma sessão existente sem duplicar', () => {
  const s=R.seed();const a=R.startSession(s,'push');assert.equal(R.startSession(s,'pull').id,a.id);
});
test('valores inválidos são rejeitados e sessões vazias não finalizam', () => {
  const s=R.seed();R.startSession(s,'push');assert.throws(()=>R.finishSession(s));
  for(const row of [{weight:-1,reps:10},{weight:20,reps:1.5},{weight:'',reps:10},{weight:NaN,reps:10},{weight:20,reps:201}])assert.equal(R.validRow(row),false);
  assert.equal(R.validRow({weight:0,reps:0}),true);
  s.active.entries[0].rows[0]={weight:-1,reps:10,done:true};assert.throws(()=>R.finishSession(s));assert.ok(s.active);
});
test('métricas usam somente séries concluídas no exercício e período escolhidos', () => {
  const s=R.seed(new Date(),false),now=new Date();
  s.sessions=[{id:'s',status:'finished',endedAt:now.toISOString(),entries:[{exerciseId:'bench',rows:[{weight:50,reps:10,done:true},{weight:999,reps:10,done:false}]},{exerciseId:'row',rows:[{weight:30,reps:5,done:true}]}]}];
  const p=R.series(s,'bench',28,now);assert.equal(p.length,1);assert.equal(p[0].load,50);assert.equal(p[0].volume,500);assert.equal(p[0].reps,10);
  assert.equal(R.series(s,'squat',28,now).length,0);
  s.sessions[0].status='active';assert.equal(R.series(s,'bench',28,now).length,0);
});
test('consentimento bloqueia análise do histórico e revogação vale na próxima pergunta', () => {
  const s=R.seed();assert.equal(R.respond(s,'Como estou evoluindo no supino?').category,'consent');
  s.consent=true;const response=R.respond(s,'Como estou evoluindo no supino?');assert.equal(response.category,'history');assert.match(response.context,/Supino/);
  assert.doesNotMatch(response.text,/Victor/);s.consent=false;assert.equal(R.respond(s,'Como estou evoluindo no supino?').category,'consent');
});
test('pedidos de alteração e sintomas não executam operações', () => {
  const s=R.seed(),before=JSON.stringify(s.workouts);
  assert.equal(R.respond(s,'Meu ombro dói, o que eu tenho?').category,'health');
  assert.equal(R.respond(s,'Quero uma carga máxima extrema').category,'risk');
  assert.equal(R.respond(s,'Troque meu treino').category,'proposal');assert.equal(JSON.stringify(s.workouts),before);
});
test('proposta exige confirmação e só pode ser aplicada uma vez', () => {
  const s=R.seed();const count=s.workouts.length;
  const p=R.propose(s,{goal:'Hipertrofia',level:'Iniciante',frequency:3,duration:25});
  assert.equal(s.workouts.length,count);assert.equal(p.workout.items.length,3);assert.equal(p.workout.items[0].sets,2);
  const w=R.applyProposal(s,p.id);assert.equal(w.origin,'ai');assert.equal(s.workouts.length,count+1);
  assert.throws(()=>R.applyProposal(s,p.id));assert.equal(s.workouts.length,count+1);
});
test('propostas rejeitadas, expiradas ou editadas com dados inválidos não criam fichas', () => {
  const s=R.seed(),params={goal:'Força',level:'Intermediário',frequency:4,duration:50};
  const a=R.propose(s,params);a.status='rejected';assert.throws(()=>R.applyProposal(s,a.id));
  const b=R.propose(s,params);b.expiresAt='2020-01-01';assert.throws(()=>R.applyProposal(s,b.id));
  const c=R.propose(s,params);const bad=R.clone(c.workout);bad.items[0].weight=-1;assert.throws(()=>R.applyProposal(s,c.id,bad));assert.equal(c.status,'pending');assert.equal(s.workouts.length,3);
});
test('indisponibilidade do assistente não bloqueia treino e histórico', () => {
  const s=R.seed();s.aiAvailable=false;assert.equal(R.respond(s,'Como usar o aplicativo?').category,'unavailable');
  R.startSession(s,'push');s.active.entries[0].rows[0].done=true;R.finishSession(s);assert.ok(s.sessions.length>0);
});
