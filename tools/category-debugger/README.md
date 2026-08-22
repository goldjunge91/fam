# Kategorie-Radar (Dump-Debugger)

Eigenständiges Vite/React-Mini-Tool, unabhängig von der App. Durchsucht den
echten lokalen OpenFoodFacts-Dump (denselben Release, den
`src/lib/off-dump/off-dump.ts` in der App herunterlädt) und zeigt zu jedem
Treffer:

- alle Felder aus dem Dump (EAN, Marke, Menge, Nutri-Score, Nährwerte, Läden)
- den vollständigen Ablauf von `guessCategory()` — welche Kategorie in welcher
  Reihenfolge geprüft wurde, welches Keyword getroffen hat, Substring oder
  Ganzwort

Importiert `guessCategory()`/`SHOPPING_CATEGORIES` direkt aus
`src/features/shopping-list/domain-logik/shopping-categories.ts` (keine
Kopie) und prüft nach jeder Analyse, ob die im Tool nachgebildete
Trace-Logik noch mit dem echten Funktionsergebnis übereinstimmt — bei
Abweichung erscheint eine Warnung statt einer falschen Erklärung.

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
