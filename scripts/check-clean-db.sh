#!/usr/bin/env bash
#
# check-clean-db.sh — schuetzt die pgTAP-Suite vor Datenverschmutzung aus
# manueller App-Nutzung gegen dieselbe lokale Supabase-Instanz.
#
# `begin`/`rollback` in den Testdateien isoliert nur Schreibzugriffe
# INNERHALB der eigenen Transaktion. Bereits committete Zeilen — etwa aus
# einer Simulator-Session gegen 127.0.0.1:54321 waehrend der Entwicklung —
# sehen die Tests trotzdem, und zaehlen sie mit. supabase/seed.sql seedet
# feste Referenzdaten (Produkte, Rezeptvorlagen); diese Tabellen sind von der
# Pruefung ausgenommen (siehe check-clean-db.sql). Jede andere Tabelle muss
# nach einem Reset leer sein; jede Zeile davor ist Symptom statt Fixture.
#
# Erstmals aufgefallen im August 2026: 05_products.test.sql zaehlte
# ploetzlich 7 statt der erwarteten 2 Produkte, eine spaetere Assertion warf
# sogar "more than one row returned by a subquery" — beides Folgen liegen
# gebliebener manueller Testdaten, kein Bug im Schema.
#
#   bash scripts/check-clean-db.sh               meldet + setzt bei Befund zurueck
#   bash scripts/check-clean-db.sh --check-only   meldet nur, Exit-Code 1 bei Befund
#
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
SQL="$DIR/check-clean-db.sql"
CHECK_ONLY=false
[ "${1:-}" = "--check-only" ] && CHECK_ONLY=true

# Container-Name folgt dem Projektnamen aus config.toml (wie check-privileges.sh).
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
