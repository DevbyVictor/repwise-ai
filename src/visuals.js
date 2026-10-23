/* Camada visual: ilustrações vetoriais locais e efeitos sem alterar os dados. */
(() => {
  'use strict';
  let sequence = 0;
  function art(style = 'push', hero = false) {
    if (!hero && style !== 'push' && window.RepWiseExperience) return window.RepWiseExperience.equipment(style);
    const id = `rw-v3-${++sequence}`;
    const accent = style === 'legs' ? '#9da8ff' : style === 'pull' ? '#8ee2de' : '#c4ff64';
    const dim = hero ? '#0c1116' : '#e9edf1';
    return `<svg class="sculpture" viewBox="0 0 520 400" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${id}-metal" x1="118" y1="85" x2="360" y2="320" gradientUnits="userSpaceOnUse"><stop stop-color="#f6fbff"/><stop offset=".18" stop-color="#b2bcc9"/><stop offset=".38" stop-color="#fafcff"/><stop offset=".49" stop-color="#6a7485"/><stop offset=".63" stop-color="#d4dce8"/><stop offset=".79" stop-color="#4b5566"/><stop offset="1" stop-color="#b1bac9"/></linearGradient>
        <linearGradient id="${id}-edge" x1="0" y1="0" x2="1" y2=".7"><stop stop-color="#e5ebf4"/><stop offset=".3" stop-color="#909cac"/><stop offset=".65" stop-color="#242e40"/><stop offset="1" stop-color="#e1e7f0"/></linearGradient>
        <linearGradient id="${id}-handle" x1="188" y1="190" x2="188" y2="226" gradientUnits="userSpaceOnUse"><stop stop-color="#f8fbff"/><stop offset=".28" stop-color="#a9b7c6"/><stop offset=".55" stop-color="#3e495b"/><stop offset=".81" stop-color="#ccd4df"/><stop offset="1" stop-color="#758295"/></linearGradient>
        <linearGradient id="${id}-accent" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f7ffd7"/><stop offset=".35" stop-color="${accent}"/><stop offset="1" stop-color="${style==='legs'?'#6979db':style==='pull'?'#39aaa6':'#80bb23'}"/></linearGradient>
        <radialGradient id="${id}-halo"><stop stop-color="${accent}" stop-opacity="${hero?'.19':'.15'}"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
        <filter id="${id}-shadow" x="-50%" y="-60%" width="220%" height="240%"><feGaussianBlur stdDeviation="12"/></filter>
        <filter id="${id}-object-shadow" x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="16" stdDeviation="12" flood-color="#080f1d" flood-opacity="${hero?'.65':'.2'}"/></filter>
      </defs>
      <ellipse cx="275" cy="225" rx="224" ry="190" fill="url(#${id}-halo)"/>
      <g class="orbital-grid" opacity="${hero?'.75':'.5'}"><ellipse cx="265" cy="205" rx="202" ry="120" transform="rotate(-31 265 205)" stroke="${hero?'#a7b4cb':'#a4b0c2'}" stroke-opacity=".17"/><ellipse cx="265" cy="205" rx="188" ry="162" transform="rotate(30 265 205)" stroke="${hero?'#a7b4cb':'#a4b0c2'}" stroke-opacity=".13"/><path d="M57 205h414M265 33v344" stroke="${hero?'#a7b4cb':'#a4b0c2'}" stroke-opacity=".1" stroke-dasharray="2 7"/></g>
      <g class="orbit-track"><ellipse cx="265" cy="205" rx="211" ry="87" transform="rotate(-31 265 205)" stroke="${accent}" stroke-opacity=".35" stroke-width="1"/><circle cx="445" cy="108" r="4" fill="${accent}"/><circle cx="93" cy="299" r="2" fill="${hero?'#c6d2e2':'#8c99ad'}"/></g>
      <ellipse cx="272" cy="331" rx="122" ry="15" fill="${dim}" opacity=".65" filter="url(#${id}-shadow)"/>
      <g class="floating-object" filter="url(#${id}-object-shadow)"><g transform="translate(0 -7) rotate(-32 265 210)">
        <rect x="115" y="195" width="310" height="30" rx="9" fill="url(#${id}-handle)"/>
        <path d="M220 203h89m-89 5h89m-89 5h89m-89 5h89" stroke="#15253d" opacity=".25"/>
        <g><rect x="130" y="143" width="25" height="135" rx="12" fill="url(#${id}-edge)" stroke="#c6cfdd" stroke-opacity=".6"/><rect x="147" y="117" width="38" height="186" rx="18" fill="url(#${id}-metal)" stroke="#f2f6ff" stroke-opacity=".7"/><rect x="172" y="107" width="47" height="206" rx="22" fill="url(#${id}-edge)" stroke="#bdc8da" stroke-opacity=".65"/><rect x="176" y="110" width="24" height="200" rx="12" fill="url(#${id}-metal)"/><path d="M190 126v166" stroke="#f8fbff" stroke-opacity=".7" stroke-width="1.3"/><rect x="202" y="112" width="7" height="196" rx="3.5" fill="url(#${id}-accent)"/><path d="M157 136v146" stroke="#fff" stroke-opacity=".55"/></g>
        <g><rect x="355" y="143" width="25" height="135" rx="12" fill="url(#${id}-edge)" stroke="#c6cfdd" stroke-opacity=".6"/><rect x="326" y="117" width="38" height="186" rx="18" fill="url(#${id}-metal)" stroke="#f2f6ff" stroke-opacity=".7"/><rect x="296" y="107" width="47" height="206" rx="22" fill="url(#${id}-edge)" stroke="#bdc8da" stroke-opacity=".65"/><rect x="300" y="110" width="24" height="200" rx="12" fill="url(#${id}-metal)"/><path d="M314 126v166" stroke="#f8fbff" stroke-opacity=".8" stroke-width="1.3"/><rect x="330" y="120" width="7" height="180" rx="3.5" fill="url(#${id}-accent)"/><path d="M348 136v146" stroke="#fff" stroke-opacity=".5"/></g>
      </g></g>
      ${hero?`<g class="sculpture-detail"><path d="M420 315h10m-5-5v10" stroke="#bfccdd" stroke-opacity=".5"/><path d="M92 97h8m-4-4v8" stroke="#bfccdd" stroke-opacity=".35"/><circle cx="410" cy="58" r="2" fill="#dce5f1" opacity=".7"/></g>`:''}
    </svg>`;
  }
  window.RepWiseVisual = { art };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let intersection, mountedFrame = 0, pointerFrame = 0;
  function mount() {
    mountedFrame = 0;
    const app = document.getElementById('app');
    if (!app) return;
    app.querySelectorAll('.stat:not([data-reveal]), .workout-card:not([data-reveal]), .exercise-catalog:not([data-reveal]), .dashboard-right > .panel:not([data-reveal])').forEach((el,index) => {
      el.dataset.reveal = '';
      el.style.setProperty('--reveal-delay', `${Math.min(index % 4 * 45, 135)}ms`);
      if (reduced.matches || !intersection) el.dataset.visible = 'true';
      else intersection.observe(el);
    });
  }
  document.addEventListener('DOMContentLoaded', () => {
    if ('IntersectionObserver' in window) intersection = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.dataset.visible = 'true';
        intersection.unobserve(entry.target);
      }
    }, { threshold: .04, rootMargin: '30px' });
    const app = document.getElementById('app');
    new MutationObserver(records => {
      if (records.some(record => record.target === app)) intersection?.disconnect();
      if (records.some(r => r.addedNodes.length || r.removedNodes.length) && !mountedFrame) mountedFrame = requestAnimationFrame(mount);
    }).observe(app, { childList: true, subtree: true });
    mount();
  });
  document.addEventListener('pointermove', event => {
    if (reduced.matches || !finePointer.matches || pointerFrame) return;
    const el = event.target.closest('.hero, .workout-card, .coach-panel, .login-story');
    if (!el) return;
    pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!el.isConnected) return;
      const box = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
      const y = Math.max(0, Math.min(1, (event.clientY - box.top) / box.height));
      el.style.setProperty('--light-x', `${x * 100}%`);
      el.style.setProperty('--light-y', `${y * 100}%`);
      if (el.matches('.hero, .login-story')) {
        el.style.setProperty('--parallax-x', `${(x - .5) * 13}px`);
        el.style.setProperty('--parallax-y', `${(y - .5) * 9}px`);
      }
    });
  }, { passive: true });
  document.addEventListener('pointerout', event => {
    const el = event.target.closest('.hero, .login-story');
    if (el && !el.contains(event.relatedTarget)) {
      el.style.setProperty('--parallax-x', '0px');
      el.style.setProperty('--parallax-y', '0px');
    }
  }, { passive: true });
  document.addEventListener('pointerdown', event => {
    if (reduced.matches) return;
    const button = event.target.closest('.btn, .check-set, .nav-link');
    if (!button || button.disabled) return;
    const box = button.getBoundingClientRect(), ripple = document.createElement('span');
    ripple.className = 'touch-ripple';
    ripple.setAttribute('aria-hidden', 'true');
    ripple.style.left = `${event.clientX - box.left}px`;
    ripple.style.top = `${event.clientY - box.top}px`;
    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }, { passive: true });
})();
