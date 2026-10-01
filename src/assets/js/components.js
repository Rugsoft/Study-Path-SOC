/* Piezas de render compartidas entre paginas.
   Este modulo no debe tener efectos al importarse. */

import { escapeHtml } from './core.js';

/**
 * Fila de la lista de notas.
 * @param {object} n nota del indice (id, title, topicLabel, readingMins, codeBlocks, course)
 * @param {boolean} [n.done] si ya esta marcada como estudiada
 */
export function noteItem(n) {
  const date = n.course?.sessionDate ? ` · ${n.course.sessionDate}` : '';
  const session = n.course?.session ? `sesion ${n.course.session}${date}` : '';
  const blocks = n.codeBlocks
    ? `<span>${n.codeBlocks} ${n.codeBlocks === 1 ? 'bloque' : 'bloques'}</span>`
    : '';

  return `
    <a class="noteitem ${n.done ? 'noteitem--done' : ''}" href="nota.html?id=${encodeURIComponent(n.id)}">
      <div class="noteitem__body">
        <span class="noteitem__title">${escapeHtml(n.title)}</span>
        <span class="noteitem__meta">
          <span>${escapeHtml(n.topicLabel)}</span>
          ${session ? `<span>${escapeHtml(session)}</span>` : ''}
          <span>${n.readingMins} min</span>
          ${blocks}
        </span>
      </div>
    </a>`;
}