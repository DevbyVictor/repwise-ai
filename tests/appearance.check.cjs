// Opcional: exige Playwright. Não é dependência da execução do aplicativo.
const { chromium } = require(process.env.REPWISE_PLAYWRIGHT || 'playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

(async () => {
  const server = spawn(process.execPath, [path.join(root, 'server.cjs')], {
    env: { ...process.env, PORT: '4183' }, stdio: 'pipe', windowsHide: true
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.once('data', resolve); server.once('error', reject);
      server.once('exit', code => reject(Error(`Servidor encerrado: ${code}`)));
    });
    browser = await chromium.launch({ headless: true, executablePath: process.env.REPWISE_BROWSER || (fs.existsSync(edge) ? edge : undefined) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4183');
    await page.getByRole('button', { name: 'Ativar modo escuro', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: 'Entrar na demonstração' }).click();
    await page.getByRole('heading', { name: /Vamos nessa/ }).waitFor();
    assert.equal(await page.locator('.activity-rings .ring-value').count(), 3);
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    console.log('PASS: tema persistente e três anéis de indicadores');
    await page.locator('.top-actions .avatar').click();
    await page.getByLabel('Tema do aplicativo', { exact: true }).selectOption('system');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.getByLabel('Tema do aplicativo', { exact: true }).selectOption('dark');
    await page.emulateMedia({ colorScheme: 'light' });
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    console.log('PASS: preferência automática e escolha explícita');
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('http://127.0.0.1:4183/#workouts');
    await page.getByRole('button', { name: 'Iniciar', exact: true }).first().click();
    await page.locator('.session-banner').waitFor();
    await page.getByRole('button', { name: /Concluir série 1 de/ }).first().click();
    await page.locator('.series-celebrate').waitFor();
    assert.equal(await page.locator('.check-set[aria-pressed=true]').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('button', { name: 'Finalizar treino', exact: true }).click();
    await page.getByRole('button', { name: 'Confirmar finalização' }).click();
    await page.getByRole('heading', { name: 'Seu histórico', exact: true }).waitFor();
    console.log('PASS: sessão móvel em modo escuro e finalização');
    await page.goto('http://127.0.0.1:4183/#coach');
    await page.locator('.assistant-stage .orb-core').waitFor();
    assert.equal(await page.locator('.assistant-stage .orb-core').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.getByRole('button', { name: 'Como registrar um treino?' }).click();
    await page.getByText(/Em Meus treinos, crie/).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: assistente, movimento reduzido e ausência de erros');
    const fallbackContext = await browser.newContext({ reducedMotion: 'reduce', colorScheme: 'dark' });
    await fallbackContext.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === 'webgl' ? null : original.call(this, kind, ...args);
      };
    });
    const fallback = await fallbackContext.newPage();
    await fallback.goto('http://127.0.0.1:4183');
    await fallback.getByRole('button', { name: 'Entrar na demonstração' }).click();
    await fallback.locator('.hero-art[data-renderer=svg]').waitFor();
    assert.equal(await fallback.locator('.training-canvas').count(), 0);
    await fallback.locator('.hero-art .floating-object').waitFor();
    console.log('PASS: alternativa vetorial quando WebGL está indisponível');
  } finally { await browser?.close(); server.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
