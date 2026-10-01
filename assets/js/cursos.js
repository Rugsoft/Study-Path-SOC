/* Eje de cursos: modulo por modulo, sesion a sesion y en orden. */

import { boot, progress, escapeHtml } from './core.js';

boot(async (index) => {
  const main = document.getElementById('main');
  const byId = new Map(index.notes.map((n) => [n.id, n]));
  const doneIds = new Set(Object.keys(progress.read()));

  const html = index.courses
    .map((course) => {
      const sessions = course.sessions.map((id) => byId.get(id)).filter(Boolean);
      const studied = sessions.filter((n) => doneIds.has(n.id)).length;

      return `
      <section class="section">
        <div class="pagehead" style="padding-top:0">
          <h1>${escapeHtml(course.id.replace(/_/g, ' '))}</h1>
          <p>
            ${course.notes} notas de sesion ·
            ${studied} marcadas como estudiadas ·
            los materiales por tema estan en <a href="temas.html">Temas</a>
          </p>
        </div>

        ${course.modules
          .map(
            (mod) => `
          <div class="module">
            <div class="module__head">
              <span class="module__code">${escapeHtml(mod.code ?? '')}</span>
              <h2 class="note__h note__h--3" style="margin:0;flex:1">
                ${escapeHtml(stripCode(mod.name))}
              </h2>
              <span class="chip">${mod.notes}</span>
            </div>
            ${
              mod.units.length > 1
                ? `<div class="chiprow" style="margin:8px 0">
                     ${mod.units
                       .map((u) => `<span class="tagpill">${escapeHtml(u.code ?? stripCode(u.name))} · ${u.notes}</span>`)
                       .join('')}
                   </div>`
                : ''
            }
            <div class="sessions" style="margin-top:10px">
              ${sessions
                .filter((n) => (n.course?.module ?? '') === mod.name)
                .map(sessionRow)
                .join('')}
            </div>
          </div>`,
          )
          .join('')}
      </section>`;
    })
    .join('');

  main.innerHTML =
    html ||
    `<div class="empty">El vault no tiene notas bajo <code>30_Estudios</code>.</div>`;

  function sessionRow(n) {
    const isDone = doneIds.has(n.id);
    const label = n.title.replace(/\.md$/i, '');
    const date = n.course?.sessionDate ?? '';
    return `
      <div class="sessionrow">
        <span class="sessionrow__num">${n.course?.session ?? '—'}</span>
        <a href="nota.html?id=${encodeURIComponent(n.id)}">${escapeHtml(label)}</a>
        ${isDone ? '<span class="chip chip--done">estudiada</span>' : ''}
        <span class="sessionrow__date">${escapeHtml(date)}</span>
      </div>`;
  }
});

/** "MF0491 - Programacion web..." -> "Programacion web..." */
function stripCode(name) {
  return name.replace(/^(MF\d+|UF\d+)\s*-\s*/i, '').trim();
}