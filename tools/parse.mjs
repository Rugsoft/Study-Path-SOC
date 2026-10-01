/**
 * Markdown -> HTML con las transformaciones que usa este vault.
 *
 * Cubre lo que realmente aparece en las 390 notas: frontmatter YAML, la linea
 * "Etiquetas: #tag", callouts "> [!tipo]", tablas GFM, enlaces internos a .md,
 * embeds de imagen y bloques de codigo en 12 lenguajes distintos.
 */

import { marked } from 'marked';
import hljs from 'highlight.js/lib/common';
import powershell from 'highlight.js/lib/languages/powershell';
import dos from 'highlight.js/lib/languages/dos';
import apache from 'highlight.js/lib/languages/apache';

hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('dos', dos);
hljs.registerLanguage('apache', apache);

/** Markdown que se ve en el vault pero no es codigo: se deja sin colorear. */
const PSEUDO_LANGS = new Set(['mermaid', 'text', 'plaintext']);
/** El vault escribe los lenguajes con mayusculas y con nombres propios de shell. */
const LANG_ALIASES = {
  html: 'xml',
  css: 'css',
  plaintext: 'plaintext',
  cmd: 'dos',
  shell: 'bash',
  gitignore: 'ini',
  http: 'plaintext',
  text: 'plaintext',
};

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ------------------------------------------------------------------ */
/* Frontmatter y metadatos                                            */
/* ------------------------------------------------------------------ */

/** Separa el frontmatter YAML del cuerpo. Soporta el subconjunto usado en el vault. */
function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: raw };

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim().replace(/^["']|["']$/g, '');
    if (/^\[.*\]$/.test(value)) {
      value = value
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
    data[kv[1]] = value;
  }
  return { data, body: raw.slice(match[0].length) };
}

/** Lee "Etiquetas: #php #arrays" y quita la linea del cuerpo. */
function extractEtiquetas(body) {
  const match = body.match(/^[ \t]*Etiquetas:\s*(.+)$/m);
  if (!match) return { tags: [], body };
  const tags = [...match[1].matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => m[1]);
  const body2 = body.replace(match[0], '');
  return { tags, body: body2 };
}

/* ------------------------------------------------------------------ */
/* Transformaciones de sintaxis Obsidian                              */
/* ------------------------------------------------------------------ */

/**
 * Convierte los callouts "> [!tipo] Titulo" en bloques <aside>.
 * El contenido interior se renderiza recursivamente con marked.
 */
function transformCallouts(md, render) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const head = line.match(/^>\s*\[!(\w+)\]([+-]?)\s*(.*)$/);
    if (!head) {
      out.push(line);
      i += 1;
      continue;
    }

    const type = head[1].toLowerCase();
    const fold = head[2];
    const title = head[3].trim();
    const inner = [];

    i += 1;
    while (i < lines.length && /^>\s?/.test(lines[i])) {
      inner.push(lines[i].replace(/^>\s?/, ''));
      i += 1;
    }

    const renderedInner = render(inner.join('\n')).trim();
    out.push(
      [
        `<aside class="callout callout--${escapeHtml(type)}${fold ? ' callout--folded' : ''}" data-callout="${escapeHtml(type)}">`,
        `<p class="callout__title">${escapeHtml(title || calloutLabel(type))}</p>`,
        renderedInner.replace(/\n{2,}/g, '\n'),
        '</aside>',
        '',
      ].join('\n'),
    );
  }
  return out.join('\n');
}

/** Quita el markdown inline de un texto de encabezado para el indice lateral. */
function plainHeading(text) {
  return String(text)
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|\*|_)/g, '')
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, (_m, target, alias) => alias ?? target)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Los tipos de callout de Obsidian llegan en ingles; la interfaz, en espanol. */
const CALLOUT_LABELS = {
  note: 'Nota',
  abstract: 'Resumen',
  summary: 'Resumen',
  tldr: 'En corto',
  info: 'Informacion',
  todo: 'Tarea',
  tip: 'Consejo',
  hint: 'Pista',
  important: 'Importante',
  success: 'Correcto',
  check: 'Comprobado',
  done: 'Hecho',
  question: 'Pregunta',
  warning: 'Aviso',
  caution: 'Cuidado',
  attention: 'Atencion',
  failure: 'Fallo',
  fail: 'Fallo',
  missing: 'Ausente',
  danger: 'Peligro',
  error: 'Error',
  bug: 'Error',
  example: 'Ejemplo',
  quote: 'Cita',
  cite: 'Cita',
};

const calloutLabel = (type) => CALLOUT_LABELS[type.toLowerCase()] ?? capitalise(type);

/** `[[Objetivo]]`, `[[Objetivo|alias]]` y `![[imagen.png]]`. */
function transformObsidianLinks(md, { resolveNote, resolveAsset }) {
  return md
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target) => {
      const asset = resolveAsset(target.trim());
      return asset ? `<img src="${asset}" alt="${escapeHtml(target.trim())}" loading="lazy">` : whole;
    })
    .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (whole, target) => {
      const note = resolveNote(target.trim());
      return note
        ? `<a href="nota.html?id=${encodeURIComponent(note.id)}">${escapeHtml(target.trim())}</a>`
        : whole;
    })
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (whole, target, alias) => {
      const note = resolveNote(target.trim());
      return note ? `<a href="nota.html?id=${encodeURIComponent(note.id)}">${escapeHtml(alias)}</a>` : escapeHtml(alias);
    })
    .replace(/\[\[([^\]]+)\]\]/g, (whole, target) => {
      const note = resolveNote(target.trim());
      return note
        ? `<a href="nota.html?id=${encodeURIComponent(note.id)}">${escapeHtml(target.trim())}</a>`
        : `<span class="wikilink-missing">${escapeHtml(target.trim())}</span>`;
    });
}

/**
 * Reescribe los enlaces markdown que apuntan a otros .md del vault.
 * Si la nota destino no existe, el enlace cae a texto plano: es preferible
 * perder el enlace que dejar un 404 en la pagina.
 */
function rewriteInternalLinks(md, resolveNote, resolveAsset) {
  // Imagenes markdown que apuntan a un asset del vault.
  const withAssets = md.replace(
    /!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (whole, alt, src) => {
      const asset = resolveAsset(src.trim());
      return asset
        ? `<img src="${asset}" alt="${escapeHtml(alt)}" loading="lazy">`
        : whole;
    },
  );

  return withAssets.replace(
    /\[([^\]]*)\]\(([^)\s]+\.md)(#[^)\s]*)?\)/gi,
    (_whole, label, target, hash) => {
      const note = resolveNote(target.trim());
      if (!note) return label || escapeHtml(target);
      const q = encodeURIComponent(note.id);
      return `[${label || note.title}](nota.html?id=${q}${hash ?? ''})`;
    },
  );
}

/* ------------------------------------------------------------------ */
/* Renderer                                                            */
/* ------------------------------------------------------------------ */

function buildRenderer() {
  return {
    code({ text, lang }) {
      const raw = (lang ?? '').trim();
      const mapped = LANG_ALIASES[raw] ?? raw.toLowerCase();

      if (mapped === 'mermaid') {
        return (
          `<div class="codeblock codeblock--diagram">` +
          `<div class="codeblock__bar"><span class="codeblock__lang">diagrama mermaid</span>` +
          `<button class="codeblock__copy" type="button" data-copy>copiar</button></div>` +
          `<pre class="codeblock__pre"><code>${escapeHtml(text)}</code></pre></div>`
        );
      }

      let highlighted;
      let label = raw || 'texto';
      if (raw && !PSEUDO_LANGS.has(raw) && hljs.getLanguage(mapped)) {
        highlighted = hljs.highlight(text, { language: mapped, ignoreIllegals: true }).value;
      } else {
        highlighted = escapeHtml(text);
        if (raw) label = PSEUDO_LANGS.has(raw) ? raw.toLowerCase() : raw;
      }

      return (
        `<div class="codeblock">` +
        `<div class="codeblock__bar"><span class="codeblock__lang">${escapeHtml(label)}</span>` +
        `<button class="codeblock__copy" type="button" data-copy>copiar</button></div>` +
        `<pre class="codeblock__pre"><code class="hljs">${highlighted}</code></pre></div>`
      );
    },

    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const plain = tokens.map((t) => t.text ?? '').join('');
      const id = slugHeading(plain);
      if (depth <= 2) {
        return `<h${depth} id="${id}" class="note__h note__h--${depth}">${text}</h${depth}>`;
      }
      return `<h${depth} id="${id}" class="note__h">${text}</h${depth}>`;
    },

    table(token) {
      const { header, rows } = token;
      const head = header
        .map((cell, i) => `<th${cell.align ? ` class="ta-${cell.align}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`)
        .join('');
      const body = rows
        .map(
          (row) =>
            '<tr>' +
            row
              .map((cell, i) => {
                const align = cell.align ? ` class="ta-${cell.align}"` : '';
                return `<td${align}>${this.parser.parseInline(cell.tokens)}</td>`;
              })
              .join('') +
            '</tr>',
        )
        .join('');
      return `<div class="tablewrap"><table class="note__table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    },
  };
}

function slugHeading(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'sec';
}

/* ------------------------------------------------------------------ */
/* API principal                                                       */
/* ------------------------------------------------------------------ */

let rendererReady = false;

function ensureRenderer() {
  if (rendererReady) return;
  marked.use({ renderer: buildRenderer(), gfm: true, breaks: false });
  rendererReady = true;
}

/**
 * Convierte una nota del vault en el HTML que consume la web.
 *
 * @param {string} raw contenido del .md
 * @param {object} title titulo (nombre del fichero sin extension)
 * @param {object} ctx { resolveNote, resolveAsset }
 */
export function renderNote(raw, title, ctx) {
  ensureRenderer();

  const { data, body } = splitFrontmatter(raw);
  const { tags, body: cleaned } = extractEtiquetas(body);

  const preprocess = (md) =>
    rewriteInternalLinks(transformObsidianLinks(md, ctx), ctx.resolveNote, ctx.resolveAsset);

  const withLinks = preprocess(cleaned);

  // marked.lexer + parser permite recorrer los tokens una sola vez para
  // extraer el indice de apartados y a la vez generar el HTML.
  const tokens = marked.lexer(withLinks);
  const headings = [];

  const walk = (list) => {
    for (const token of list) {
      if (token.type === 'heading' && token.depth <= 3) {
        headings.push({
          depth: token.depth,
          text: plainHeading(token.text),
          id: slugHeading(token.text),
        });
      }
      if (token.tokens) walk(token.tokens);
      if (token.items) walk(token.items);
    }
  };
  walk(tokens);

  const render = (md) => marked.parse(preprocess(md));
  const withCallouts = transformCallouts(withLinks, render);
  const html = render(withCallouts);

  return {
    html,
    headings,
    text: extractText(marked.lexer(withCallouts)),
    meta: {
      title,
      tags: [...new Set(tags.concat(normaliseTags(data.tags)))],
      date: data.fecha ?? null,
      module: data.modulo ?? null,
      manual: data.manual ?? null,
    },
  };
}

function normaliseTags(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : String(value).split(/[,;]/);
  return list
    .map((t) => String(t).trim().replace(/^#/, ''))
    .filter(Boolean);
}

/** Texto plano para el indice de busqueda, incluyendo el codigo. */
function extractText(tokens, acc = []) {
  for (const token of tokens) {
    switch (token.type) {
      case 'code':
        acc.push(token.text);
        break;
      case 'space':
        break;
      case 'text':
      case 'escape':
        acc.push(token.text ?? token.tokens?.map((t) => t.text ?? '').join(' ') ?? '');
        break;
      case 'html':
        acc.push(stripHtml(token.text ?? ''));
        break;
      default:
        if (token.tokens) extractText(token.tokens, acc);
    }
  }
  return acc.join(' ').replace(/\s+/g, ' ').trim();
}

function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}