const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
for (const name of ['index.html', 'manifest.webmanifest', 'src', 'assets']) {
  fs.cpSync(path.join(root, name), path.join(dist, name), { recursive: true });
}
console.log('Versão estática preparada em dist/.');
