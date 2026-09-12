# Implementation Plan: i18n Translation Quality Gate

Status: umgesetzt.

## Overview

Der bestehende Draft unter `docs/specs/i18n-translation-quality-gate/SPEC.md`
wird als automatischer Jest-Konventionscheck umgesetzt. Der Gate prüft
Locale-Dateien, Platzhalter und statische sowie dynamische Übersetzungsschlüssel.
Hardcodierte UI-Texte gehören zum selben Qualitätsziel, werden wegen des
aktuellen Rückstands zunächst nur als Bericht ausgegeben und später blockierend
gemacht.

Tasks werden in Beads verfolgt. Dieses Dokument ist nur der geordnete Plan und
enthält keine parallele Aufgaben-Checkliste.

## Architecture Decisions

- Der Test bleibt unter `test/conventions/i18n-convention.test.ts` und liest die
  Kataloge direkt aus dem Dateisystem.
- Unterstützte Sprachen werden aus `SUPPORTED_LANGUAGES` in
  `src/i18n/index.ts` abgeleitet. Ein Dateipaar allein aktiviert keine Sprache.
- Es gibt keine globale Allowlist aller Übersetzungsschlüssel.
- Dynamische Keys werden nur akzeptiert, wenn ihre Variablen aus einer
  endlichen, im Produktionscode vorhandenen Wertemenge stammen. Der Gate
  expandiert diese Wertemenge und prüft jeden konkreten Key.
- Ein dynamischer Key aus einem unbeschränkten `string`, Serverdaten oder
  Nutzereingaben ist ein Fehler, nicht ein ignorierter Prüfgrenzfall.
- Die Hardcoded-UI-Prüfung wird technisch getrennt ausgewertet, bleibt aber
  Teil desselben Übersetzungsqualitätsziels. Bestehende Funde blockieren in der
  ersten Migrationsphase nicht.
- Es werden keine neuen Runtime- oder Parser-Abhängigkeiten eingeführt, bevor
  der vorhandene TypeScript-AST und die bestehende Jest-Konfiguration geprüft
  sind.

## Dependency Graph

```text
Runtime-Sprachen und Katalogdateien
        |
        +--> Katalog-/Platzhalter-Parität
        |
        +--> AST-Erkennung statischer Keys
        |          |
        |          +--> endliche dynamische Key-Familien
        |
        +--> Hardcoded-UI-Bericht (nicht blockierend in Phase 1)
```

## Task List

### Phase 1: Blockinges Fundament

1. `fam-b0p.1` Katalogdateien, Locale-Parität und Platzhalter prüfen.
2. `fam-b0p.2` Statische Übersetzungsreferenzen per TypeScript-AST prüfen.

### Checkpoint: Blockinges Fundament

Nach `fam-b0p.1` und `fam-b0p.2` müssen der aktuelle Katalog und alle aktuellen
statischen Referenzen grün sein. Der gezielte Konventionscheck, `bun run check`
und `bun run typecheck` werden ausgeführt.

### Phase 2: Dynamische Keys

3. `fam-b0p.3` Endliche dynamische Key-Familien automatisch expandieren und
   unbeschränkte dynamische Keys als Fehler melden.
4. `fam-b0p.4` Regression-Fixtures für fehlende dynamische Werte und
   untestbare dynamische Ausdrücke ergänzen.

### Checkpoint: Dynamische Keys

Nach `fam-b0p.3` und `fam-b0p.4` darf kein dynamischer Übersetzungsschlüssel
mehr stillschweigend aus der Prüfung fallen. Ein neuer gültiger Wert in einer
Produktionswertemenge wird ohne Änderung der Testdatei geprüft.

### Phase 3: Gestufter Hardcoded-UI-Bericht

5. `fam-b0p.5` Sichtbare hartcodierte UI-Texte erkennen und zunächst als
   nicht-blockierenden Bericht ausgeben. Die Ausgabe muss Datei, Zeile und
   erkannte UI-Position nennen, ohne Marken, technische Werte oder Testcode
   pauschal als Übersetzung zu behandeln.

### Checkpoint: Gesamt-Gate

Nach `fam-b0p.5` laufen alle Prüfungen unter `bun run test`; Parität und
Missing-Key-Prüfungen bleiben blockierend, bestehende Hardcoded-UI-Funde bleiben
report-only. Eine spätere Umstellung auf blockierend ist eine explizite
Migrationsentscheidung.

## Verification

- Fokustest: `bun run test --runInBand --no-watchman test/conventions/i18n-convention.test.ts`
- Vollständige Unit-Tests: `bun run test`
- Format/Lint: `bun run check`
- Typen: `bun run typecheck`
- Vor Abschluss: gezielte Prüfung der Testfehlermeldungen anhand absichtlich
  fehlerhafter kleiner Fixtures.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AST-Scanner erkennt React-/i18next-Varianten unvollständig | Hoch | Fixtures für `t`, `i18n.t`, Template-Literale und Plural-Basisschlüssel |
| Dynamische Wertemengen werden doppelt im Test gepflegt | Hoch | Wertemenge bleibt Produktionsquelle; Test expandiert sie nur |
| Hardcoded-Scanner meldet zu viele False Positives | Mittel | Zunächst report-only, konservative UI-Positionen und Ausschluss von Tests |
| Expo-Runtime wird im Konventionstest geladen | Mittel | Kataloge und statische Quellen direkt lesen, keine Runtime-Initialisierung |
| Neue Sprache wird nur als JSON-Datei angelegt | Mittel | Ableitung aus `SUPPORTED_LANGUAGES` und Prüfung des Dateipaars |

## Approval Gate

Der Plan wurde vom Maintainer freigegeben und in den vier inkrementellen
Commits für Parität, statische Keys, dynamische Keys und den report-only
Hardcoded-UI-Check umgesetzt.
