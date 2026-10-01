/* Pagina de temas: filtros por area y listado, o resultados de busqueda. */

import { boot, progress, search, escapeHtml } from './core.js';
import { noteItem } from './components.js';

boot(async (index) => {
  const main = document.getElementById('main');
  const params = new URLSearchParams(location.search);
  const query = params.get('q') ?? '';
  let activeTopic = params.get('t') ?? 'all';
  let activeTag = params.get('g') ?? '';

  const tagsFor = (topicId) => {
    const pool = materialFor(topicId);
    return [...new Set(pool.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, 'es'));
  };

  const listEl = document.getElementById('notelist');
  const headEl = document.getElementById('listhead');
  const pillsEl = document.getElementById('pills');
  const tagsEl = document.getElementById('tagfilters');
  const countEl = document.getElementById('count');

  /**
   * El eje por temas es solo de material. Las bitacoras de sesion se listan en
   * Cursos, donde tienen sentido cronologico: mezcladas aqui solo confuse.
   * El buscador (mas abajo) si las devuelve, marcadas con su numero de sesion.
   */
  const isSession = (n) => Boolean(n.course);
  const materialFor = (topicId) =>
    index.notes.filter((n) => !isSession(n) && (topicId === 'all' ? true : n.topic === topicId));

  /** Todas las notas que pasan los filtros activos. */
  function filtered() {
    return materialFor(activeTopic).filter((n) => {
      if (activeTag && !n.tags.includes(activeTag)) return false;
      return true;
    });
  }

  function paintPills() {
    // Los recuentos son los de material, que es lo que hay debajo: pulsar una
    // pastilla y ver otro numero seria el fallo clasico de este filtro.
    const counts = new Map(
      index.topics.map((t) => [t.id, materialFor(t.id).length]),
    );
    const total = materialFor('all').length;
    pillsEl.innerHTML = [
      `<button class="chip ${activeTopic === 'all' ? 'chip--active' : ''}" data-topic="all">Todas · ${total}</button>`,
      ...index.topics
        .filter((t) => counts.get(t.id) > 0)
        .map(
          (t) =>
            `<button class="chip ${activeTopic === t.id ? 'chip--active' : ''}" data-topic="${t.id}">${escapeHtml(t.label)} · ${counts.get(t.id)}</button>`,
        ),
    ].join('');

    pillsEl.querySelectorAll('[data-topic]').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTopic = btn.dataset.topic;
        activeTag = '';
        const url = new URLSearchParams();
        if (activeTopic !== 'all') url.set('t', activeTopic);
        history.replaceState(null, '', url.toString() ? `?${url}` : location.pathname);
        paintPills();
        paintTags();
        paintList();
      });
    });
  }

  function paintTags() {
    const tags = tagsFor(activeTopic).slice(0, 40);
    if (!tags.length) {
      tagsEl.innerHTML = '';
      return;
    }
    tagsEl.innerHTML = `
      <span class="dot">etiquetas</span>
      ${tags
        .map(
          (t) =>
            `<a class="chip ${activeTag === t ? 'chip--active' : ''}" href="#" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</a>`,
        )
        .join('')}`;

    tagsEl.querySelectorAll('[data-tag]').forEach((a) =>
      a.addEventListener('click', (e) => {
        e.preventDefault();
        activeTag = activeTag === a.dataset.tag ? '' : a.dataset.tag;
        paintTags();
        paintList();
      }),
    );
  }

  function paintList() {
    const doneIds = progress.read();
    const notes = filtered()
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, 'es'))
      .map((n) => ({ ...n, done: Boolean(doneIds[n.id]) }));

    countEl.textContent = `${notes.length} nota${notes.length === 1 ? '' : 's'}`;
    headEl.textContent =
      activeTopic === 'all'
        ? 'Todas las notas'
        : (index.topics.find((t) => t.id === activeTopic)?.label ?? '');

    listEl.innerHTML = notes.length
      ? notes.map(noteItem).join('')
      : '<div class="empty">Ninguna nota con estos filtros.</div>';
  }

  /** Modo busqueda:Oculta los filtros y muestra resultados con fragmento. */
  async function paintSearch(text) {
    pillsEl.hidden = true;
    tagsEl.hidden = true;
    listEl.classList.add('notelist--single');
    headEl.textContent = `Resultados para "${text}"`;

    const results = await search(text, 60);
    countEl.textContent = `${results.length} resultado${results.length === 1 ? '' : 's'}`;

    listEl.innerHTML = results.length
      ? results
          .map(
            (r) => `
        <a class="searchresult" href="nota.html?id=${encodeURIComponent(r.doc.id)}">
          <span class="searchresult__title">${escapeHtml(r.doc.title)}</span>
          <span class="searchresult__crumb">${escapeHtml(r.doc.topicLabel)}${
            r.doc.course?.session ? ` · sesion ${r.doc.course.session}` : ''
          }</span>
          <span class="searchresult__snippet">${r.snippet}</span>
        </a>`,
          )
          .join('')
      : '<div class="empty">Sin resultados. Prueba con menos letras.</div>';
  }

  if (query) {
    await paintSearch(query);
  } else {
    // Un tema que no exista en el indice cae a "todas".
    if (activeTopic !== 'all' && !index.topics.some((t) => t.id === activeTopic)) activeTopic = 'all';
    document.getElementById('filters').hidden = false;
    listEl.classList.remove('notelist--single');
    paintPills();
    paintTags();
    paintList();
  }

  void main;
});