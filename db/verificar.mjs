import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './banco.mjs';

const file = process.env.REPWISE_DB
  ? resolve(process.env.REPWISE_DB)
  : fileURLToPath(new URL('../dados/repwise.sqlite', import.meta.url));
const db = openDatabase(file);
try {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all();
  console.log('Integridade', db.prepare('PRAGMA integrity_check').get().integrity_check);
  console.log('Violações de chaves estrangeiras', db.prepare('PRAGMA foreign_key_check').all().length);
  for (const { name } of tables) {
    console.log(name, db.prepare('SELECT COUNT(*) AS total FROM "' + name + '"').get().total);
  }
} finally { db.close(); }
