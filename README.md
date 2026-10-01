# StudyPath

Web de estudio generada desde un vault de Obsidian, con el design system de
[steam.design.md](steam.design.md): escalera navy de cuatro pasos, gramática de
doble voltaje en los gradientes, radios de 2px y columna fija de 940px.

## Puesta en marcha

```bash
npm install     # marked + highlight.js (solo dependencias de build)
npm run build   # recorre el vault y genera site/
npm run serve   # http://127.0.0.1:4173
```

`npm run dev` hace build + serve. Con `npm run watch` el build se repite cada
vez que guardas una nota en Obsidian.

## Qué genera el build

| Artefacto | Contenido |
|---|---|
| `site/data/index.json` | Metadatos de las 390 notas: título, tema, tags, curso, tiempo de lectura |
| `site/data/notes/*.json` | HTML ya renderizado por nota, con resaltado de sintaxis |
| `site/data/search.json` | Índice invertido del buscador; se descarga en el primer uso, no al arrancar |
| `site/assets/img/` | Imágenes copiadas del vault |

## Estructura

```
build.mjs             orquestador: recorre el vault, renderiza, indexa e informa
server.mjs            servidor estático sin dependencias, solo loopback
vault.config.json     ruta del vault y reglas de include/ignore
tools/
  slug.mjs            normalización de nombres y resolución de colisiones
  taxonomy.mjs        clasificación por tema y por curso/módulo/sesión
  parse.mjs           markdown + sintaxis Obsidian -> HTML con resaltado
  search-index.mjs    índice invertido con claves ordenadas para prefijos
src/                  fuentes estáticas que el build copia a site/
```

## Decisiones del design system

El archivo de diseño define una gramática de doble voltaje, y el sitio la respeta:

- El gradiente lima (`#a4d007` -> `#5c7e10`) aparece **solo** en "marcar como
  estudiada". Es la única acción de compromiso de la aplicación, igual que
  "Install" y "Play" lo son en Steam. Reutilizarlo en algo navegable destruiría
  la señal commit-vs-navigate.
- Toda la navegación (buscar, filtros de tema, siguiente nota) usa el gradiente
  cian `#06bfff -> #2881a7 -> #2d73ff`.
- Las tarjetas no llevan `box-shadow`: la elevación es un escalón de superficie
  sobre la escalera navy `canvas -> rail -> tile -> inset`.
- Radio de 2px en toda superficie interactiva. Sin geometría de pastilla.
- El cuerpo se queda en **Arial**, no Inter: el documento advierte que Inter
  rompe el ritmo denso de la capa de 11px. Inter queda para el chrome,
  sustituyendo a la propietaria Motiva Sans.
- `letter-spacing: 1.104px` en los encabezados de 16px/700, que es el tracking
  que da el ritmo al chrome de Steam.
- Columna de contenido fija de 940px, como en el Steam original.

## Contenido

- 390 notas, 139.863 palabras, 1.006 bloques de código.
- 9 temas: JavaScript (75), PHP (116), CSS (50), HTML (33), Bases de datos (34),
  DevOps & Implantación web (57), UI/UX (15), Recursos & Roadmaps (9), Proyectos (1).
- 1 curso (DATW_SOC) con 77 notas de sesión en 3 módulos.
- 251 etiquetas distintas.
- Eje principal por tema; las notas de sesión cuelgan de "Cursos" y además
  aparecen dentro del tema que tocan, según su código de unidad UF.

## Traducción de la sintaxis de Obsidian

El vault usa frontmatter YAML, líneas `Etiquetas:`, callouts `> [!tipo]`,
tablas, enlaces internos y embeds. El build los convierte:

| En el vault | En la web |
|---|---|
| `Etiquetas: #php #arrays` | Chips de etiqueta enlazables a `temas.html?g=` |
| `> [!warning] Título` | Bloque `aside` con etiqueta traducida al español |
| `[[Nota]]` / `[x](nota.md)` | Enlace interno a `nota.html?id=` |
| `![[imagen.png]]` | `<img>` con el asset copiado a `site/assets/img/` |
| ` ```mermaid ` | Bloque de código rotulado, sin renderizar |
| Frontmatter | Metadatos de la nota (fecha, módulo, manual) |

## Fuera de alcance

- Los diagramas Mermaid se muestran como código, sin renderizar.
- Los 126 PDF del vault no se parsean.
- El progreso de estudio vive en `localStorage`: no hay backend ni cuentas.
- Steam es dark-only por diseño, así que no hay modo claro.