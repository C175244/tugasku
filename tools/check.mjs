// Pemeriksaan ringan import, kontrak Supabase, modul yatim, dan deadline.
import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const jsRoot = resolve(root, 'assets/js');
const files = [];

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const file = resolve(directory, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.name.endsWith('.js')) files.push(file);
  }
};

await walk(jsRoot);
const texts = new Map();
const missing = [];
// Titik masuk: aplikasi utama dan konsol developer (developer.html).
const imported = new Set([
  resolve(jsRoot, 'main.js'),
  resolve(jsRoot, 'dev/devMain.js'),
]);

for (const file of files) {
  const text = await readFile(file, 'utf8');
  texts.set(file, text);
  for (const match of text.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
    if (!match[1].startsWith('.')) continue;
    const target = resolve(dirname(file), match[1]);
    imported.add(target);
    try {
      await access(target);
    } catch {
      missing.push(`${relative(root, file)}: ${match[1]}`);
    }
  }
}

if (missing.length) {
  throw new Error(`Import tidak ditemukan:\n${missing.join('\n')}`);
}

const orphaned = files.filter((file) => !imported.has(file));
if (orphaned.length) {
  throw new Error(
    `Modul yatim tidak diimpor:\n${orphaned.map((file) => relative(root, file)).join('\n')}`,
  );
}

const sqlDirectory = resolve(root, 'supabase');
const sqlFiles = (await readdir(sqlDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => resolve(sqlDirectory, entry.name));
const schema = (await Promise.all(
  sqlFiles.map((file) => readFile(file, 'utf8')),
)).join('\n');
const schemaTables = new Set(
  [...schema.matchAll(/create table if not exists public\.([a-z_]+)/gi)]
    .map((match) => match[1]),
);
const schemaFunctions = new Set(
  [...schema.matchAll(/create (?:or replace )?function public\.([a-z_]+)/gi)]
    .map((match) => match[1]),
);
const usedTables = new Set();
const usedFunctions = new Set();

for (const text of texts.values()) {
  for (const match of text.matchAll(/\.from\(\s*['"]([a-z_]+)['"]\s*\)/gi)) {
    usedTables.add(match[1]);
  }
  for (const match of text.matchAll(/\.rpc\(\s*['"]([a-z_]+)['"]\s*[,)]/gi)) {
    usedFunctions.add(match[1]);
  }
}

const unknownTables = [...usedTables].filter(
  (table) => !schemaTables.has(table),
);
const unknownFunctions = [...usedFunctions].filter(
  (name) => !schemaFunctions.has(name),
);
if (unknownTables.length || unknownFunctions.length) {
  throw new Error([
    unknownTables.length
      ? `Tabel tidak ada di schema: ${unknownTables.join(', ')}`
      : '',
    unknownFunctions.length
      ? `RPC tidak ada di schema: ${unknownFunctions.join(', ')}`
      : '',
  ].filter(Boolean).join('\n'));
}

const source = await readFile(resolve(jsRoot, 'utils/datetime.js'), 'utf8');
const exported = source
  .replace(/export const /g, 'const ')
  .replace(/export \{[^}]+\};?/g, '');
const nextOccurrence = new Function(
  `${exported}; return nextOccurrence;`,
)();
const equal = (a, b) => a.getTime() === b.getTime();
const rolled = nextOccurrence(
  new Date('2025-01-06T10:00:00Z'),
  1,
  '09:00:00',
);
if (!equal(rolled, new Date('2025-01-13T09:00:00Z'))) {
  throw new Error('Gagal: roll ke minggu depan');
}
const stable = nextOccurrence(
  new Date('2025-01-06T08:00:00Z'),
  1,
  '10:00:00',
);
if (!equal(stable, new Date('2025-01-06T10:00:00Z'))) {
  throw new Error('Gagal: zona waktu stabil');
}
const sameDayAfter = nextOccurrence(
  new Date('2025-01-06T08:00:00Z'),
  1,
  '09:00:00',
);
if (!equal(sameDayAfter, new Date('2025-01-06T09:00:00Z'))) {
  throw new Error('Gagal: kejadian hari ini');
}

console.log(
  `OK: ${files.length} file JavaScript, import/kontrak/orphan valid, `
  + '3 cek deadline lulus.',
);
