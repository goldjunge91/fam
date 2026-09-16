# Spec: Testqualitätsmetriken im CI-Unit-Scope

## Objective

Die Testqualitäts-Metrik soll dieselbe Testdateimenge wie der CI-Unit-Lauf
auswerten. Sie muss eingerückte und verschachtelte Jest-Deklarationen zählen
und fokussierte/übersprungene Varianten sichtbar machen, ohne Kommentare oder
Stringliterale als Tests zu zählen. Der Bericht soll Scope, konkrete
Eingabedateien und bekannte Grenzen der statischen Analyse ausgeben.

## Tech Stack

- Bash als bestehende Einstiegshilfe unter `.codex/skills/...` und
  `.claude/skills/...`
- Bun und TypeScript für die AST-Auswertung
- Jest für die fokussierten Regressionstests
- Biome und `tsc --noEmit` für statische Prüfung

## Commands

- Metrik: `bash .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh`
- Regression: `bun run test -- --runInBand test/conventions/test-quality-metrics.test.ts`
- Check: `bun run check`
- Typecheck: `bun run typecheck`

## Project Structure

- `scripts/analyze-test-declarations.ts` → AST-Auswertung von Testdeklarationen
- `.codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh` →
  CI-Scope und Bericht
- `.claude/skills/analyzing-test-quality/scripts/calculate-metrics.sh` →
  synchronisierte Kopie
- `test/conventions/test-quality-metrics.test.ts` → Fixture-/Shell-Verträge

## Code Style

Die AST-Auswertung arbeitet auf benannten Jest-Aufrufen und ignoriert dadurch
Kommentare und Stringliterale:

```ts
const declaration = getJestDeclaration(node);
if (declaration) {
  counts[declaration.kind] += 1;
  if (declaration.marker) markers[declaration.marker] += 1;
}
```

Keine `any`-Casts, keine regulären Ausdrücke für die Deklarationszählung und
keine Änderungen an Jest-Konfiguration oder Produktionscode.

## Testing Strategy

- Jest-Dateien werden über `jest --listTests` mit derselben Config und dem
  CI-Ausschluss ermittelt.
- Der TypeScript-AST zählt `test`/`it`/`describe` einschließlich verschachtelter
  und eingerückter Aufrufe.
- `.only`, `.skip`, `fit`, `fdescribe`, `xit` und `xdescribe` werden als Marker
  ausgewiesen.
- Ein fokussierter Test prüft zusätzlich Kommentare, Strings, Einrückung,
  Verschachtelung und alle relevanten Marker.
- Die bestehende Analyse bleibt report-only; sie schlägt nicht wegen bereits
  vorhandener Marker fehl.

## Boundaries

- Always: CI-Testscope über Jest Discovery bestimmen, Eingabemenge ausgeben,
  fokussierte Tests und statische Checks ausführen.
- Ask first: Änderungen am CI-Befehl, Jest-Scope, Abhängigkeiten oder
  Produktionscode.
- Never: Integrationstests, `node_modules`, Skill-Duplikate außerhalb der
  beiden synchronisierten Kopien oder persönliche Env-Dateien mitzählen;
  keine Marker automatisch entfernen.

## Success Criteria

- Die Metrik zählt ausschließlich die vom CI-Unit-Lauf entdeckten Testdateien.
- Test- und Describe-Deklarationen werden AST-basiert auch eingerückt und
  verschachtelt erkannt.
- `.only`, `.skip`, `fit`, `fdescribe`, `xit` und `xdescribe` werden ohne
  relevante False Positives gemeldet.
- Bericht und JSON-/Textdaten nennen Scope, Eingabemenge und Heuristikgrenzen.
- Der fokussierte Regressionstest, Biome und Typecheck sind erfolgreich.

## Open Questions

- Die globale Coverage-Schwelle bleibt Aufgabe von `fam-okaa.5` und ist hier
  ausdrücklich nicht enthalten.
