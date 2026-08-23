# Kategorie-Radar (Dump-Debugger)

Eigenständiges Vite/React-Mini-Tool, unabhängig von der App. Durchsucht den
echten lokalen OpenFoodFacts-Dump (denselben Release, den
`src/lib/off-dump/off-dump.ts` in der App herunterlädt) und zeigt zu jedem
Treffer:

- alle Felder aus dem Dump (EAN, Marke, Menge, Nutri-Score, Nährwerte, Läden)
- den vollständigen Entscheidungs-Trace von `explainCategory()` — welche
  OFF-Tag- und Namens-Kandidaten gematcht haben, mit welchem Gewicht, wer
  gewonnen hat und warum die übrigen verworfen wurden

Importiert `explainCategory()`/`classifyCategory()` direkt aus
`src/features/shopping-list/classification/shopping-category-classifier.ts`
(keine Kopie) — Kategorielabels/-farben kommen weiterhin aus
`SHOPPING_CATEGORIES` in `.../domain-logik/shopping-categories.ts`.

Zusätzlich ein **Freitext- & Barcode-Tester** oben auf der Seite: beliebigen
Artikelnamen und optional kommagetrennte OFF-Tags eintippen, der Trace
aktualisiert sich live — unabhängig vom geladenen Dump.

## Bekannte Lücke

Der Generator (`scripts/dump_data/create_custom_dump.py`) erzeugt seit #223
Paket 4 **Schema 2** mit `categories_tags`/`off_last_modified_at`. Bis eine
neue Baseline tatsächlich veröffentlicht wurde (voller OFF-Export, ~12 GB,
läuft nicht in CI-Sandboxes — siehe Kommentar im Skript), liegt der
heruntergeladene Dump-Release aber noch im alten **Schema 1** vor. Fehlt die
Spalte, liefert `parseCategoryTagsJson()` einfach `[]` (kein Crash), der
Dump-Trace fällt dann automatisch auf den Namens-Fallback zurück — für
OFF-Tag-Tests unabhängig davon jederzeit den Freitext-Tester oben nutzen.

Die deterministischen 100-Stichproben-je-Kategorie- und
Golden-Korpus-Auswertung aus dem Plan liefert
`bun run evaluate-categories` (`scripts/dump_data/evaluate-categories.ts`,
bereits seit Paket 1 vorhanden) — läuft schon jetzt gegen den lokalen Dump,
die OFF-Tag-Metriken darin füllen sich automatisch, sobald ein
Schema-2-Release vorliegt.

## Nutzung

```bash
cd tools/category-debugger
bun install
bun run download-dump   # lädt den neuesten .db-Release nach public/off-dump.db
bun run dev
```

Läuft komplett lokal — `sql.js` (WASM-SQLite) öffnet die `.db`-Datei direkt
im Browser, kein Backend, keine Verbindung zur laufenden App nötig.

Der Dump wird nicht committed (`.gitignore`) — bei Bedarf einfach erneut
`bun run download-dump` ausführen, um auf den neuesten Release zu aktualisieren.
