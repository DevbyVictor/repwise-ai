// Instala o Ollama (se necessário), baixa o modelo do assistente e confere se ele responde.
// Uso: npm run ia:instalar   |   somente verificar: npm run ia:verificar
import { spawn, spawnSync } from 'node:child_process';
import { ollamaConfig } from '../lib/assistente.mjs';

const onlyCheck = process.argv.includes('--verificar');
const windows = process.platform === 'win32';
const run = (command, args, options = {}) =>
  spawnSync(command, args, { stdio: 'inherit', shell: windows, ...options });
const hasOllama = () => spawnSync('ollama', ['--version'], { stdio: 'ignore', shell: windows }).status === 0;

async function serverUp() {
  try { return (await fetch(new URL('/api/tags', ollamaConfig.url), { signal: AbortSignal.timeout(3000) })).ok; }
  catch { return false; }
}

function install() {
  console.log('Instalando o Ollama...');
  let result;
  if (windows) result = run('winget', ['install', '--id', 'Ollama.Ollama', '-e', '--accept-source-agreements', '--accept-package-agreements']);
  else if (process.platform === 'darwin') result = run('brew', ['install', 'ollama']);
  else result = run('sh', ['-c', 'curl -fsSL https://ollama.com/install.sh | sh']);
  if (result.status !== 0 || !hasOllama()) {
    console.error('\nNão foi possível instalar automaticamente. Baixe o Ollama em https://ollama.com/download,'
      + ' instale, feche e abra o terminal e rode este comando de novo.');
    process.exit(1);
  }
}

if (!hasOllama()) {
  if (onlyCheck) {
    console.error('Ollama não encontrado. Rode: npm run ia:instalar');
    process.exit(1);
  }
  install();
}

if (!await serverUp()) {
  if (onlyCheck) {
    console.error(`O Ollama está instalado, mas não está aberto em ${ollamaConfig.url}. Abra o aplicativo Ollama ou rode: ollama serve`);
    process.exit(1);
  }
  console.log('Iniciando o Ollama...');
  spawn('ollama', ['serve'], { detached: true, stdio: 'ignore', shell: windows }).unref();
  for (let i = 0; i < 20 && !await serverUp(); i++) await new Promise(resolve => setTimeout(resolve, 500));
  if (!await serverUp()) {
    console.error('O Ollama não abriu. Abra o aplicativo Ollama e rode este comando de novo.');
    process.exit(1);
  }
}

const tags = await (await fetch(new URL('/api/tags', ollamaConfig.url))).json();
const installed = tags.models?.some(m => m.name === ollamaConfig.model || m.name === ollamaConfig.model + ':latest');
if (!installed) {
  if (onlyCheck) {
    console.error(`O modelo ${ollamaConfig.model} não foi baixado. Rode: npm run ia:instalar`);
    process.exit(1);
  }
  console.log(`Baixando o modelo ${ollamaConfig.model}...`);
  if (run('ollama', ['pull', ollamaConfig.model]).status !== 0) {
    console.error('Falha ao baixar o modelo. Verifique a internet e tente de novo.');
    process.exit(1);
  }
}

console.log(`Testando o modelo ${ollamaConfig.model}...`);
const response = await fetch(new URL('/api/chat', ollamaConfig.url), {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: ollamaConfig.model, stream: false,
    messages: [{ role: 'user', content: 'Responda em uma frase curta, em português: o que é uma série na musculação?' }] })
});
const answer = (await response.json()).message?.content?.trim();
if (!response.ok || !answer) {
  console.error('O modelo não respondeu. Tente: ollama run ' + ollamaConfig.model);
  process.exit(1);
}
console.log(`Resposta do modelo: ${answer}\n\nTudo pronto. Inicie o RepWise com: npm start`);
