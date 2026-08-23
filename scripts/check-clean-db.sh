#!/usr/bin/env bash
#
# Schuetzt pgTAP vor committierten Daten aus manueller App-Nutzung.
# Seed-Tabellen sind in `check-clean-db.sql` ausgenommen.
#
#   bash scripts/check-clean-db.sh               meldet + setzt bei Befund zurueck
#   bash scripts/check-clean-db.sh --check-only   meldet nur, Exit-Code 1 bei Befund
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/check-clean-db.sql"
CHECK_ONLY=false
[ "${1:-}" = "--check-only" ] && CHECK_ONLY=true

CONTAINER="$(docker ps --filter "name=supabase_db_" --format '{{.Names}}' | head -1)"
if [ -z "$CONTAINER" ]; then
  echo "Keine laufende lokale Supabase-Instanz gefunden (supabase start)." >&2
  exit 1
fi

DIRTY="$(docker exec -i "$CONTAINER" psql -U postgres -tAc "$(cat "$SQL")")"

if [ -z "$DIRTY" ]; then
  echo "==> DB sauber (public ist wie nach einem Reset leer)."
  exit 0
fi

echo "==> Lokale DB enthaelt Daten ausserhalb der Test-Transaktionen: $DIRTY"
echo "    pgTAP zaehlt Zeilen absolut (z. B. 05_products.test.sql) — das faellt sonst falsch durch."

if [ "$CHECK_ONLY" = true ]; then
  echo "    Fix: bun run db:reset" >&2
  exit 1
fi

echo "==> Setze zurueck: supabase db reset"
supabase db reset >/dev/null

echo "==> OK, DB zurueckgesetzt."
