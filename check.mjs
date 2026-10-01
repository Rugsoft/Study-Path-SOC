/**
 * Verificacion del sitio generado: enlaces, backlinks y datos publicados.
 *
 *   node check.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'site');
const index = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'index.json'), 'utf8'));
const notesDir = path.join(OUT, 'data', 'notes');

const files = fs.readdirSync(notesDir).map((f) => f.replace(/\.json$/, ''));
const ids = new Set(index.notes.map((n) => n.id));

let broken = 0;
let links = 0;
let duplicates = 0;

for (const id of files) {
  const note = JSON.parse(fs.readFileSync(path.join(notesDir, `${id}.json`), 'utf8'));
  const seen = new Set();
  for (const m of note.html.matchAll(/nota\.html\?id=([^"'&]+)/g)) {
    links += 1;
    const target = decodeURIComponent(m[1]);
    if (seen.has(target)) duplicates += 1;
    seen.add(target);
    if (!files.includes(target)) {
      broken += 1;
      console.log(`  ROTO   ${id} -> ${target}`);
    }
  }
}

// Cada backlink debe apuntar a una nota real. Y la relacion es UNIDIRECCIONAL:
// si A enlaza a B, el backlinks de B tiene que listar a A. No al reves.
let badBacklinks = 0;
let missingInbound = 0;
let totalBacklinks = 0;

const cache = new Map();
const loadNote = (id) => {
  if (!cache.has(id)) {
    cache.set(id, JSON.parse(fs.readFileSync(path.join(notesDir, `${id}.json`), 'utf8')));
  }
  return cache.get(id);
};

for (const id of files) {
  const note = loadNote(id);
  if (!Array.isArray(note.backlinks)) {
    badBacklinks += 1;
    console.log(`  SIN CAMPO backlinks  ${id}`);
    continue;
  }
  for (const b of note.backlinks) {
    totalBacklinks += 1;
    if (!ids.has(b.id)) {
      badBacklinks += 1;
      console.log(`  BACKLINK ROTO ${id} -> ${b.id}`);
    }
  }
}

// Cada enlace saliente debe estar reflejado en los backlinks del destino.
for (const id of files) {
  const note = loadNote(id);
  const seen = new Set();
  for (const m of note.html.matchAll(/nota\.html\?id=([^"'&]+)/g)) {
    const targetId = decodeURIComponent(m[1]);
    if (targetId === id || seen.has(targetId)) continue;
    seen.add(targetId);
    if (!ids.has(targetId)) continue;
    const target = loadNote(targetId);
    if (!target.backlinks.some((x) => x.id === id)) {
      missingInbound += 1;
      console.log(`  SIN REFLEJAR  ${id} -> ${targetId}`);
    }
  }
}

// search.json ya no debe llevar el campo text.
const search = JSON.parse(fs.readFileSync(path.join(OUT, 'data', 'search.json'), 'utf8'));
const withText = search.docs.filter((d) => 'text' in d).length;

const orphans = files.filter((id) => {
  const note = JSON.parse(fs.readFileSync(path.join(notesDir, `${id}.json`), 'utf8'));
  return note.backlinks.length === 0;
});

console.log('');
console.log(`  Notas                ${files.length}`);
console.log(`  Enlaces internos    ${links} (${duplicates} repetidos)`);
console.log(`  Rotos                ${broken}`);
console.log(`  Backlinks totales    ${totalBacklinks}`);
console.log(`  Backlinks invalidos  ${badBacklinks}`);
console.log(`  Enlaces sin reflejo  ${missingInbound}`);
console.log(`  Sin backlinks        ${orphans.length}`);
console.log(`  search.json con text ${withText} (debe ser 0)`);
console.log('');

process.exit(broken || badBacklinks || missingInbound || withText ? 1 : 0);