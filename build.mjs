/**
 * Build de StudyPath.
 *
 * Recorre el vault, renderiza cada nota a HTML, copia los assets, construye el
 * indice de busqueda y copia los estaticos de src/ a site/.
 *
 *   node build.mjs            una pasada
 *   node build.mjs --watch    reconstruye al guardar en el vault
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { uniqueSlug } from './tools/slug.mjs';
import { classify, buildCourseIndex, TOPICS, TOPIC_BY_ID } from './tools/taxonomy.mjs';
import { renderNote } from './tools/parse.mjs';
import { buildSearchIndex, indexStats } from './tools/search-index.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'vault.config.json'), 'utf8'));
const VAULT = config.vaultPath;
const OUT = path.join(ROOT, config.outDir);
const SRC = path.join(ROOT, 'src');

/** Normaliza un nombre para poder comparar sin acentos ni mayusculas. */
const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\.md$/i, '')
    .toLowerCase()
    .trim();

/**
 * Rutas del vault que no se publican, en notacion del config (separador "/").
 * Se comparan normalizadas, asi que da igual como las escribas aqui.
 */
const excluded = (config.excludePaths ?? []).map((p) =>
  String(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase(),
);

/** Una ruta relativa al vault esta excluida si coincide con un prefijo de la lista. */
function isExcluded(relPath) {
  const rel = relPath.replace(/\\/g, '/').toLowerCase();
  return excluded.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`));
}

/* ------------------------------------------------------------------ */

function walk(dir, extensions, ignore, acc = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (ignore.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, extensions, ignore, acc);
    else if (extensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) acc.push(full);
  }
  return acc;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return 0;
  let n = 0;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dst, { recursive: true });
      n += copyDir(src, dst);
    } else {
      fs.copyFileSync(src, dst);
      n += 1;
    }
  }
  return n;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
  return Buffer.byteLength(JSON.stringify(value));
}

/* ------------------------------------------------------------------ */

function build() {
  const started = Date.now();
  const warnings = [];

  if (!fs.existsSync(VAULT)) {
    console.error(`\n  No encuentro el vault en:\n  ${VAULT}\n`);
    console.error('  Revisa vaultPath en vault.config.json\n');
    process.exit(1);
  }

  // --- Estaticos -----------------------------------------------------
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const staticFiles = copyDir(SRC, OUT);

  // --- Assets del vault ----------------------------------------------
  const assetFiles = walk(path.join(VAULT, config.assetsRoot), config.assetExtensions, config.ignoreDirs);
  const assetMap = new Map();
  const assetUsed = new Set();
  let assetBytes = 0;

  for (const file of assetFiles) {
    const base = path.basename(file);
    let name = base;
    let n = 2;
    while (assetUsed.has(name)) {
      const ext = path.extname(base);
      name = `${path.basename(base, ext)}-${n}${ext}`;
      n += 1;
    }
    assetUsed.add(name);
    const rel = `assets/img/${name}`;
    const dst = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(file, dst);
    assetBytes += fs.statSync(dst).size;
    assetMap.set(norm(base), rel);
    assetMap.set(norm(name), rel);
  }

  // --- Pasada 1: inventario -----------------------------------------
  const mdFiles = walk(VAULT, config.includeExtensions, config.ignoreDirs);
  const usedSlugs = new Map();
  const notes = [];
  const skipped = [];

  for (const file of mdFiles) {
    const rel = path.relative(VAULT, file);
    // Las exclusiones se aplican aqui, antes de registrar la nota: si una nota
    // queda en el indice sin su fichero en notes/, el buscador la encontraria y
    // el clic daria un 404. Sin nota, no hay enlace roto posible.
    if (isExcluded(rel)) {
      skipped.push(rel);
      continue;
    }
    const title = path.basename(file, path.extname(file));
    const slug = uniqueSlug(title, rel, usedSlugs);
    const { topicId, course } = classify(rel);
    notes.push({ file, rel, title, slug, id: slug, topicId, course });
  }

  // Indice por nombre normalizado para resolver enlaces y wikilinks.
  const byName = new Map();
  for (const note of notes) {
    if (!byName.has(norm(note.title))) byName.set(norm(note.title), note);
  }

  const resolveNote = (target) => {
    if (!target) return null;
    const base = path.basename(String(target).replace(/\\/g, '/'));
    const key = norm(base);
    const hit = byName.get(key);
    return hit ? { id: hit.id, title: hit.title } : null;
  };
  const resolveAsset = (target) => assetMap.get(norm(path.basename(String(target)))) ?? null;

  // --- Pasada 2: render ---------------------------------------------
  const rendered = [];

  for (const note of notes) {
    let raw;
    try {
      raw = fs.readFileSync(note.file, 'utf8');
    } catch (err) {
      warnings.push(`No se pudo leer ${note.rel}: ${err.message}`);
      continue;
    }

    let result;
    try {
      result = renderNote(raw, note.title, { resolveNote, resolveAsset });
    } catch (err) {
      warnings.push(`Error parseando ${note.rel}: ${err.message}`);
      continue;
    }

    const words = result.text.split(/\s+/).filter(Boolean).length;
    const topic = TOPIC_BY_ID.get(note.topicId) ?? TOPIC_BY_ID.get('recursos');

    rendered.push({
      id: note.id,
      slug: note.slug,
      title: note.title,
      topic: note.topicId,
      topicLabel: topic.label,
      tags: result.meta.tags,
      course: note.course,
      date: result.meta.date,
      module: result.meta.module,
      manual: result.meta.manual,
      headings: result.headings,
      text: result.text,
      excerpt: result.text.slice(0, 220),
      readingMins: Math.max(1, Math.round(words / 200)),
      codeBlocks: (raw.match(/^```/gm) ?? []).length / 2,
      words,
      html: result.html,
      relPath: note.rel,
    });
  }

  // --- Ejes de navegacion -------------------------------------------
  rendered.sort((a, b) => a.title.localeCompare(b.title, 'es'));
  const topics = TOPICS.map((t) => {
    const items = rendered.filter((n) => n.topic === t.id);
    return { ...t, count: items.length };
  }).filter((t) => t.count > 0);

  const courses = buildCourseIndex(rendered);
  const tags = [...new Set(rendered.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, 'es'));

  const totalWords = rendered.reduce((a, n) => a + n.words, 0);
  const totalCode = rendered.reduce((a, n) => a + n.codeBlocks, 0);

  // --- Escritura -----------------------------------------------------
  const notesDir = path.join(OUT, 'data', 'notes');
  fs.mkdirSync(notesDir, { recursive: true });

  let notesBytes = 0;
  for (const note of rendered) {
    notesBytes += writeJson(path.join(notesDir, `${note.id}.json`), {
      id: note.id,
      title: note.title,
      topic: note.topic,
      topicLabel: note.topicLabel,
      tags: note.tags,
      course: note.course,
      headings: note.headings,
      readingMins: note.readingMins,
      codeBlocks: note.codeBlocks,
      words: note.words,
      html: note.html,
    });
  }

  const listBytes = writeJson(path.join(OUT, 'data', 'index.json'), {
    generatedAt: new Date().toISOString(),
    // A proposito NO se publica la ruta local del vault: index.json se
    // descarga en cada visita y la ruta del disco no es info de la web.
    stats: {
      notes: rendered.length,
      topics: topics.length,
      courses: courses.length,
      tags: tags.length,
      words: totalWords,
      codeBlocks: Math.round(totalCode),
    },
    topics,
    courses: courses.map((c) => ({
      id: c.id,
      notes: c.notes,
      modules: c.modules.map((m) => ({
        name: m.name,
        code: m.code,
        notes: m.notes,
        units: m.units.map((u) => ({ name: u.name, code: u.code, notes: u.notes })),
      })),
      sessions: c.sessions.map((n) => n.id),
    })),
    tags,
    notes: rendered.map((n) => ({
      id: n.id,
      title: n.title,
      topic: n.topic,
      topicLabel: n.topicLabel,
      tags: n.tags,
      readingMins: n.readingMins,
      codeBlocks: n.codeBlocks,
      words: n.words,
      excerpt: n.excerpt,
      course: n.course
        ? {
            course: n.course.course,
            module: n.course.module,
            moduleCode: n.course.moduleCode,
            unit: n.course.unit,
            unitCode: n.course.unitCode,
            session: n.course.session,
            sessionDate: n.course.sessionDate,
          }
        : null,
    })),
  });

  const search = buildSearchIndex(rendered);
  const searchStats = indexStats(search);
  const searchBytes = writeJson(path.join(OUT, 'data', 'search.json'), search);

  // --- Informe -------------------------------------------------------
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  const ms = Date.now() - started;

  console.log('');
  console.log('  StudyPath — build completado');
  console.log('  ' + '-'.repeat(46));
  console.log(`  Notas generadas   ${rendered.length}`);
  console.log(`  Temas             ${topics.length}`);
  console.log(`  Cursos            ${courses.length}`);
  console.log(`  Tags              ${tags.length}`);
  console.log(`  Palabras          ${totalWords.toLocaleString('es-ES')}`);
  console.log(`  Bloques de codigo ${Math.round(totalCode)}`);
  if (skipped.length) {
    console.log(`  Excluidas         ${skipped.length}`);
    for (const s of skipped) console.log(`    - ${s}`);
  }
  console.log('  ' + '-'.repeat(46));
  console.log(`  Topics por area`);
  for (const t of topics) {
    const bar = '#'.repeat(Math.max(1, Math.round((t.count / topics[0].count) * 24)));
    console.log(`    ${t.label.padEnd(28)} ${String(t.count).padStart(3)}  ${bar}`);
  }
  console.log('  ' + '-'.repeat(46));
  console.log(`  data/index.json   ${kb(listBytes)}`);
  console.log(`  data/notes/*.json ${kb(notesBytes)} en ${rendered.length} ficheros`);
  console.log(`  data/search.json  ${kb(searchBytes)}  (${searchStats.tokens} tokens, media ${searchStats.avgPostings} docs/token)`);
  console.log(`  assets/img        ${assetFiles.length} ficheros, ${kb(assetBytes)}`);
  console.log(`  estaticos         ${staticFiles} ficheros`);
  console.log(`  tiempo            ${ms} ms`);

  if (warnings.length) {
    console.log('  ' + '-'.repeat(46));
    console.log(`  ${warnings.length} avisos:`);
    for (const w of warnings.slice(0, 12)) console.log(`    ! ${w}`);
  }

  console.log('');
  return { notes: rendered.length, warnings };
}

/* ------------------------------------------------------------------ */

const result = build();

if (process.argv.includes('--watch')) {
  console.log('  Observando el vault... (Ctrl+C para salir)\n');
  let timer = null;
  fs.watch(VAULT, { recursive: true }, (_event, filename) => {
    if (filename && !filename.toString().endsWith('.md')) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('  Cambio detectado, reconstruyendo...\n');
      build();
    }, 400);
  });
}