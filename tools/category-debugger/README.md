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

Der heruntergeladene Dump ist noch **Schema 1** (kein `categories_tags`).
Der Dump-Treffer-Pfad läuft deshalb bis Paket 4 (Offline-Dump Schema 2)
zwangsläufig nur über den Namens-Fallback — für OFF-Tag-Tests den
Freitext-Tester oben nutzen. Die deterministischen 100-Stichproben-je-
Kategorie- und Golden-Korpus-Ansichten aus dem Plan folgen mit dem
Kalibrierungs-Skript (`scripts/dump_data/evaluate-categories.ts`, Paket 5),
sobald ein Schema-2-Dump vorliegt.

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
