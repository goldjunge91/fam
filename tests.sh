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

# Reihenfolge ist Absicht: Der billige Typecheck läuft VOR der Formatierung
# und vor der vollen Suite. Ein Tippfehler im Commit wird in Sekunden
# abgefangen, nicht nach mehreren Minuten Testlauf.
echo "=== 1. Typecheck ==="
bun run typecheck
echo ""

echo "=== 2. Lint und Formatter ==="
# Erst read-only pruefen. Nur wenn der Check an Formatfehlern scheitert,
# wird automatisch korrigiert und der Check laeuft ein zweites Mal. Damit
# bleibt der Commit-Aufruf deterministisch (kein stilles Ueberschreiben
# von Dateien, die man gerade geschrieben hat) und ist trotzdem bequem:
# was `check:fix` reparieren kann, bricht den Commit nicht ab.
if bun run check; then
  echo "Biome: sauber."
else
  echo "Biome hat Befunde gemeldet -- versuche automatische Korrektur..."
  bun run check:fix

  if bun run check; then
    echo "Biome: nach Korrektur sauber."
    echo "Hinweis: Die Formatierung wurde automatisch angepasst."
    echo "         Bitte pruefe den Diff und stage die korrigierten Dateien:"
    echo "         git add -u && git diff --cached"
  else
    echo ""
    echo "Biome kann die Befunde nicht automatisch beheben."
    echo "Bitte manuell korrigieren: bun run check:fix"
    exit 1
  fi
fi
echo ""

echo "--> Unit-Tests mit Coverage..."
# test:coverage:unit schreibt coverage/coverage-summary.json (json-summary ist
# im jest.config.js als Reporter gesetzt). Ohne diesen Schritt entsteht keine
# Pruefgrundlage fuer den Floor in Schritt 4.
bun run test:coverage:unit
echo ""

echo "=== 4. Coverage-Floor (neue Dateien) ==="
# Der globale Floor (70/60/65/72) liegt in jest.config.js und laeuft bereits
# mit jedem Coverage-Lauf. Dieser Schritt zusaetzlich: neue oder geaenderte
# Quelldateien muessen 80% Lines und 80% Statements erreichen. Das verhindert
# die haeufigste Verschlechterung -- eine neue Datei ohne Tests -- ohne die
# komplette Suite zweimal laufen zu lassen.
if git diff --cached --name-only --diff-filter=ACM | grep -q '\.tsx\?$'; then
  bun run scripts/check-new-file-coverage.ts --staged
else
  echo "Keine gestaged Quelldateien im aktuellen Commit -- uebersprungen."
fi
echo ""

# # echo "=== 2. DATABASE (Docker) ==="
# # echo "--> Lokalen Supabase-Stack starten..."
# # supabase start

# # echo "--> pgTAP-Suite (RLS gegen echtes Postgres)..."
# # bun run test:db

# # echo "--> Integrationstests (echte lokale Instanz)..."
# # bun run test:integration

# # echo "--> Schema-Diff muss leer sein (Declarative-Schema-Workflow, AGENTS.md)..."
# # # --output-format explizit auf text: der Default liefert auch ohne
# # # Aenderungen ein JSON-Objekt ({"diff":"",...}) statt leerem stdout.
# # diff_output="$(supabase db diff --use-pg-delta --output-format text)"
# # if [ -n "$diff_output" ]; then
# #   echo "$diff_output"
# #   echo
# #   echo "supabase/schemas/ und die angewendeten Migrationen weichen voneinander ab."
# #   echo "Neue Migration mit 'bun run db:diff -- -f <name>' erzeugen und committen."
# #   exit 1
# # fi

# # echo "--> Generierte DB-Typen duerfen nicht abweichen..."
# # bun run db:types
# # if ! git diff --exit-code -- src/lib/database.types.ts; then
# #   echo
# #   echo "src/lib/database.types.ts ist veraltet. Neu generieren mit 'bun run db:types' und committen."
# #   exit 1
# # fi

# # echo "--> Security-Advisors (blockierend)..."
# # supabase db advisors --local --type security --fail-on error

# # echo "--> Performance-Advisors (informativ)..."
# # supabase db advisors --local --type performance --fail-on none

# echo ""
# echo "Alle Checks erfolgreich bestanden!"
