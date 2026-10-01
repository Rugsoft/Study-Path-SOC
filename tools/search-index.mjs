/**
 * Indice invertido para el buscador.
 *
 * Las claves de `postings` se insertan ordenadas, asi que en el cliente se
 * puede hacer busqueda binaria por prefijo: escribir "array" encuentra
 * "arrays", "arraylike", etc. sin necesidad de un stemmer.
 */

const STOPWORDS = new Set(
  `de la el en y a que se del las los un una unos unas por con para es son como mas más pero su sus
   lo al ha han fue ser este esta estos estas eso ese eso ese aqui aquí cuando donde más
   the of and to in is are for on with that this it as be`.split(/\s+/).filter(Boolean),
);

const MIN_TOKEN = 2;

/** Normaliza texto a tokens indexables: minusculas, sin acentos, sin simbolos. */
export function tokenize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9_+#.-]+/)
    .map((t) => t.replace(/^[.+#-]+|[.+#-]+$/g, ''))
    .filter((t) => t.length >= MIN_TOKEN && !STOPWORDS.has(t));
}

/**
 * Construye el indice a partir de las notas ya renderizadas.
 *
 * @param {Array<{id:string,title:string,text:string,tags:string[],topicId:string,topicLabel:string}>} docs
 */
export function buildSearchIndex(docs) {
  /** @type {Map<string, number[]>} token -> indices de documento */
  const postings = new Map();

  docs.forEach((doc, i) => {
    const weight = [doc.title, doc.title, doc.topicLabel, ...(doc.tags ?? [])].join(' ');
    for (const token of tokenize(weight)) {
      const list = postings.get(token) ?? [];
      if (!list.includes(i)) list.push(i);
      postings.set(token, list);
    }
    for (const token of tokenize(doc.text)) {
      const list = postings.get(token) ?? [];
      list.push(i);
      postings.set(token, list);
    }
  });

  const sortedTokens = [...postings.keys()].sort();
  const index = {};
  for (const token of sortedTokens) index[token] = postings.get(token);

  return {
    tokens: sortedTokens,
    postings: index,
    docs: docs.map((d) => ({
      id: d.id,
      slug: d.slug,
      title: d.title,
      topic: d.topicId,
      topicLabel: d.topicLabel,
      tags: d.tags ?? [],
      course: d.course ?? null,
      text: d.text ?? '',
    })),
  };
}

/** Metricas del indice, para que el build informe del tamano generado. */
export function indexStats(index) {
  const sizes = Object.values(index.postings).map((p) => p.length);
  return {
    tokens: index.tokens.length,
    postings: sizes.reduce((a, b) => a + b.length, 0),
    avgPostings: sizes.length ? (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2) : 0,
    longestToken: index.tokens[index.tokens.length - 1] ?? '',
  };
}