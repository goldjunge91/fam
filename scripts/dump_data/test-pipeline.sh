#!/usr/bin/env bash
# test-pipeline.sh — manueller Smoke-Test der CI-Delta-Pipeline (#223 Paket 5).
#
# Fuehrt build-canonical-update.ts und reconstruct-canonical.ts genau so aus,
# wie .github/workflows/update_dump.yml es tut — komplett lokal, ohne GitHub-
# Zugriff (beide Skripte sind reine Datei-I/O, `gh release ...` steht separat
# im Workflow). Baut dafuer synthetische Schema-2-Extract-DBs und prueft:
#
#   1. Allererster Lauf (kein --old-canonical) -> neue Baseline
#   2. Lauf im selben Monat -> Patch mit den erwarteten Upserts/Deletes
#   3. Lauf im naechsten Monat -> neue Baseline statt Patch
#   4. reconstruct-canonical.ts aus Baseline+Patch -> Inhalt muss BYTE-GENAU
#      der echten canonical.db aus Schritt 2 entsprechen (deckt die
#      text/real-Typaffinitaets-Regression ab, die dieser Test urspruenglich
#      gefunden hat: numerische Naehrwert-Spalten duerfen nicht als TEXT
#      angelegt werden, sonst vergleicht computePatch() spaeter Zahl gegen
#      String und haelt jedes Produkt faelschlich fuer geaendert)
#   5. Unterbrochene Patchkette -> muss mit Fehler abbrechen
#
# Nutzung:
#   bash scripts/dump_data/test-pipeline.sh
#
# Benoetigt: bun, sqlite3, jq (alle drei bereits Teil des CI-Workflows).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_SCRIPT="$SCRIPT_DIR/build-canonical-update.ts"
RECONSTRUCT_SCRIPT="$SCRIPT_DIR/reconstruct-canonical.ts"
BASE_URL="https://example.com/off-dump-current"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/dump-pipeline-test.XXXXXX")"
FAILED=0

cleanup() {
  if [ "$FAILED" -eq 0 ]; then
    rm -rf "$WORK_DIR"
  else
    echo ""
    echo "Zum Nachschauen bewahrt (Testlauf ist fehlgeschlagen): $WORK_DIR"
  fi
}
trap cleanup EXIT

pass() { echo "  OK: $1"; }
fail() { echo "  FEHLER: $1"; FAILED=1; }

# Baut eine Schema-2-Extract-DB. Argumente: <pfad> <data_version> <code:name:kcal> ...
write_extract_db() {
  local db_path="$1" data_version="$2"
  shift 2
  sqlite3 "$db_path" <<SQL
CREATE TABLE products (
    code TEXT PRIMARY KEY, product_name TEXT, brand TEXT, quantity TEXT, stores TEXT,
    nutriscore TEXT, categories_tags TEXT, off_last_modified_at TEXT,
    energy_kcal REAL, fat REAL, saturated_fat REAL, carbohydrates REAL, sugars REAL, proteins REAL, salt REAL
);
CREATE TABLE dump_meta (schema_version INTEGER NOT NULL, data_version TEXT NOT NULL, generated_at TEXT NOT NULL, source_cursor TEXT);
INSERT INTO dump_meta VALUES (2, '$data_version', '$data_version', NULL);
SQL
  for entry in "$@"; do
    IFS=':' read -r code name kcal <<<"$entry"
    sqlite3 "$db_path" "INSERT INTO products (code, product_name, off_last_modified_at, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags) VALUES ('$code','$name','$data_version',$kcal,0,0,0,0,0,0,'[]');"
  done
}

echo "=== Schritt 1: erster Lauf (kein --old-canonical) -> neue Baseline ==="
V1="$WORK_DIR/v1.db"
write_extract_db "$V1" "2026-08-01T00-00-00Z" "1:Apfelsaft:45" "2:Wird geloescht:10"
OUT1="$WORK_DIR/out1"
STDOUT1=$(bun run "$BUILD_SCRIPT" --new-extract "$V1" --out-dir "$OUT1" --base-url "$BASE_URL")
echo "$STDOUT1" | grep -q "Neue Baseline geschnitten." && pass "Baseline-Pfad gewaehlt" || fail "erwartete 'Neue Baseline geschnitten.'"
[ -f "$OUT1/canonical.db" ] && pass "canonical.db erzeugt" || fail "canonical.db fehlt"
[ -f "$OUT1/baseline-2026-08-01T00-00-00Z.db" ] && pass "baseline-*.db erzeugt" || fail "baseline-*.db fehlt"
[ "$(jq -r '.patches | length' "$OUT1/manifest.json")" = "0" ] && pass "manifest.json ohne Patches" || fail "manifest.json sollte keine Patches enthalten"

echo ""
echo "=== Schritt 2: gleicher Monat -> Patch mit erwarteten Upserts/Deletes ==="
V2="$WORK_DIR/v2.db"
write_extract_db "$V2" "2026-08-15T00-00-00Z" "1:Apfelsaft:45" "3:Neu:5"
OUT2="$WORK_DIR/out2"
STDOUT2=$(bun run "$BUILD_SCRIPT" --new-extract "$V2" --out-dir "$OUT2" --base-url "$BASE_URL" \
  --old-canonical "$OUT1/canonical.db" --previous-manifest "$OUT1/manifest.json")
echo "$STDOUT2" | grep -q "Patch erzeugt." && pass "Patch-Pfad gewaehlt" || fail "erwartete 'Patch erzeugt.'"
# Produkt 1 zaehlt als Upsert, obwohl der Name gleich bleibt: sein
# off_last_modified_at aendert sich mit jeder write_extract_db-Version, und
# computePatch() vergleicht alle Felder. Erwartet: Produkt 1 (geaendert) + 3
# (neu) = 2 Upserts, Produkt 2 (fehlt in v2) = 1 Delete.
echo "$STDOUT2" | grep -q "Upserts: 2, Deletes: 1" && pass "Upserts/Deletes stimmen (1 geaendert, 1 neu, 1 geloescht)" || fail "erwartete 'Upserts: 2, Deletes: 1', bekam: $STDOUT2"
[ "$(jq -r '.baseline.version' "$OUT2/manifest.json")" = "2026-08-01T00-00-00Z" ] && pass "Baseline im Manifest unveraendert" || fail "Baseline haette gleich bleiben muessen"

echo ""
echo "=== Schritt 3: naechster Monat -> neue Baseline statt Patch ==="
V3="$WORK_DIR/v3.db"
write_extract_db "$V3" "2026-09-01T00-00-00Z" "1:Apfelsaft:45" "3:Neu:5"
OUT3="$WORK_DIR/out3"
STDOUT3=$(bun run "$BUILD_SCRIPT" --new-extract "$V3" --out-dir "$OUT3" --base-url "$BASE_URL" \
  --old-canonical "$OUT2/canonical.db" --previous-manifest "$OUT2/manifest.json")
echo "$STDOUT3" | grep -q "Neue Baseline geschnitten." && pass "Monatswechsel schneidet neue Baseline" || fail "erwartete 'Neue Baseline geschnitten.' bei Monatswechsel"

echo ""
echo "=== Schritt 4: reconstruct-canonical.ts aus Baseline+Patch -> muss echter canonical.db entsprechen ==="
RECONSTRUCTED="$WORK_DIR/reconstructed.db"
PATCH_FILE="$OUT2/patch-2026-08-01T00-00-00Z-2026-08-15T00-00-00Z.db"
STDOUT4=$(bun run "$RECONSTRUCT_SCRIPT" --baseline "$OUT1/baseline-2026-08-01T00-00-00Z.db" \
  --patches "$PATCH_FILE" --out "$RECONSTRUCTED" --expect-data-version "2026-08-15T00-00-00Z")
echo "$STDOUT4" | grep -q "quick_check: ok." && pass "quick_check der rekonstruierten DB ok" || fail "quick_check fehlgeschlagen"

DIFF_OUT=$(diff \
  <(sqlite3 "$RECONSTRUCTED" "select * from products order by code;") \
  <(sqlite3 "$OUT2/canonical.db" "select * from products order by code;") || true)
if [ -z "$DIFF_OUT" ]; then
  pass "rekonstruierter Produktinhalt ist byte-genau identisch zur echten canonical.db (inkl. Zahlentypen)"
else
  fail "rekonstruierter Inhalt weicht ab:"
  echo "$DIFF_OUT"
fi

echo ""
echo "=== Schritt 5: unterbrochene Patchkette -> muss fehlschlagen ==="
UNRELATED="$WORK_DIR/unrelated.db"
write_extract_db "$UNRELATED" "2099-01-01T00-00-00Z" "1:X:1"
if bun run "$RECONSTRUCT_SCRIPT" --baseline "$UNRELATED" --patches "$PATCH_FILE" --out "$WORK_DIR/broken.db" 2>/dev/null; then
  fail "haette bei unterbrochener Patchkette abbrechen muessen"
else
  pass "bricht bei unterbrochener Patchkette korrekt ab"
fi

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "ALLE TESTS BESTANDEN."
  exit 0
else
  echo "FEHLGESCHLAGEN — siehe FEHLER-Zeilen oben."
  exit 1
fi
