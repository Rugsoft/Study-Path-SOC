/* Pagina de nota: contenido, indice lateral, progreso y navegacion. */

import { boot, loadNote, progress, neighbours, escapeHtml, initCopyButtons } from './core.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');

boot(async (index) => {
  const main = document.getElementById('main');

  if (!id) {
    main.innerHTML = '<div class="empty">Falta el parametro <code>?id=</code>.<br><a href="index.html">Volver a la portada</a></div>';
    return;
  }

  const summary = index.notes.find((n) => n.id === id);
  if (!summary) {
    main.innerHTML = '<div class="empty">Esa nota no existe en el indice.<br><a href="temas.html">Ver todas las notas</a></div>';
    return;
  }

  const note = await loadNote(id);
  const isDone = progress.isDone(id);
  const { prev, next } = neighbours(index, summary);

  const sessionLine = note.course
    ? [
        note.course.moduleCode,
        note.course.unitCode,
        note.course.session ? `sesion ${note.course.session}` : null,
        note.course.sessionDate,
      ]
        .filter(Boolean)
        .join(' · ')
    : null;

  main.innerHTML = `
    <div class="notecrumb">
      <a href="index.html">Portada</a><span class="dot">/</span>
      <a href="temas.html?t=${summary.topic}">${escapeHtml(summary.topicLabel)}</a>
      <span class="dot">/</span>
      ${escapeHtml(summary.title)}
    </div>

    <div class="notepage">
      <article>
        <h1 class="notetitle">${escapeHtml(note.title)}</h1>

        <div class="notemeta">
          <span>${note.readingMins} min de lectura</span>
          ${note.codeBlocks ? `<span>${note.codeBlocks} ${note.codeBlocks === 1 ? 'bloque' : 'bloques'} de codigo</span>` : ''}
          ${note.words ? `<span>${note.words.toLocaleString('es-ES')} palabras</span>` : ''}
          <button class="btn ${isDone ? 'btn--commit is-done' : 'btn--commit'}" id="commit">
            ${isDone ? '✓ estudiada' : 'marcar como estudiada'}
          </button>
        </div>

        ${
          note.tags.length
            ? `<div class="chiprow" style="margin:12px 0">
                 ${note.tags
                   .map(
                     (t) =>
                       `<a class="tagpill" href="temas.html?g=${encodeURIComponent(t)}">#${escapeHtml(t)}</a>`,
                   )
                   .join('')}
               </div>`
            : ''
        }

        <div class="note__body" id="body">${note.html}</div>

        ${backlinksBlock(note)}

        <nav class="notenav">
          ${prev ? `<a class="btn btn--cta" href="nota.html?id=${encodeURIComponent(prev.id)}">← ${escapeHtml(clip(prev.title))}</a>` : '<span></span>'}
          ${next ? `<a class="btn btn--cta" href="nota.html?id=${encodeURIComponent(next.id)}">${escapeHtml(clip(next.title))} →</a>` : '<span></span>'}
        </nav>
      </article>

      <aside class="toc">
        ${
          note.headings.length
            ? `<div class="toc__title">En esta nota</div>
               ${note.headings
                 .map(
                   (h) =>
                     `<a href="#${h.id}" class="toc__h${h.depth}" data-toc="${h.id}">${escapeHtml(clip(h.text, 46))}</a>`,
                 )
                 .join('')}`
            : ''
        }
        <div class="toc__title" style="margin-top:24px">Ubicacion</div>
        <div style="font-size:12px;color:var(--body-mute);line-height:18px">
          ${escapeHtml(summary.topicLabel)}
          ${sessionLine ? `<br>${escapeHtml(sessionLine)}` : ''}
        </div>
      </aside>
    </div>`;

  initCopyButtons(main);

  /* Marca de-commit: la unica accion con el gradiente lima. */
  const btn = document.getElementById('commit');
  btn.addEventListener('click', () => {
    const nowDone = progress.toggle(id);
    btn.classList.toggle('is-done', nowDone);
    btn.textContent = nowDone ? '✓ estudiada' : 'marcar como estudiada';
  });

  initScrollSpy(note.headings);
  document.title = `${note.title} — StudyPath`;
});

/**
 * Bloque de enlaces entrantes: que otras notas apuntan a esta.
 *
 * Se pinta siempre, incluso vacio, para que el usuario sepa que el apartado
 * existe. El titulo y el tema de quien enlaza llegan en note.backlinks, que el
 * build calcula invirtiendo los enlaces que ya renderiza.
 */
function backlinksBlock(note) {
  const list = note.backlinks ?? [];
  const title = list.length === 1 ? '1 nota enlaza esta' : `${list.length} notas enlazan esta`;

  return `
    <section class="backlinks">
      <div class="label backlinks__label">${title}</div>
      ${
        list.length
          ? `<div class="backlinks__grid">
               ${list
                 .map(
                   (b) => `
                 <a class="noteitem backlinkitem" href="nota.html?id=${encodeURIComponent(b.id)}">
                   <div class="noteitem__body">
                     <span class="noteitem__title">${escapeHtml(clip(b.title, 64))}</span>
                     <span class="noteitem__meta">
                       <span>${escapeHtml(b.topicLabel)}</span>
                       ${b.session ? `<span>sesión ${b.session}</span>` : ''}
                     </span>
                   </div>
                 </a>`,
                 )
                 .join('')}
             </div>`
          : `<p class="backlinks__empty">
               Ninguna otra nota enlaza a esta todavía. Cuando escribas aquí una
               referencia a otra ficha, esta nota aparecerá en su bloque de
               enlaces entrantes.
             </p>`
      }
    </section>`;
}

/** Resalta en el indice el apartado que se esta leyendo. */
function initScrollSpy(headings) {
  if (!headings.length) return;
  const links = new Map(
    [...document.querySelectorAll('[data-toc]')].map((a) => [a.dataset.toc, a]),
  );
  const targets = headings.map((h) => document.getElementById(h.id)).filter(Boolean);

  const sync = () => {
    let current = targets[0];
    for (const target of targets) {
      if (target.getBoundingClientRect().top <= 120) current = target;
    }
    links.forEach((a) => a.classList.remove('is-active'));
    if (current) links.get(current.id)?.classList.add('is-active');
  };

  window.addEventListener('scroll', sync, { passive: true });
  sync();
}

function clip(text, max = 38) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}