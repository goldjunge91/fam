# Spec: CI-Coverage-Gate für den Unit-Scope

## Objective

Der CI-Unit-Scope soll Coverage reproduzierbar messen und gegen eine bewusst
niedrige, dokumentierte Startbaseline prüfen. Der normale Unit-Testlauf bleibt
schnell und unverändert ohne Coverage-Instrumentierung. Die Startbaseline liegt
unter der zuletzt verifizierten Coverage und verhindert dadurch keinen legitimen
Zwischenstand.

## Commands

- Unit-Scope: `bun run test:unit`
- Coverage-Gate: `bun run test:coverage:unit`
- Fokussierter Konfigurationstest: `bun run test -- --runInBand test/conventions/coverage-gate.test.ts`
- Formatprüfung: `bun run check`
- Typecheck: `bun run typecheck`

## Project Structure

- `jest.config.js` — globale Coverage-Schwellen und kompakte Reporter-Konfiguration
- `package.json` — kanonische Unit- und Coverage-Unit-Skripte
- `.github/workflows/ci.yml` — CI-Aufruf des bestehenden Unit-Scopes und des Coverage-Gates
- `test/conventions/coverage-gate.test.ts` — Konfigurationsvertrag
- `tasks/archive/spec-coverage-gate.md` — diese fachliche Vereinbarung

## Code Style

Der CI-Testscope wird einmal im Package-Script definiert und von lokalen sowie
CI-Aufrufen wiederverwendet:

```json
"test:unit": "bun run test -- --testPathPattern='^(?!.*test/native-build-(baseline|artifact)[.]test[.]ts$).*'"
```

Das Coverage-Gate setzt nur die Instrumentierung und die Coverage-Reporter
darauf auf. Es führt keine eigene abweichende Dateiauswahl ein.

## Testing Strategy

- Jest misst Coverage nur über den expliziten `test:coverage:unit`-Scope.
- Die globale Startbaseline lautet: Statements 70 %, Branches 60 %, Functions
  65 %, Lines 72 %.
- Der Konfigurationstest schützt Schwellen, Scope und die Trennung zwischen
  normalem Unit-Lauf und Coverage-Lauf.
- Ein lokaler Lauf mit einer absichtlich unerreichbaren Schwelle weist den
  Threshold-Breach reproduzierbar nach.

## Boundaries

- Always: CI und lokale Verifikation verwenden denselben Unit-Scope; Schwellen
  bleiben unter der verifizierten Baseline; echte Testfehler bleiben blockierend.
- Ask first: Erhöhung der Schwellen über die Startbaseline, zusätzliche
  per-Datei-Schwellen oder Änderungen am nativen/DB-CI-Scope.
- Never: Coverage nur report-only ausgeben, die Schwellen im normalen Testlauf
  erzwingen oder die native-build Tests still aus dem gesamten CI entfernen.

## Success Criteria

- `test:unit` und `test:coverage:unit` verwenden exakt denselben Testpfad-Scope.
- Jest kennt die Schwellen 70/60/65/72 für Statements/Branches/Functions/Lines.
- CI führt das Coverage-Gate als eigenen Unit-Scope-Schritt aus.
- Ein kontrollierter Lauf mit höherer Testschwelle endet mit Exit-Code 1.
- Fokustest, Biome und Typecheck sind grün.

## Open Questions

- Nach weiteren Sync-Test-Slices wird die Baseline neu gemessen und schrittweise
  erhöht; diese Erhöhung ist nicht Teil dieses Tasks.
