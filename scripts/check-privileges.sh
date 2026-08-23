#!/usr/bin/env bash
#
# Prueft Zugriffsrechte, die ein Schema-Diff nicht garantiert.
#
#   bash scripts/check-privileges.sh            gegen die lokale Instanz
#   bash scripts/check-privileges.sh --linked   gegen das verlinkte Projekt
#
# Nach jedem Remote-Push ausfuehren, da Default-Privilegien abweichen koennen.

set -euo pipefail

TARGET="local"
[ "${1:-}" = "--linked" ] && TARGET="linked"

DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/check-privileges.sql"

echo "==> Rechte-Zusicherungen gegen: $TARGET"

if [ "$TARGET" = "local" ]; then
  CONTAINER="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -1)"
  if [ -z "$CONTAINER" ]; then
    echo "Fehler: keine laufende lokale Supabase-Instanz gefunden (supabase start)" >&2
    exit 1
  fi
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 <"$SQL"
else
  supabase db query --linked <"$SQL"
fi

echo "==> OK"
