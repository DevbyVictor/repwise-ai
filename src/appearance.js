/* Preferência visual independente das contas e dos dados de treino. */
(() => {
  'use strict';
  const key = 'repwise:appearance:v1';
  const system = matchMedia('(prefers-color-scheme: dark)');
  const valid = value => ['system', 'light', 'dark'].includes(value);
  let choice = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) choice = saved; } catch {}
  const dark = () => choice === 'dark' || (choice === 'system' && system.matches);
  const sun = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  const moon = '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>';
  function button() {
    const label = dark() ? 'Ativar modo claro' : 'Ativar modo escuro';
    return `<button type="button" class="icon-btn theme-toggle" data-appearance-toggle aria-label="${label}" title="${label}"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${dark() ? sun : moon}</svg></button>`;
  }
  function apply() {
    document.documentElement.dataset.theme = dark() ? 'dark' : 'light';
    document.documentElement.dataset.appearance = choice;
    document.documentElement.style.colorScheme = dark() ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark() ? '#0c1017' : '#f5f5f7');
    document.querySelectorAll('[data-appearance-toggle]').forEach(el => {
      const label = dark() ? 'Ativar modo claro' : 'Ativar modo escuro';
      el.setAttribute('aria-label', label); el.title = label;
      el.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${dark() ? sun : moon}</svg>`;
    });
    document.querySelectorAll('[data-appearance-select]').forEach(el => { el.value = choice; });
    window.dispatchEvent(new CustomEvent('repwise:appearance', { detail: { choice, theme: dark() ? 'dark' : 'light' } }));
  }
  function set(value) {
    if (!valid(value)) return;
    choice = value;
    try { localStorage.setItem(key, choice); } catch {}
    apply();
  }
  window.RepWiseAppearance = { button, set, get: () => choice };
  apply();
  document.addEventListener('click', event => { if (event.target.closest('[data-appearance-toggle]')) set(dark() ? 'light' : 'dark'); });
  document.addEventListener('change', event => { if (event.target.matches('[data-appearance-select]')) set(event.target.value); });
  system.addEventListener('change', () => { if (choice === 'system') apply(); });
  window.addEventListener('storage', event => { if (event.key === key) { choice = valid(event.newValue) ? event.newValue : 'system'; apply(); } });
})();
