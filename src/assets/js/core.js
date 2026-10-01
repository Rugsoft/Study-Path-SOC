/* Nucleo compartido: carga de datos, progreso, chrome y buscador.
   Sin framework ni dependencias: el sitio es HTML/CSS/JS puro. */

const DATA = 'data/';

/* ---------------------------------------------------------------- datos */

let indexPromise = null;

/** Carga data/index.json una sola vez por sesion. */
export function loadIndex() {
  if (!indexPromise) {
    indexPromise = fetch(`${DATA}index.json`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar el indice (${r.status})`);
      return r.json();
    });
  }
  return indexPromise;
}

/** Carga el HTML ya renderizado de una nota. */
export async function loadNote(id) {
  const res = await fetch(`${DATA}notes/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`No se pudo cargar la nota "${id}"`);
  return res.json();
}

/* -------------------------------------------------------------- progreso */

const PROGRESS_KEY = 'studypath:progress:v1';

/** Notas marcadas como estudiadas: { id: timestamp }. */
export const progress = {
  read() {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },
  write(data) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
    } catch {
      /* modo privado o cuota llena: el progreso simplemente no persiste */
    }
    window.dispatchEvent(new CustomEvent('progress:change'));
  },
  isDone(id) {
    return Boolean(this.read()[id]);
  },
  toggle(id) {
    const data = this.read();
    if (data[id]) delete data[id];
    else data[id] = Date.now();
    this.write(data);
    return Boolean(data[id]);
  },
  count() {
    return Object.keys(this.read()).length;
  },
  clear() {
    this.write({});
  },
  /** Porcentaje de progreso sobre el total de notas del indice. */
  percent(total) {
    if (!total) return 0;
    return Math.round((this.count() / total) * 100);
  },
};

/* ---------------------------------------------------------------- chrome */

const NAV = [
  { href: 'index.html', label: 'Portada' },
  { href: 'temas.html', label: 'Temas' },
  { href: 'cursos.html', label: 'Cursos' },
];

/** Identifica la pagina actual para marcar el enlace activo. */
function currentPage() {
  const file = location.pathname.split('/').pop() || 'index.html';
  return file === '' ? 'index.html' : file;
}

/** Subnav con el progreso global; se repinta cada vez que cambia. */
function paintProgress(index) {
  const fill = document.querySelector('.progress__fill');
  const value = document.querySelector('.progress__value');
  const counter = document.getElementById('studiedcount');
  if (!fill || !value || !counter) return;

  const done = progress.count();
  const pct = progress.percent(index.stats.notes);
  fill.style.width = `${pct}%`;
  value.textContent = `${pct}%`;
  counter.textContent = `${done} ${done === 1 ? 'estudiada' : 'estudiadas'}`;
}

/**
 * Pinta cabecera, subnav con progreso y pie.
 * @param {object} index contenido de data/index.json
 */
export async function renderChrome(index) {
  const page = currentPage();
  chromeIndex = index;

  const topbar = document.getElementById('topbar');
  if (topbar) {
    topbar.className = 'topbar';
    topbar.innerHTML = `
      <div class="column topbar__inner">
        <a class="brand" href="index.html">
          <span class="brand__mark">StudyPath</span>
          <span class="brand__sub">tu vault, para estudiar</span>
        </a>
        <nav class="topnav">
          ${NAV.map(
            (n) =>
              `<a href="${n.href}"${n.href === page ? ' aria-current="page"' : ''}>${n.label}</a>`,
          ).join('')}
        </nav>
        <div class="topbar__search">
          <div class="searchbar">
            <input id="q" type="search" placeholder="Buscar en ${index.stats.notes} notas…"
                   autocomplete="off" aria-label="Buscar notas">
          </div>
          <div id="qresults" class="searchresults" hidden></div>
        </div>
      </div>`;
  }

  const subnav = document.getElementById('subnav');
  if (subnav) {
    subnav.className = 'subnav';
    subnav.innerHTML = `
      <div class="column" style="display:flex;align-items:center;gap:var(--sp-base);width:100%">
        <span>${index.stats.notes} notas · ${index.stats.topics} temas · ${index.stats.tags} etiquetas</span>
        <div class="subnav__right">
          <div class="progress">
            <div class="progress__track"><div class="progress__fill" style="width:0%"></div></div>
            <span class="progress__value">0%</span>
          </div>
          <span class="dot">·</span>
          <span id="studiedcount">0 estudiadas</span>
        </div>
      </div>`;
  }

  const footer = document.getElementById('footer');
  if (footer) {
    footer.className = 'footer';
    const top = index.topics
      .slice()
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    footer.innerHTML = `
      <div class="column footer__cols">
        <div>
          <div class="footer__title">StudyPath</div>
          <p>Web de estudio generada desde el vault de Obsidian.</p>
        </div>
        <div>
          <div class="footer__title">Temas</div>
          ${top.map((t) => `<div><a href="temas.html?t=${t.id}">${t.label}</a></div>`).join('')}
        </div>
        <div>
          <div class="footer__title">Vault</div>
          <div>${index.stats.words.toLocaleString('es-ES')} palabras</div>
          <div>${index.stats.codeBlocks} bloques de código</div>
          <div>Actualizado ${new Date(index.generatedAt).toLocaleDateString('es-ES')}</div>
        </div>
      </div>`;
  }

  initSearch(index);
  initBackToTop();
  paintProgress(index);

  // El progreso se repinta solo: marcar una nota actualiza la barra sin recargar.
  window.addEventListener('progress:change', () => paintProgress(chromeIndex));
}

/** Indice activo, para poder repintar el progreso desde el evento. */
let chromeIndex = null;

/* -------------------------------------------------------------- buscador */

let searchPromise = null;

/** Carga el indice invertido de forma diferida, al primer uso. */
export function ensureSearchIndex() {
  if (!searchPromise) {
    searchPromise = fetch(`${DATA}search.json`).then((r) => {
      if (!r.ok) throw new Error(`No se pudo cargar el indice de busqueda (${r.status})`);
      return r.json();
    });
  }
  return searchPromise;
}

const ACCENT_CLASS = {
  a: 'aáàäâã', e: 'eéèëê', i: 'iíìïî', o: 'oóòöôõ', u: 'uúùüû', n: 'nñ', c: 'cç',
};

/**
 * Convierte un token en una regex que tolera acentos, para poder resaltar
 * dentro del texto original sin tener que guardar una copia normalizada.
 */
function tolerantRegex(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const body = [...escaped]
    .map((ch) => (ACCENT_CLASS[ch] ? `[${ACCENT_CLASS[ch]}]` : ch))
    .join('');
  return new RegExp(body, 'i');
}

/** Normaliza texto a tokens, en el mismo criterio que el build. */
function tokenizeQuery(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_+#.-]+/)
    .map((t) => t.replace(/^[.+#-]+|[.+#-]+$/g, ''))
    .filter((t) => t.length >= 2);
}

/**
 * Busca por prefijo usando busqueda binaria sobre las claves ordenadas.
 * Escribir "array" encuentra "arrays" y "arraylike" sin indice de raices.
 */
function prefixRange(tokens, prefix) {
  let lo = 0;
  let hi = tokens.length - 1;
  let start = -1;
  let end = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const value = tokens[mid];
    if (value < prefix) lo = mid + 1;
    else if (value > prefix) hi = mid - 1;
    else {
      start = mid;
      lo = mid + 1;
    }
  }
  if (start === -1) return [];
  end = start;
  while (end + 1 < tokens.length && tokens[end + 1].startsWith(prefix)) end += 1;
  return tokens.slice(start, end + 1);
}

/**
 * Consulta el indice y devuelve resultados ordenados por relevancia.
 * @returns {Promise<Array<{doc:object, score:number, snippet:string}>>}
 */
export async function search(text, limit = 40) {
  const query = String(text ?? '').trim();
  if (query.length < 2) return [];

  const index = await ensureSearchIndex();
  const terms = tokenizeQuery(query);
  if (!terms.length) return [];

  const scores = new Map();
  const { tokens, postings, docs } = index;

  for (const term of terms) {
    const matched = prefixRange(tokens, term);
    for (const token of matched) {
      const list = postings[token];
      if (!list) continue;
      // Un token exacto pesa mas que uno que solo comparte prefijo.
      const weight = token === term ? 1 : 0.4;
      for (const docIndex of list) {
        const doc = docs[docIndex];
        let score = weight;
        // El titulo, los tags y el tema son superficies de mayor valor.
        if (tokenizeQuery(doc.title).includes(term)) score *= 8;
        else if (doc.tags.some((tag) => tag.toLowerCase().includes(term))) score *= 4;
        else if (doc.topicLabel.toLowerCase().includes(term)) score *= 3;
        scores.set(docIndex, (scores.get(docIndex) ?? 0) + score);
      }
    }
  }

  const distinct = new Map();
  for (const term of terms) {
    for (const token of prefixRange(tokens, term)) {
      for (const docIndex of postings[token] ?? []) {
        distinct.set(docIndex, (distinct.get(docIndex) ?? 0) + 1);
      }
    }
  }

  const ranked = [...scores.entries()]
    .map(([docIndex, score]) => ({
      doc: docs[docIndex],
      // Las notas que casan con mas terminos distintos suben.
      score: score + (distinct.get(docIndex) ?? 0) * 12,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return ranked.map((item) => ({
    ...item,
    snippet: buildSnippet(item.doc.text, terms),
  }));
}

/** Trocea el texto alrededor de la primera coincidencia. */
function buildSnippet(text, terms) {
  if (!text) return '';
  for (const term of terms) {
    const match = tolerantRegex(term).exec(text);
    if (!match) continue;
    const start = Math.max(0, match.index - 70);
    const end = Math.min(text.length, match.index + 110);
    const slice = `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
    return markTerms(slice, terms);
  }
  return text.slice(0, 180);
}

/** Resalta las coincidencias dentro de un fragmento ya recortado. */
function markTerms(text, terms) {
  let out = escapeHtml(text);
  for (const term of terms) {
    const re = new RegExp(
      `[${ACCENT_CLASS[term[0]] ?? term[0]}]${[...term]
        .slice(1)
        .map((ch) => (ACCENT_CLASS[ch] ? `[${ACCENT_CLASS[ch]}]` : ch))
        .join('')}`,
      'gi',
    );
    out = out.replace(re, (m) => `<mark>${m}</mark>`);
  }
  return out;
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Sugerencias bajo la barra de busqueda de la cabecera. */
function initSearch(index) {
  const input = document.getElementById('q');
  const panel = document.getElementById('qresults');
  if (!input || !panel) return;

  const params = new URLSearchParams(location.search);
  input.value = params.get('q') ?? '';

  let timer = null;
  let lastQuery = '';

  const run = async () => {
    const text = input.value.trim();
    if (text === lastQuery) return;
    lastQuery = text;

    if (text.length < 2) {
      panel.hidden = true;
      panel.innerHTML = '';
      return;
    }

    panel.hidden = false;
    panel.innerHTML = '<div class="empty">buscando…</div>';
    try {
      const results = await search(text, 8);
      panel.innerHTML = results.length
        ? results
            .map(
              (r) => `
          <a class="searchresult" href="nota.html?id=${encodeURIComponent(r.doc.id)}">
            <span class="searchresult__title">${escapeHtml(r.doc.title)}</span>
            <span class="searchresult__crumb">${escapeHtml(r.doc.topicLabel)}${
              r.doc.course?.session ? ` · sesión ${r.doc.course.session}` : ''
            }</span>
            <span class="searchresult__snippet">${r.snippet}</span>
          </a>`,
            )
            .join('')
        : '<div class="empty">sin resultados</div>';
    } catch (err) {
      panel.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
    }
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(run, 160);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const text = input.value.trim();
      if (text) location.href = `temas.html?q=${encodeURIComponent(text)}`;
    }
    if (e.key === 'Escape') {
      panel.hidden = true;
      input.blur();
    }
  });

  input.addEventListener('blur', () => setTimeout(() => (panel.hidden = true), 180));

  void index;
}

/* --------------------------------------------------------------- varios */

function initBackToTop() {
  const btn = document.getElementById('totop');
  if (!btn) return;
  const sync = () => btn.classList.toggle('is-visible', window.scrollY > 600);
  window.addEventListener('scroll', sync, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  sync();
}

/** Copia el contenido de un bloque de codigo al portapapeles. */
export function initCopyButtons(root = document) {
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-copy]');
    if (!btn) return;
    const code = btn.closest('.codeblock')?.querySelector('code');
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code.innerText);
      btn.textContent = 'copiado';
    } catch {
      btn.textContent = 'no se pudo';
    }
    setTimeout(() => (btn.textContent = 'copiar'), 1400);
  });
}

/** Vecinos dentro del mismo tema, para navegar al final de la nota. */
export function neighbours(index, note) {
  const pool = index.notes.filter((n) => n.topic === note.topic).sort((a, b) => a.title.localeCompare(b.title, 'es'));
  const i = pool.findIndex((n) => n.id === note.id);
  return {
    prev: i > 0 ? pool[i - 1] : null,
    next: i >= 0 && i < pool.length - 1 ? pool[i + 1] : null,
  };
}

/** Punto de entrada comun: carga el indice y pinta el chrome. */
export async function boot(render) {
  try {
    const index = await loadIndex();
    await renderChrome(index);
    await render(index);
  } catch (err) {
    document.body.insertAdjacentHTML(
      'afterbegin',
      `<div class="column"><div class="callout callout--danger" style="margin-top:24px">
        <p class="callout__title">Error</p><p>${escapeHtml(err.message)}</p>
        <p>Ejecuta <code>npm run build</code> para generar los datos.</p>
      </div></div>`,
    );
  }
}