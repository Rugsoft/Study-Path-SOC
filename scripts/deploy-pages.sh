#!/usr/bin/env bash
#
# Regenera el sitio y actualiza la rama gh-pages de GitHub Pages.
#
#   ./scripts/deploy-pages.sh          construye y commitea en gh-pages
#   ./scripts/deploy-pages.sh --push   ademas sube la rama al remoto
#
# El build se ejecuta aqui, no en GitHub Actions: build.mjs lee las notas de
# una ruta local que los runners de GitHub no pueden alcanzar.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WT="$(mktemp -d 2>/dev/null || echo "${TMPDIR:-/tmp}/sp-ghpages-$$")"
PUSH=0
[ "${1:-}" = "--push" ] && PUSH=1

cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" 2>/dev/null || true
  rm -rf "$WT"
}
trap cleanup EXIT

cd "$ROOT"

echo "==> Construyendo el sitio"
npm run build

# gh-pages no puede estar checkoutada en dos sitios a la vez: si una
# ejecucion anterior dejo un worktree colgado, se libera antes de crear otro.
STALE="$(git worktree list --porcelain | awk '/^worktree /{wt=$2} /^branch .*gh-pages$/{print wt}')"
if [ -n "${STALE:-}" ]; then
  echo "==> Liberando worktree previo de gh-pages"
  git worktree remove --force "$STALE" 2>/dev/null || true
  rm -rf "$STALE"
fi
git worktree prune

if git show-ref --verify --quiet refs/heads/gh-pages; then
  echo "==> Actualizando gh-pages"
  git worktree add "$WT" gh-pages
else
  echo "==> Creando gh-pages"
  git worktree add "$WT" -b gh-pages
fi

# La rama de despliegue solo contiene el sitio generado, nunca el codigo fuente.
cd "$WT"
git rm -r --quiet . 2>/dev/null || true
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +

cp -r "$ROOT/site/." "$WT/"

git add -A

if git diff --cached --quiet; then
  echo "==> Sin cambios respecto a la publicacion anterior"
else
  git commit -q -m "Publica el sitio generado para GitHub Pages

Salida de build.mjs: notas renderizadas, indice de busqueda e imagenes."
  echo "==> Commit creado en gh-pages"
fi

if [ "$PUSH" -eq 1 ]; then
  echo "==> Subiendo gh-pages al remoto"
  git push origin gh-pages
  echo "==> Listo. Remember activar Pages -> rama gh-pages en los ajustes del repo."
else
  echo "==> Hecho en local. Usa --push para subirlo, o: git push origin gh-pages"
fi