#!/usr/bin/env bash
# Carrega o .env da raiz e roda o Prisma no pacote db.
# (Prisma olha o cwd de packages/db; o .env fica na raiz do monorepo.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

# Prisma também lê packages/db/.env — mantém symlink se o da raiz existir.
if [[ -f "$ROOT/.env" && ! -e "$ROOT/packages/db/.env" ]]; then
  ln -sf ../../.env "$ROOT/packages/db/.env"
fi

case "${1:-}" in
  generate) pnpm --filter db exec prisma generate ;;
  migrate)  pnpm --filter db exec prisma migrate dev "${@:2}" ;;
  push)     pnpm --filter db exec prisma db push "${@:2}" ;;
  seed)     pnpm --filter db exec prisma db seed ;;
  deploy)   pnpm --filter db exec prisma migrate deploy ;;
  *)
    echo "Uso: $0 {generate|migrate|push|seed|deploy} [args...]" >&2
    exit 1
    ;;
esac
