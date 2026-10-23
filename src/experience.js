/* Anéis, identidade do assistente e transições da apresentação. */
(() => {
  'use strict';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let seq=0;
  let navigating=false;
  const orb=(size='large',thinking=false)=>`<div class="assistant-orb ${size} ${thinking?'thinking':''}" aria-hidden="true"><div class="orb-halo"></div><div class="orb-core"></div><i></i><i></i><i></i><span></span></div>`;
  function rings(values,percent) {
    const id=`activity-${++seq}`;
    return `<div class="activity-rings"><svg viewBox="0 0 170 170" role="img" aria-label="Meta semanal: ${percent} por cento"><defs>${['#c7f77c','#7bded6','#b6a0ff'].map((c,i)=>`<linearGradient id="${id}-${i}" x1="0" y1="1" x2="1" y2="0"><stop stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}"/></linearGradient>`).join('')}</defs><g transform="rotate(-90 85 85)">${[68,52,36].map((r,i)=>`<circle class="ring-track" cx="85" cy="85" r="${r}"/><circle class="ring-value ring-${i}" cx="85" cy="85" r="${r}" pathLength="100" stroke="url(#${id}-${i})" stroke-dasharray="100 100" style="--ring-offset:${100-Math.max(0,Math.min(1,values[i]))*100};stroke-dashoffset:var(--ring-offset)"/>`).join('')}</g></svg><div class="ring-center"><strong>${percent}<small>%</small></strong><span>meta semanal</span></div></div>`;
  }
  function transition(source,update) {
    if(navigating)return;
    if(reduced.matches||!document.startViewTransition||!source){update();return;}
    navigating=true;
    source.style.viewTransitionName='training-stage';
    const t=document.startViewTransition(()=>{source.style.viewTransitionName='';update();});
    t.ready.catch(()=>{});t.finished.then(()=>{navigating=false;},()=>{navigating=false;});
  }
  function completeSet(exercise,row) {
    const el=document.querySelector(`[data-action="toggle-set"][data-e="${exercise}"][data-r="${row}"]`);
    el?.closest('.set-grid')?.classList.add('series-celebrate');
  }
  function equipment(style) {
    const id=`equipment-${++seq}`,pull=style==='pull';
    return `<svg class="sculpture equipment-${style}" viewBox="0 0 520 400" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true"><defs><linearGradient id="${id}-chrome" x1="130" y1="90" x2="350" y2="320" gradientUnits="userSpaceOnUse"><stop stop-color="#f8fcff"/><stop offset=".25" stop-color="#929eb2"/><stop offset=".4" stop-color="#ecf4ff"/><stop offset=".6" stop-color="#5d6c86"/><stop offset=".8" stop-color="#d7e1ee"/><stop offset="1" stop-color="#8b9bb4"/></linearGradient><radialGradient id="${id}-body" cx=".35" cy=".2" r=".9"><stop stop-color="#edf0fa"/><stop offset=".35" stop-color="#a3aac6"/><stop offset=".65" stop-color="#66728f"/><stop offset="1" stop-color="#36445d"/></radialGradient><filter id="${id}-shadow" x="-40%" y="-40%" width="180%" height="210%"><feDropShadow dx="0" dy="14" stdDeviation="10" flood-color="#263c5a" flood-opacity=".2"/></filter></defs><g opacity=".25"><ellipse cx="260" cy="210" rx="170" ry="105" stroke="${pull?'#7bbab8':'#a5a3d4'}" transform="rotate(-25 260 210)"/><ellipse cx="260" cy="210" rx="125" ry="150" stroke="${pull?'#7bbab8':'#a5a3d4'}" transform="rotate(20 260 210)"/></g><g class="floating-object" filter="url(#${id}-shadow)">${pull?`<g transform="rotate(-16 260 210)"><path d="M250 114a17 17 0 1 0 20 0" stroke="url(#${id}-chrome)" stroke-width="15"/><path d="m258 137-99 134q-10 20 12 20h177q22 0 9-20l-98-134" stroke="url(#${id}-chrome)" stroke-width="24" stroke-linejoin="round"/><rect x="183" y="274" width="152" height="29" rx="14" fill="url(#${id}-chrome)"/><rect x="199" y="278" width="120" height="20" rx="10" fill="#527379"/><path d="M207 283h103m-103 5h103m-103 5h103" stroke="#99e2dc" stroke-opacity=".55"/><path d="m252 153-87 120" stroke="#eaffff" stroke-opacity=".65" stroke-width="2"/><path d="M203 276v24m112-24v24" stroke="#8be1d8" stroke-width="6"/></g>`:`<g transform="rotate(-14 260 210)"><path d="M207 180v-38q0-47 53-47t53 47v38" stroke="url(#${id}-chrome)" stroke-width="27"/><path d="M219 152v-12q0-33 41-33" stroke="#f8faff" stroke-opacity=".6" stroke-width="3"/><path d="M201 179q-51 27-49 81 3 64 109 64t107-64q2-54-48-81-58-24-119 0" fill="url(#${id}-body)"/><path d="M187 216q18-35 55-34" stroke="#f3f4ff" stroke-opacity=".4" stroke-width="5" stroke-linecap="round"/><path d="M166 284q93 32 188 0" stroke="#aaa2f1" stroke-width="8" stroke-linecap="round"/><path d="M218 321h85" stroke="#b8c5d9" stroke-width="4" stroke-linecap="round"/></g>`}</g></svg>`;
  }
  window.RepWiseExperience={orb,rings,transition,completeSet,equipment};
})();
