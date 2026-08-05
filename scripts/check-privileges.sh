#!/usr/bin/env bash
#
# check-privileges.sh — prueft Zugriffsrechte, die der Schema-Diff nicht
# garantieren kann. Siehe scripts/check-privileges.sql fuer das Warum.
#
#   bash scripts/check-privileges.sh            gegen die lokale Instanz
#   bash scripts/check-privileges.sh --linked   gegen das verlinkte Projekt
#
# Nach JEDEM `supabase db push` gegen --linked laufen lassen: lokale und
# entfernte Default-Privilegien unterscheiden sich, und genau in dieser Luecke
# war create_household() nach dem ersten Push fuer anon aufrufbar.

set -euo pipefail

TARGET="local"
[ "${1:-}" = "--linked" ] && TARGET="linked"

DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/check-privileges.sql"

echo "==> Rechte-Zusicherungen gegen: $TARGET"

if [ "$TARGET" = "local" ]; then
  # Container-Name folgt dem Projektnamen aus config.toml.
  CONTAINER="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -1)"
  if [ -z "$CONTAINER" ]; then
    echo "Fehler: keine laufende lokale Supabase-Instanz gefunden (supabase start)" >&2
    exit 1
  fi
  docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 <"$SQL"
else
  # `db query` liest von stdin und laeuft gegen das verlinkte Projekt.
  supabase db query --linked <"$SQL"
fi

echo "==> OK"
