# Implementation Plan: Testqualitäts-Gates für Coverage und CI-Metriken

Spec: `tasks/spec-test-quality-gates.md`

Status: Freigegeben durch Marco, 2026-09-20.

Lokaler Qualitätsvertrag: `tasks/spec-test-quality-gates/CONSTRAINTS.md`

Tasks werden ausschließlich in Beads verfolgt. Der allgemeine Pfad
`tasks/plan.md` ist im Arbeitsbaum bereits als gelöscht markiert und gehört zu
einem anderen Maestro-Plan; er wird nicht wiederhergestellt oder überschrieben.

Beads-Parent: `fam-5yon`

## Overview

Die bestätigte Spec erhält zwei unabhängige vertikale Implementierungsslices:

1. `fam-5yon.1` schützt jede produktive App-Datei unter `src/` mit 70 Prozent
   je Coverage-Metrik.
2. `fam-5yon.2` führt den bestehenden Testqualitätsreport als eigenen,
   zunächst nicht-required GitHub-Actions-Job mit `GITHUB_STEP_SUMMARY` aus.

Keiner der beiden Tasks hängt vom anderen ab. Beide verwenden ausschließlich
den bereits bestehenden kanonischen CI-Unit-Scope.

## Architecture Decisions

- Die globale Coverage-Baseline 70/60/65/72 bleibt unverändert bestehen.
- Die neue Per-File-Policy gilt für alle produktiven `.ts`, `.tsx`, `.js` und
  `.jsx` unter `src/`, einschließlich plattformspezifischer Varianten;
  Test-, Spec- und reine Deklarationsdateien sind kein App-Code.
- Die Coverage-Eingabemenge muss alle Dateien dieses Scopes erfassen, auch
  unimportierte Dateien. Die Implementierung verwendet dafür
  `collectCoverageFrom` oder eine gleichwertige zentral getestete
  Scope-Auswertung. Nicht ausdrücklich benannte Ausnahmen sind unzulässig.
- Die vier Per-File-Mindestwerte sind jeweils 70 Prozent für Statements,
  Branches, Functions und Lines.
- Der Testqualitätsjob schreibt eine kompakte Zusammenfassung in
  `GITHUB_STEP_SUMMARY`. Es gibt in Version 1 keine Artefaktpflicht.
- Der Testqualitätsjob ist zunächst kein required Check. Technische Fehler des
  Jobs bleiben sichtbar und führen zu einem fehlgeschlagenen Job; Markerbefunde
  bleiben report-only.
- Es gibt keine Beads-Abhängigkeit zwischen `fam-5yon.1` und `fam-5yon.2`.

## Task List

### Independent Slice A: `fam-5yon.1`

#### Per-File-Coverage-Gate für produktive `src/`-Dateien

**Description:**

Die Coverage-Auswertung prüft zusätzlich zum globalen Jest-Gate jede produktive
App-Datei unter `src/`. Ein Unterschreiten eines der vier 70-Prozent-Werte
beendet den Coverage-Lauf mit einer verständlichen Datei-/Metrikmeldung.

**Acceptance criteria:**

- [x] Alle produktiven App-Dateien unter `src/` werden erfasst; Test-, Spec-,
  Deklarationsdateien werden nicht als App-Code behandelt;
  plattformspezifische App-Dateien werden erfasst. Die Vollständigkeit der
  Coverage-Eingabemenge ist mit einer unimportierten Fixture-Datei belegt.
- [x] Statements, Branches, Functions und Lines werden je Datei gegen 70
  Prozent geprüft.
- [x] Der kritische Fixture-Fall „global bestanden, einzelne Datei zu schwach“
  endet mit Exit-Code 1 und nennt Datei, Metrik, Istwert und Mindestwert.
- [x] Die bestehende globale Baseline 70/60/65/72 und der bestehende
  CI-Unit-Scope bleiben unverändert.
- [x] Die Policy nennt keine stillschweigende Sammelausnahme für native,
  generated oder ähnliche Pfade.

**Verification:**

- [x] Fokussierter Policy-/Fixture-Test mit `bun run test -- --runInBand
  <testdatei>`.
- [ ] `bun run test:coverage:unit`.
- [x] `bun run check` und `bun run typecheck`.

**Dependencies:** None.

**Files likely touched:**

- `jest.config.js`
- `package.json` oder ein dediziertes Coverage-Script unter `scripts/`
- `scripts/` für die Per-File-Auswertung
- `test/conventions/` für Policy- und Fixture-Verträge

**Estimated scope:** Medium, maximal fünf Dateien ohne Fixture-Ausweitung.

### Independent Slice B: `fam-5yon.2`

#### CI-Testqualitätsreport in `GITHUB_STEP_SUMMARY`

**Description:**

Der bestehende Testqualitätsreport wird als eigener GitHub-Actions-Job
ausgeführt. Der Job verwendet denselben Jest-Discovery-Scope, schreibt Scope,
Eingabemenge, Deklarationen, Marker und Heuristikgrenzen in die
GitHub-Schrittzusammenfassung und bleibt zunächst nicht-required.

**Acceptance criteria:**

- [x] `.github/workflows/ci.yml` enthält einen eigenen Job für den
  Testqualitätsreport.
- [x] Der Job ruft ausschließlich die bestehende kanonische
  `calculate-metrics.sh`-Hilfe mit dem CI-identischen Unit-Scope auf.
- [x] Die Ausgabe enthält Scope, Eingabedateien, Test-/Describe-Zahlen,
  Markerbefunde und bekannte Heuristikgrenzen in `GITHUB_STEP_SUMMARY`.
- [x] Discovery- oder Reportfehler führen zu einem fehlgeschlagenen Job; reine
  report-only Markerbefunde führen zunächst nicht zu einer fachlichen Blockade.
- [x] Der Job wird nicht als required Branch-Protection-Check vorausgesetzt;
  die Workflow-Änderung verändert keine Branch-Protection-Einstellung und die
  spätere Promotion bleibt eine separate Entscheidung außerhalb dieses Tasks.

**Verification:**

- [x] Fokussierter Workflow-/Kontrakttest mit `bun run test -- --runInBand
  <testdatei>`.
- [x] `bash -n .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh`.
- [x] Lokaler Lauf von `bash
  .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh`.
- [x] `bun run check` und `bun run typecheck`.

**Dependencies:** None. This task is independent of `fam-5yon.1`.

**Files likely touched:**

- `.github/workflows/ci.yml`
- `test/conventions/` für den Workflow-/Summary-Vertrag
- Bestehende Report-Hilfe nur, wenn die Summary-Ausgabe dort statt im
  Workflow zentralisiert werden muss

**Estimated scope:** Small bis Medium, zwei bis drei Dateien.

## Checkpoints

### Checkpoint A: Slice A independently complete

- [x] Per-File-Policy- und Fixture-Tests sind grün.
- [ ] Coverage-Lauf erkennt den global-bestanden/Datei-fehlgeschlagen-Fall.
- [x] Biome und Typecheck sind grün.

### Checkpoint B: Slice B independently complete

- [x] Workflow-Kontrakttest und lokale Metrikverifikation sind grün.
- [x] `GITHUB_STEP_SUMMARY` enthält den reproduzierbaren Reportumfang.
- [x] Technische Reportfehler liefern einen fehlgeschlagenen Job.
- [x] Biome und Typecheck sind grün.

### Checkpoint C: Gesamtprüfung nach beiden unabhängigen Slices

- [ ] `bun run test:unit` und `bun run test:coverage:unit` verwenden weiterhin
  denselben CI-Scope.
- [ ] Die fokussierten Kontrakttests, `bun run check` und `bun run typecheck`
  sind grün.
- [ ] Keine Änderung an Produktionsverhalten, Datenbankschema,
  Native-Build-Lock oder Remote-Transport.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Coverage-Datei enthält nicht alle produktiven `src/`-Dateien | Eine ungetestete Datei wird übersehen | Coverage-Collection und Source-Filter im Kontrakttest gegen ein Fixture prüfen |
| Per-File-70-Prozent-Regel trifft bestehende Legacy-Dateien | Der erste Lauf wird unbrauchbar streng | Alle Scope-Ausnahmen explizit versionieren; keine stillen Ausnahmen |
| Metrik-Scope driftet von CI-Unit-Scope | Reports sind nicht vergleichbar | Workflow- und Shell-Kontrakt auf denselben Jest-Discovery-Pattern prüfen |
| `GITHUB_STEP_SUMMARY` ist lokal nicht gesetzt | Lokale Verifikation verhält sich anders als CI | Lokalen Fallback nur für Ausgabe verwenden, CI-Summary in Workflow testen |
| Reportjob wird versehentlich required | Einführung blockiert Merge unerwartet | Required-Status nicht im Workflow behaupten; Promotion separat dokumentieren |

## Open Questions

- Zeitpunkt und Kriterien für die spätere Promotion des Metrikjobs zu einem
  required GitHub-Check.
