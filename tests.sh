#!/bin/bash
# Lokale Test-Pipeline, gespiegelt von .github/workflows/ci.yml.
# Zweck: die dort einzeln laufenden CI-Schritte hier in einem Skript
# buendeln, statt sie wiederholt als lange Einzelbefehle zu tippen.
set -euo pipefail

echo "========================================="
echo " Starte lokale Test-Pipeline..."
echo "========================================="
echo ""

echo "--> Dependencies installieren (--frozen-lockfile, wie beide CI-Jobs)..."
bun install --frozen-lockfile
echo ""

echo "--> Linter und Formatter (Biome)..."
bun run check:fix

echo "=== 1. CHECKS (kein Docker) ==="
echo "--> Typecheck..."
bun run typecheck
echo "--> Linter und Formatter (Biome)..."
bun run check
echo "--> Unit-Tests..."
bun run test
echo ""

# echo "=== 2. DATABASE (Docker) ==="
# echo "--> Lokalen Supabase-Stack starten..."
# supabase start

# echo "--> pgTAP-Suite (RLS gegen echtes Postgres)..."
# bun run test:db

# echo "--> Integrationstests (echte lokale Instanz)..."
# bun run test:integration

# echo "--> Schema-Diff muss leer sein (Declarative-Schema-Workflow, AGENTS.md)..."
# # --output-format explizit auf text: der Default liefert auch ohne
# # Aenderungen ein JSON-Objekt ({"diff":"",...}) statt leerem stdout.
# diff_output="$(supabase db diff --use-pg-delta --output-format text)"
# if [ -n "$diff_output" ]; then
#   echo "$diff_output"
#   echo
#   echo "supabase/schemas/ und die angewendeten Migrationen weichen voneinander ab."
#   echo "Neue Migration mit 'bun run db:diff -- -f <name>' erzeugen und committen."
#   exit 1
# fi

# echo "--> Generierte DB-Typen duerfen nicht abweichen..."
# bun run db:types
# if ! git diff --exit-code -- src/lib/database.types.ts; then
#   echo
#   echo "src/lib/database.types.ts ist veraltet. Neu generieren mit 'bun run db:types' und committen."
#   exit 1
# fi

# echo "--> Security-Advisors (blockierend)..."
# supabase db advisors --local --type security --fail-on error

# echo "--> Performance-Advisors (informativ)..."
# supabase db advisors --local --type performance --fail-on none

echo ""
echo "Alle Checks erfolgreich bestanden!"
