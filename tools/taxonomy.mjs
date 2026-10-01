/**
 * Taxonomia del vault.
 *
 * El vault esta organizado en dos ejes que no se mezclan de forma natural:
 *  - 20_Tech_Stack: fichas por tecnologia, que es como uno estudia un tema.
 *  - 30_Estudios: bitacoras cronologicas de clase del curso DATW_SOC.
 *
 * El eje por tema es el principal. A cada nota de sesion se le asigna ademas
 * un tema a partir del codigo de unidad (UF1841..UF1846), de modo que las notas
 * de clase aparecen tambien dentro del tema que tocan.
 */

export const TOPICS = [
  {
    id: 'javascript',
    label: 'JavaScript',
    blurb: 'Arrays, DOM, formularios, eventos, asincronia y manipulations de datos.',
  },
  { id: 'html', label: 'HTML', blurb: 'Estructura de documentos, formularios, multimedia y semantica.' },
  { id: 'css', label: 'CSS', blurb: 'Selectores, layout, flexbox, grid, animaciones y responsive.' },
  { id: 'uiux', label: 'UI/UX', blurb: 'Usabilidad, accesibilidad WCAG, investigacion y metricas.' },
  { id: 'php', label: 'PHP', blurb: 'CRUD, sesiones, PDO, archivos, AJAX y arquitectura MVC.' },
  { id: 'bbdd', label: 'Bases de datos', blurb: 'SQL, MySQL, joins, transacciones y modelado.' },
  { id: 'devops', label: 'DevOps & Implantacion web', blurb: 'Apache, httpd, Git, despliegue y servidores.' },
  { id: 'bashlinux', label: 'Bash & Linux', blurb: 'Shell scripting, comandos y sistema Linux.' },
  { id: 'ia', label: 'Inteligencia Artificial', blurb: 'Notas y flujos de trabajo asistidos por IA.' },
  { id: 'recursos', label: 'Recursos & Roadmaps', blurb: 'Notaciones, roadmaps de frontend y backend, guides.' },
  { id: 'proyectos', label: 'Proyectos', blurb: 'Analisis y documentacion de proyectos propios.' },
];

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

/** Orden de evaluacion: la primera regla que coincide gana. */
const PATH_RULES = [
  [/20_Tech_Stack[\\/]01_Lenguajes[\\/]Javascript/i, 'javascript'],
  [/20_Tech_Stack[\\/]01_Lenguajes[\\/]Bash/i, 'bashlinux'],
  [/20_Tech_Stack[\\/]02_Frontend[\\/]HTML/i, 'html'],
  [/20_Tech_Stack[\\/]02_Frontend[\\/]CSS/i, 'css'],
  [/20_Tech_Stack[\\/]02_Frontend[\\/]UI-UX/i, 'uiux'],
  [/20_Tech_Stack[\\/]03_Backend[\\/]PHP/i, 'php'],
  [/20_Tech_Stack[\\/]03_Backend[\\/]BBDD/i, 'bbdd'],
  [/20_Tech_Stack[\\/]04_DevOps_Tools/i, 'devops'],
  [/20_Tech_Stack[\\/]05_IA/i, 'ia'],
  [/20_Tech_Stack[\\/]06_Linux/i, 'bashlinux'],
  [/10_Proyectos/i, 'proyectos'],
  [/40_Recursos/i, 'recursos'],
  [/99_Adjuntos/i, 'recursos'],
];

/** Las notas de sesion no tienen carpeta tecnica: se derivan del modulo UF. */
const UNIT_RULES = [
  [/UF1841/, 'html'],
  [/UF1842/, 'javascript'],
  [/UF1843/, 'uiux'],
  [/UF1844/, 'php'],
  [/UF1845/, 'bbdd'],
  [/UF1846/, 'devops'],
];

const FALLBACK = 'recursos';

/**
 * Clasifica una nota a partir de su ruta relativa al vault.
 *
 * @param {string} relPath ruta relativa con separadores nativos
 * @returns {{ topicId: string, course: object|null }}
 */
export function classify(relPath) {
  const course = parseCourse(relPath);
  let topicId = null;

  for (const [pattern, id] of PATH_RULES) {
    if (pattern.test(relPath)) {
      topicId = id;
      break;
    }
  }

  // Una nota suelta en la raiz sobre Apache es material de implantacion web.
  if (!topicId && /apache|implantaci/i.test(relPath)) topicId = 'devops';

  if (!topicId && course) {
    for (const [pattern, id] of UNIT_RULES) {
      if (pattern.test(relPath)) {
        topicId = id;
        break;
      }
    }
    if (!topicId && /MF0493/.test(relPath)) topicId = 'devops';
  }

  return { topicId: topicId ?? FALLBACK, course };
}

/**
 * Extrae el eje de curso: curso -> modulo -> unidad -> numero de sesion.
 * Devuelve null para cualquier nota que no viva bajo 30_Estudios.
 */
function parseCourse(relPath) {
  const parts = relPath.split(/[\\/]/);
  const i = parts.indexOf('30_Estudios');
  if (i === -1) return null;

  const leaf = parts[parts.length - 1];
  const courseDir = parts[i + 1] ?? '';
  const moduleDir = parts[i + 2] ?? '';
  const unitDir = parts.slice(i + 3, -1).join(' / ');

  const moduleMatch = moduleDir.match(/(MF\d+)/);
  const unitMatch = unitDir.match(/(UF\d+)/);
  const sessionMatch = leaf.match(/Sesion[_\s]?(\d+)/i);
  const dateMatch = leaf.match(/(\d{2}\.\d{2}\.\d{2})\s*$/);

  return {
    course: courseDir,
    module: moduleDir,
    unit: unitDir,
    moduleCode: moduleMatch ? moduleMatch[1] : null,
    unitCode: unitMatch ? unitMatch[1] : null,
    session: sessionMatch ? Number(sessionMatch[1]) : null,
    sessionDate: dateMatch ? dateMatch[1] : null,
  };
}

/** Agrupa las notas por curso, modulos y sesiones ya ordenadas. */
export function buildCourseIndex(notes) {
  const courses = new Map();

  for (const note of notes) {
    const c = note.course;
    if (!c) continue;

    if (!courses.has(c.course)) {
      courses.set(c.course, { id: c.course, modules: new Map(), sessions: [], notes: 0 });
    }
    const course = courses.get(c.course);

    const moduleKey = c.module;
    if (!course.modules.has(moduleKey)) {
      course.modules.set(moduleKey, {
        name: moduleKey,
        code: c.moduleCode,
        units: new Map(),
        notes: 0,
      });
    }
    const mod = course.modules.get(moduleKey);

    const unitKey = c.unit || moduleKey;
    if (!mod.units.has(unitKey)) {
      mod.units.set(unitKey, { name: unitKey, code: c.unitCode, notes: 0 });
    }
    const unit = mod.units.get(unitKey);

    mod.notes += 1;
    unit.notes += 1;
    course.notes += 1;
    course.sessions.push(note);
  }

  return [...courses.values()]
    .sort((a, b) => b.notes - a.notes)
    .map((course) => ({
      ...course,
      modules: [...course.modules.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((mod) => ({
          ...mod,
          units: [...mod.units.values()].sort((a, b) => a.name.localeCompare(b.name)),
        })),
      sessions: course.sessions
        .slice()
        .sort((a, b) => (a.course.session ?? 0) - (b.course.session ?? 0)),
    }));
}