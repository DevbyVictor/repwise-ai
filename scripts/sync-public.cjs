const fs = require('node:fs');
for (const file of ['src', 'assets', 'manifest.webmanifest']) fs.cpSync(file, `public/${file}`, {recursive:true});
