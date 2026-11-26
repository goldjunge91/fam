# Spec: i18n-Konventionsreport ohne Diagnose-Rauschen

## Objective

Der i18n-Konventionstest fasst report-only Hardcode-Funde kompakt und
deterministisch zusammen. Katalog-Parität, Placeholder-Parität, fehlende
statische Keys und untestbare dynamische Keys bleiben hart testkritisch. Der
`main-app`-Hardcode-Scanner bleibt für die Diagnose verfügbar und wird durch
eine Abschlussassertion im `main-app`-Scope blockierend, sobald alle
abhängigen Slices migriert sind.

## Current evidence

Gemessen im aktuellen Arbeitsstand auf `i18n-complete` mit getrennten Scopes:

- `de` und `en` werden aus `src/i18n/index.ts` abgeleitet.
- Der `main-app`-Scope entdeckt alle Locale-Paare außer
  `src/i18n/features/dev.de.json` und `src/i18n/features/dev.en.json`.
- Der `developer-only`-Diagnose-Scope entdeckt ausschließlich das `dev`-Paar.
  Developer-UI-Flächen verwenden zusätzlich gültige gemeinsame Kataloge; die
  Diagnose zählt nur `dev.*`-Referenzen gegen den `dev`-Katalog.
- Der Hardcode-Scanner misst final 228 Funde, alle im separaten
  `developer-only`-Scope. Der `main-app`-Scope ist mit 0 reportbaren Funden
  abgeschlossen; vor der Migration waren es 507 Funde (279 Main-App und 228
  Developer-Diagnose).
- Der `main-app`-Scope meldet final 0 Katalog-, 0 statische und 0 dynamische
  Übersetzungsfehler sowie 0 Hardcode-Funde.
- Der getrennte `developer-only`-Diagnose-Scope meldet weiterhin 6
  Katalogfehler, 58 statische und 46 dynamische Referenzfehler sowie 228
  Hardcode-Funde. Diese Befunde bleiben sichtbar, sind aber kein Teil des
  Main-App-Gates.
- Die bedingte `dev.info.*`-Referenz in
  `src/features/settings/settings-screen.tsx` wird wegen `hasDevToolsAccess`
  dem Developer-Diagnose-Scope zugeordnet. Die Runtime-Registrierung und der
  private Entwicklerpfad bleiben unverändert. Referenzen werden nach Quellpfad
  und Schlüssel klassifiziert: Ein `dev.*`-Schlüssel in einer normalen
  Produktdatei bleibt im `main-app`-Scope und wird dort als fehlender Schlüssel
  beanstandet.

## Scope boundary

Der blockierende `main-app`-Scope umfasst alle Produktionsdateien und
Locale-Kataloge außer der folgenden exakt abgegrenzten Developer-Flächen:

- `src/features/settings/dev/**`
- `src/features/settings/sync-debug-screen.tsx`
- `src/app/settings/dev*.tsx`
- `src/app/settings/sync-debug.tsx`
- `src/i18n/features/dev.de.json`
- `src/i18n/features/dev.en.json`

Die `dev.*`-Referenzen in der bedingten Entwicklerzeile von
`src/features/settings/settings-screen.tsx` werden ebenfalls nur diagnostisch
geprüft. Gemeinsame `common.*`- und `settings.*`-Referenzen aus Developer-Dateien
bleiben normale Katalogreferenzen und werden nicht als `dev`-Fehler gezählt.
Die Locale-Imports und Runtime-Registrierungen in `src/i18n/index.ts` bleiben
unverändert. Eingehendes Teilen aus anderen Apps bleibt außerhalb des
Rezeptimport-Scopes.

## Commands

- Fokustest: `bun run test -- --runInBand --no-watchman test/conventions/i18n-convention.test.ts`
- Abschlussprüfung mit Ressourcenregression: `bun run test -- --runInBand --no-watchman src/i18n/index.test.ts test/conventions/i18n-convention.test.ts`
- Formatprüfung: `bun run check`
- Typecheck: `bun run typecheck`
- Diagnosemodus: `I18N_CONVENTION_VERBOSE=1 bun run test -- --runInBand --no-watchman test/conventions/i18n-convention.test.ts`

Die Feature-Slices verwenden zusätzlich ihre jeweils festgelegten fokussierten
Pfade. Eine vollständige unscoped Testsuite wird nicht gestartet.

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

- Always: Report-only-Diagnose und harte Validierungsfehler getrennt halten;
  Ausgabe deterministisch sortieren; den `main-app`-Hardcode-Scanner ohne
  Developer-Pfade blockierend prüfen; den `developer-only`-Scope nur als
  separate Diagnose ausgeben; fokussierte Jest-Tests ausführen.
- Ask first: Änderungen an Locale-Katalogen, CI-Konfiguration oder der
  Bedeutung harter Validierungsfehler.
- Never: Report-only Befunde als bestanden verschleiern; bestehende harte
  Fehler abschwächen; vollständige Suite nur für diese Ausgabeänderung starten.

## Success Criteria

- Der normale Testlauf gibt keine Einzelbefunde in großer Zahl aus.
- Die Standardausgabe enthält Gesamtzahl, jede Kategorie und einen stabilen,
  begrenzten Pfadüberblick.
- `I18N_CONVENTION_VERBOSE=1` gibt Einzelbefunde für lokale Diagnose aus.
- Fehlende Übersetzungen, Placeholder-Mismatches, untestbare dynamische Keys und
  reportbare Funde im abgeschlossenen `main-app`-Scope bleiben testkritisch.
- Die Developer-Befunde werden nicht gelöscht oder allowgelistet; sie bleiben
  über den separaten Diagnose-Scope nachvollziehbar.
- Fokus-Test, Biome und Typecheck sind nach Abschluss der abhängigen Slices grün;
  Zwischenstände dokumentieren ihre getrennten Blocker.

## Open Questions

- Keine; die maximale Anzahl angezeigter Pfade ist eine Diagnosegrenze und kein
  Teil der fachlichen i18n-Validierung.
