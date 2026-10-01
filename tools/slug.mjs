/**
 * Normalizacion de nombres de fichero a slugs URL-safe.
 * El vault tiene acentos, apostrofos y espacios en casi todos los nombres,
 * y al menos un nombre repetido en carpetas distintas, asi que aqui se
 * resuelve la colision de forma determinista.
 */

/** Convierte cualquier texto en un slug ASCII estable. */
export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quita diacriticos
    .replace(/['\u2019]/g, '') // apostrofos: "que's" -> "ques"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
    .replace(/-+$/, '');
}

/**
 * Reparte slugs unicos. Ante colision anade un sufijo corto derivado de la
 * carpeta, y solo si eso no basta un contador.
 *
 * @param {string} rawTitle titulo original del fichero
 * @param {string} relPath ruta relativa al vault, usada para desambiguar
 * @param {Map<string,string>} used mapa slug -> ruta que loLogoutened Claima
 */
export function uniqueSlug(rawTitle, relPath, used) {
  const base = slugify(rawTitle) || 'nota';
  if (!used.has(base)) {
    used.set(base, relPath);
    return base;
  }
  // La carpeta padre aporta contexto real ("flexbox", "grid") sin inventar nada.
  const parent = relPath.split(/[\\/]/).slice(-2, -1)[0] ?? '';
  const withParent = slugify(`${base}-${parent}`);
  if (withParent && !used.has(withParent)) {
    used.set(withParent, relPath);
    return withParent;
  }
  let n = 2;
  while (used.has(`${withParent}-${n}`)) n += 1;
  const slug = `${withParent}-${n}`;
  used.set(slug, relPath);
  return slug;
}