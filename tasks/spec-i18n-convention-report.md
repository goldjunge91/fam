# Spec: i18n-Konventionsreport ohne Diagnose-Rauschen

## Objective

Der i18n-Konventionstest soll report-only Hardcode-Funde kompakt und
deterministisch zusammenfassen. Echte Katalog-, Placeholder- und dynamische
Key-Fehler bleiben unverändert testkritisch. Maintainer können bei Bedarf über
`I18N_CONVENTION_VERBOSE=1` die bisherigen Einzelbefunde für lokale Diagnose
anzeigen.

## Commands

- Fokustest: `bun run test -- --runInBand test/conventions/i18n-convention.test.ts`
- Formatprüfung: `bun run check`
- Typecheck: `bun run typecheck`

## Project Structure

- `test/conventions/i18n-convention.test.ts` — Verhalten und Ausgabe des
  Konventionstests
- `test/conventions/i18n-convention-support.ts` — AST-Auswertung,
  Validierung und Report-Formatierung
- `tasks/spec-i18n-convention-report.md` — diese fachliche Vereinbarung

## Code Style

Der Report bleibt eine reine Funktion über bereits ermittelte Befunde. Die
Standardausgabe sortiert Kategorien und Pfade stabil; Aggregation erhält keine
nebenläufigen oder globalen Zustände.

```ts
formatHardcodedUiTextReport(references, { detailed: true });
```

## Testing Strategy

- Fixture-artige Formatter-Tests prüfen Gesamtzahl, Kategorien, stabile
  Pfad-Sortierung und die begrenzte Standardausgabe.
- Ein Detailmodus-Test stellt sicher, dass Einzelbefunde lokal weiterhin
  verfügbar sind.
- Bestehende Tests für fehlende Übersetzungen, Placeholder und untestbare
  dynamische Keys bleiben unverändert und müssen weiterhin fehlschlagen, wenn
  der Vertrag verletzt wird.

## Boundaries

- Always: Report-only und harte Validierungsfehler getrennt halten; Ausgabe
  deterministisch sortieren; fokussierte Jest-Tests ausführen.
- Ask first: Änderungen an Locale-Katalogen, CI-Konfiguration oder der
  Bedeutung harter Validierungsfehler.
- Never: Report-only Befunde als bestanden verschleiern; bestehende harte
  Fehler abschwächen; vollständige Suite nur für diese Ausgabeänderung starten.

## Success Criteria

- Der normale Testlauf gibt keine Einzelbefunde in großer Zahl aus.
- Die Standardausgabe enthält Gesamtzahl, jede Kategorie und einen stabilen,
  begrenzten Pfadüberblick.
- `I18N_CONVENTION_VERBOSE=1` gibt Einzelbefunde für lokale Diagnose aus.
- Fehlende Übersetzungen, Placeholder-Mismatches und untestbare dynamische Keys
  bleiben testkritisch.
- Fokus-Test, Biome und Typecheck sind grün.

## Open Questions

- Keine; die maximale Anzahl angezeigter Pfade ist eine Diagnosegrenze und kein
  Teil der fachlichen i18n-Validierung.
