#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="$ROOT/.tools/pg/bin:$HOME/.cargo/bin:$PATH"
export PGDATA="$ROOT/.tools/pgdata"

mkdir -p "$ROOT/.tools/redis"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "Initialisation PostgreSQL…"
  initdb -D "$PGDATA" --auth=trust --username=expert
fi

if ! pg_ctl -D "$PGDATA" status >/dev/null 2>&1; then
  echo "Démarrage PostgreSQL…"
  pg_ctl -D "$PGDATA" -l "$ROOT/.tools/pg.log" -o "-p 5432" start
  sleep 1
  createdb -h 127.0.0.1 -U expert expert 2>/dev/null || true
fi

if ! redis-cli ping >/dev/null 2>&1; then
  echo "Démarrage Redis…"
  redis-server --daemonize yes --port 6379 --dir "$ROOT/.tools/redis"
fi

echo "PostgreSQL + Redis OK"
