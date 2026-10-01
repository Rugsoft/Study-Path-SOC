/* Portada: estado del material, progreso por tema y por donde seguir. */

import { boot, progress, escapeHtml } from './core.js';
import { noteItem } from './components.js';

boot(async (index) => {
  const main = document.getElementById('main');
  const done = progress.read();
  const doneIds = new Set(Object.keys(done));

  // Las bitacoras de sesion viven en el eje del curso, no en el de temas:
  // el progreso por tema y "por donde seguir" se miden sobre el material.
  const isSession = (n) => Boolean(n.course);
  const material = index.notes.filter((n) => !isSession(n));
  const sessionCount = index.notes.length - material.length;

  const topicStats = index.topics
    .map((t) => {
      const notes = material.filter((n) => n.topic === t.id);
      const studied = notes.filter((n) => doneIds.has(n.id)).length;
      return { ...t, total: notes.length, studied, pct: notes.length ? Math.round((studied / notes.length) * 100) : 0 };
    })
    .filter((t) => t.total > 0);

  // Lo pendiente, de lo mas corto a lo mas largo: mejor para arrancar.
  const pending = material
    .filter((n) => !doneIds.has(n.id))
    .sort((a, b) => a.readingMins - b.readingMins)
    .slice(0, 6);

  const s = index.stats;

  main.innerHTML = `
    <section class="hero">
      <div class="hero__inner">
        <div class="label hero__label">Notas de clase · curso DATW_SOC</div>
        <h1 class="hero__title">StudyPath</h1>
        <p class="hero__text">
          ${material.length} fichas de temario y ${sessionCount} sesiones de clase, ordenadas por
          area y con el codigo original, las tablas y los ejemplos intactos.
        </p>

        <form class="hero__search" id="herosearch" role="search">
          <input class="hero__input" id="heroq" type="search" autocomplete="off"
                 placeholder="p. ej. como desplegar una rama con git" aria-label="Buscar notas">
          <button class="hero__submit" type="submit">Buscar</button>
        </form>

        <div class="statrow">
          <div class="stat"><span class="stat__value">${s.notes}</span><span class="stat__label">notas</span></div>
          <div class="stat"><span class="stat__value">${s.topics}</span><span class="stat__label">temas</span></div>
          <div class="stat"><span class="stat__value">${s.words.toLocaleString('es-ES')}</span><span class="stat__label">palabras</span></div>
          <div class="stat"><span class="stat__value">${s.codeBlocks}</span><span class="stat__label">bloques</span></div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="note__h note__h--2">Progreso por tema</h2>
      <p style="color:var(--body-mute);margin-top:8px">
        El progreso se guarda en este navegador. No se envia a ningun sitio.
      </p>
      <div class="tilegrid" style="margin-top:16px">
        ${topicStats
          .map(
            (t) => `
          <a class="tile ${t.pct === 100 ? 'tile--done' : ''}" href="temas.html?t=${t.id}">
            <span class="tile__title">${escapeHtml(t.label)}</span>
            <span class="tile__count">${t.studied} / ${t.total}</span>
            <span class="tile__blurb">${t.pct}% estudiado</span>
            <span class="progress" style="margin-top:10px">
              <span class="progress__track" style="width:100%">
                <span class="progress__fill" style="width:${t.pct}%"></span>
              </span>
            </span>
          </a>`,
          )
          .join('')}
      </div>
      ${
        doneIds.size
          ? `<div class="toolbar">
               <button class="btn btn--ghost" id="reset">Reiniciar progreso</button>
             </div>`
          : ''
      }
    </section>

    <section class="section section--divided">
      <h2 class="note__h note__h--2">Por donde seguir</h2>
      <p style="color:var(--body-mute);margin-top:8px">
        Las fichas mas cortas que todavia no has marcado.
      </p>
      <div class="notelist" style="margin-top:12px">
        ${
          pending.length
            ? pending.map((n) => noteItem({ ...n, done: doneIds.has(n.id) })).join('')
            : '<div class="empty">Has completado todo el material. Enhorabuena.</div>'
        }
      </div>
    </section>

    <section class="section section--divided">
      <h2 class="note__h note__h--2">Material del curso</h2>
      <div class="notelist" style="margin-top:12px">
        ${index.courses
          .map(
            (c) => `
          <a class="noteitem" href="cursos.html">
            <div class="noteitem__body">
              <span class="noteitem__title">${escapeHtml(c.id.replace(/_/g, ' '))}</span>
              <span class="noteitem__meta">
                <span>${c.notes} notas de sesion</span>
                <span>${c.modules.length} modulos</span>
              </span>
            </div>
          </a>`,
          )
          .join('')}
      </div>
    </section>`;

  // El campo del hero es el elemento de conversion del sistema: empuja a la
  // pagina de resultados, que es quien sabe pintarlos con fragmento.
  document.getElementById('herosearch').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = document.getElementById('heroq').value.trim();
    if (text) location.href = `temas.html?q=${encodeURIComponent(text)}`;
  });

  document.getElementById('reset')?.addEventListener('click', () => {
    if (confirm('Se borrara el progreso de estudio de las ' + doneIds.size + ' notas marcadas. Continuar?')) {
      progress.clear();
      location.reload();
    }
  });
});