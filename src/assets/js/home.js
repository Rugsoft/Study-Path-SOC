/* Portada: estado del vault, progreso por tema y por donde seguir. */

import { boot, progress, escapeHtml } from './core.js';
import { noteItem } from './components.js';

boot(async (index) => {
  const main = document.getElementById('main');
  const done = progress.read();
  const doneIds = new Set(Object.keys(done));

  const topicStats = index.topics.map((t) => {
    const notes = index.notes.filter((n) => n.topic === t.id);
    const studied = notes.filter((n) => doneIds.has(n.id)).length;
    return { ...t, studied, pct: notes.length ? Math.round((studied / notes.length) * 100) : 0 };
  });

  // Lo pendiente, de lo mas corto a lo mas largo: mejor para arrancar.
  const pending = index.notes
    .filter((n) => !doneIds.has(n.id))
    .sort((a, b) => a.readingMins - b.readingMins)
    .slice(0, 6);

  const s = index.stats;

  main.innerHTML = `
    <section class="featured">
      <h1 class="featured__title">StudyPath</h1>
      <p class="featured__text">
        Todo tu vault de Obsidian convertido en material de estudio: ${s.notes} notas
        ordenadas por tema, con el código original, las tablas y los ejemplos intactos.
      </p>
      <div class="statrow">
        <div class="stat"><div class="stat__value">${s.notes}</div><div class="stat__label">notas</div></div>
        <div class="stat"><div class="stat__value">${s.topics}</div><div class="stat__label">temas</div></div>
        <div class="stat"><div class="stat__value">${s.words.toLocaleString('es-ES')}</div><div class="stat__label">palabras</div></div>
        <div class="stat"><div class="stat__value">${s.codeBlocks}</div><div class="stat__label">bloques</div></div>
      </div>
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="note__h note__h--2">Progreso</h2>
      </div>
      <div class="tilegrid">
        ${topicStats
          .map(
            (t) => `
          <a class="tile ${t.pct === 100 ? 'tile--done' : ''}" href="temas.html?t=${t.id}">
            <span class="tile__title">${escapeHtml(t.label)}</span>
            <span class="tile__count">${t.studied} / ${t.count}</span>
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
      <p style="color:var(--body-mute);font-size:12px">
        Las notas mas cortas que todavia no has marcado.
      </p>
      <div class="notelist" style="margin-top:12px">
        ${
          pending.length
            ? pending.map(noteItem).join('')
            : '<div class="empty">Has completado todo el vault. Enhorabuena.</div>'
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
              <span class="noteitem__title">${escapeHtml(c.id)}</span>
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

  document.getElementById('reset')?.addEventListener('click', () => {
    if (confirm('Se borrara el progreso de estudio de las ' + doneIds.size + ' notas marcadas. Continuar?')) {
      progress.clear();
      location.reload();
    }
  });
});