# StudyPath

Web de estudio con el design system de
[elicit.design.md](elicit.design.md): binario de pergamino y teal, un único
acento chartreuse y tres registros tipográficos sin solaparse.

## Puesta en marcha

```bash
npm install     # marked + highlight.js (solo dependencias de build)
npm run build   # recorre el origen de las notas y genera site/
npm run serve   # http://127.0.0.1:4173
```

`npm run dev` hace build + serve. Con `npm run watch` el build se repite cada
vez que guardas una nota.

## Publicar en GitHub Pages

El build **no puede correr en GitHub Actions**: lee las notas de una ruta local
(`vault.config.json`) que los runners de GitHub no alcanzan. Por eso el
despliegue se genera en local y se vuelca en la rama `gh-pages`, que contiene la
salida de `build.mjs` y no el código fuente.

```bash
./scripts/deploy-pages.sh          # construye y actualiza gh-pages en local
./scripts/deploy-pages.sh --push   # ademas sube la rama al remoto
```

Después, en **Settings → Pages**, elige *Deploy from a branch* y selecciona
`gh-pages` con la carpeta `/ (root)`.

Consideraciones:

- La rama `gh-pages` contiene el sitio ya generado (~400 ficheros).
- `site/.nojekyll` evita que Jekyll reescriba el CSS y el JS.
- `data/search.json` pesa 205 KB comprimidos y cada visitante lo descarga al
  primer uso, no al arrancar.
- El progreso de estudio vive en `localStorage`, así que **cada dispositivo y
  cada navegador lleva el suyo**: no se sincroniza entre dispositivos.

## Qué genera el build

| Artefacto | Contenido |
|---|---|
| `site/data/index.json` | Metadatos de las notas: título, tema, tags, curso, tiempo de lectura |
| `site/data/notes/*.json` | HTML ya renderizado por nota, con resaltado de sintaxis |
| `site/data/search.json` | Índice invertido del buscador; se descarga en el primer uso, no al arrancar |
| `site/data/notes/*.json` → `backlinks` | Notas que enlazan a cada una, calculado invirtiendo el grafo |
| `site/assets/img/` | Imágenes copiadas del origen |
| `site/assets/pdf/` | Guías y roadmaps enlazados desde las notas de recursos |

`index.json` **no publica la ruta local del origen**: se descarga en cada
visita y la ruta del disco no es información de la web.

## Estructura

```
build.mjs             orquestador: recorre, renderiza, indexa e informa
server.mjs            servidor estático sin dependencias, solo loopback
vault.config.json     ruta de origen, exclusiones y reglas de include/ignore
tools/
  slug.mjs            normalización de nombres y resolución de colisiones
  taxonomy.mjs        clasificación por tema y por curso/módulo/sesión
  parse.mjs           markdown + sintaxis extendida -> HTML con resaltado
  search-index.mjs    índice invertido con claves ordenadas para prefijos
src/                  fuentes estáticas que el build copia a site/
check.mjs             verificación de enlaces y backlinks del sitio generado
```

## Decisiones del design system

El archivo de diseño define un sistema binario y el sitio lo respeta:

- **El lienzo es binario**: o pergamino `#fcfcf8` con tinta teal `#083d44`, o
  banda teal a sangre. No hay gris medio ni charcoal intermedio. El teal hace
  de texto, de fondo de banda y de pelo a la vez.
- El **chartreuse `#e5ff97`** es el relleno del botón primario y nada más: solo
  lo lleva "marcar como estudiada". El documento prohíbe usarlo como fondo
  decorativo, porque perdería la escasez que lo hace funcionar como highlight.
- Los **botones primarios van cuadrados** (radio 0). El documento lo llama su
  señal de forma más distintiva: no es un olvido de redondeo.
- **Sin `box-shadow`**: la separación la hacen el pelo de 1px y el cambio de
  superficie (canvas → sage → cool).
- **El azul de enlace se queda en `#0000ee`**, el del navegador, sin
  sobreescribir. En un documento académico el color de enlace es una convención
  de navegación, no una oportunidad de marca.
- **Tres tipografías, tres registros**: EB Garamond en titulares (sustituto de
  Martina Plantijn, que no es libre), Barlow Condensed en el cuerpo
  (sustituto de Special Gothic Variable) y DM Mono en mayúsculas para etiquetas
  y marcas de tiempo.
- El **hero de la portada es un buscador**, no un titular con botón: el campo
  de búsqueda es el elemento de conversión del sistema.
- Columna de contenido fija de 940px.

## Contenido

- 388 notas, 139.025 palabras, 1.002 bloques de código.
- 8 temas: PHP (102 fichas), JavaScript (60), CSS (50), DevOps & Implantación
  web (37), Bases de datos (19), HTML (24), UI/UX (11), Recursos & Roadmaps (8).
- 1 curso (DATW_SOC) con 77 notas de sesión en 3 módulos.
- 249 etiquetas distintas.

## Los dos ejes, separados

El contenido se lee por **tema** o por **curso**, y las páginas no los mezclan:

- **Temas** (311 notas) son las fichas de temario: lo que uno estudia por
  tecnología. Es el eje principal y el que aparece en la portada.
- **Cursos** (77 notas) son las bitácoras de clase, en orden de sesión. Solo
  tienen sentido cronológicamente.

Por eso una nota de sesión **no** aparece en el listado de su tema ni en el
recuento de las pastillas: comparte `topic` con el temario por su código de
unidad, pero mezclarlas allí solo confunde. El buscador sí las encuentra, y las
marca con su número de sesión.

La navegación al final de la nota (anterior/siguiente) también respeta el eje:
una ficha nunca salta a una bitácora, ni al revés.

## Enlaces entrantes

Cada nota muestra, al final, qué otras notas la enlazan. El build ya renderiza
los enlaces internos como `nota.html?id=`, así que invertirlos es recorrerlos
una vez y agruparlos por destino: no cuesta nada porque el dato ya existía.

758 enlaces entrantes repartidos en 296 notas. Las 92 que quedan sin ninguno se
pintan igual, con un texto de vacío, para que se vea que el apartado existe.

La relación es unidireccional: si A enlaza a B, el bloque de B lista a A.

## El peso del buscador

El índice invertido no guarda el texto de las notas: representaba el 56% de un
fichero que, ya comprimido, bajaba de 533 KB a **205 KB**. El texto se sigue
usando para indexar, pero el fragmento de cada resultado se recorta en el
cliente del HTML de la nota, que se carga aparte.

La contrapartida: cada resultado que se pinta descarga su nota (~11 KB de
media). El desplegable de la cabecera pide 8 notas (87 KB) y la página de
resultados está acotada a 20 (218 KB); cuando hay más coincidencias, se avisa en
vez de cortarlas en silencio. El límite existe por peso, no por calidad.

## Qué queda fuera del sitio

`vault.config.json` tiene una lista `excludePaths` con rutas que no se publican.
El build las descarta **antes** de registrar la nota, así que no aparecen ni en
el índice ni en el buscador. Editar esa lista es la única forma de cambiar qué
se comparte.

## Los PDF adjuntos

El build copia **solo los PDF que las notas enlazan**, y solo desde
`pdfSourceDirs` (`WebDev/40_Recursos` por defecto). Ahora mismo son 4 ficheros,
unos 7 MB: las guías de MoureDev y los roadmaps de roadmap.sh, ambos públicos.

No se copia nada más. De los 126 PDF que hay en `99_Adjuntos/PDFs`, 122 son
material del curso (manuales de PHP del profesor, Gestor de Incidencias,
Ruta360, apuntes de clase) y no se publican: sus referencias quedan como texto
plano en la nota, sin enlace, en vez de como un 404.

La lista de origen es explícita, así que ampliar qué se publica es una línea en
`vault.config.json`. Los nombres de los ficheros no se tocan, para que los
enlaces de las notas sigan funcionando.

## Traducción de la sintaxis del origen

El formato de origen usa frontmatter YAML, líneas `Etiquetas:`, callouts
`> [!tipo]`, tablas, enlaces internos y embeds. El build los convierte:

| En el origen | En la web |
|---|---|
| `Etiquetas: #php #arrays` | Chips de etiqueta enlazables a `temas.html?g=` |
| `> [!warning] Título` | Bloque `aside` con etiqueta traducida al español |
| `[[Nota]]` / `[x](nota.md)` | Enlace interno a `nota.html?id=` |
| `![[imagen.png]]` | `<img>` con el asset copiado a `site/assets/img/` |
| ` ```mermaid ` | Bloque de código rotulado, sin renderizar |
| `[[guia.pdf]]` | Enlace al PDF si está copiado; texto plano si no |
| Frontmatter | Metadatos de la nota (fecha, módulo, manual) |

## Fuera de alcance

- Los diagramas Mermaid se muestran como código, sin renderizar.
- Los PDF no se parsean: se enlazan, no se leen.
- El progreso de estudio vive en `localStorage`: no hay backend ni cuentas.
- El sistema es claro por diseño, así que no hay modo oscuro.