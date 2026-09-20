# Spec: Testqualitäts-Gates für Coverage und CI-Metriken

Status: Freigegeben durch Marco, 2026-09-20.

Lokaler Qualitätsvertrag: [`spec-test-quality-gates/CONSTRAINTS.md`](spec-test-quality-gates/CONSTRAINTS.md)

## Objective

Die bestehende Testqualitäts-Infrastruktur soll zwei blinde Flecken schließen:

1. Die aktuelle Coverage-Schwelle gilt nur global. Eine hohe Gesamtcoverage
   kann dadurch eine schwach getestete einzelne Quelldatei verdecken.
2. Die Testqualitätsmetrik läuft derzeit nur manuell als report-only-Hilfe. Sie
   soll automatisch in CI ausgeführt werden und ihren Scope sowie ihre
   Ergebnisse nachvollziehbar veröffentlichen.

Die bestehende globale Coverage-Baseline bleibt erhalten. Die neue Regel ergänzt
sie um eine explizite Per-File-Policy von 70 Prozent je Coverage-Metrik für
produktive App-Dateien unter `src/`. Der Metriklauf wird als eigener CI-Job
ausgeführt und schreibt in die `GITHUB_STEP_SUMMARY`. Der Job ist zunächst kein
required Check. Ein kaputter Metriklauf oder eine nicht ermittelbare
Eingabemenge ist trotzdem ein technischer Jobfehler; fachliche Markerbefunde
bleiben in der ersten Version report-only.

## Capability Map

Die Anfrage enthält zwei unabhängig testbare Fähigkeiten. Beide verwenden den
bereits bestehenden, CI-identischen Unit-Test-Scope als gemeinsame Grundlage.

| Module-ID | Verantwortung | Abhängigkeit |
| --- | --- | --- |
| `ci-unit-scope-contract` | Kanonische Testdatei-Auswahl und Ausschlüsse für Unit-, Coverage- und Metrikläufe | bestehender Vertrag |
| `per-file-coverage-enforcement` | Schwache einzelne Quelldateien trotz ausreichender globaler Coverage erkennen und nach einer versionierten Policy blockieren | `ci-unit-scope-contract` |
| `ci-test-quality-report` | Testqualitätsmetriken automatisch in CI ausführen, Scope ausweisen und den Bericht in `GITHUB_STEP_SUMMARY` veröffentlichen | `ci-unit-scope-contract` |

Build order: bestehender `ci-unit-scope-contract` →
`per-file-coverage-enforcement` und `ci-test-quality-report` parallel.

Die Module bleiben getrennt: Die Coverage-Policy entscheidet über
Testausführungsqualität, der Metrikreport beschreibt die Teststruktur. Kein
Modul erzeugt Produktmetriken oder verändert Produktionscode.

## Assumptions

1. Die bestehende globale Baseline 70/60/65/72 für Statements/Branches/
   Functions/Lines bleibt der erste Schutz gegen einen Rückgang der
   Gesamtabdeckung.
2. Die Per-File-Policy gilt für alle produktiven Laufzeitdateien unter `src/`
   mit den Endungen `.ts`, `.tsx`, `.js` oder `.jsx`, einschließlich
   plattformspezifischer Varianten. Testdateien, Spec-Dateien und reine
   TypeScript-Deklarationsdateien zählen nicht als App-Code.
3. Jede der vier Coverage-Metriken erhält pro App-Datei den Mindestwert
   70 Prozent: Statements, Branches, Functions und Lines.
4. Der neue Metrikjob nutzt weiterhin
   `bash .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh`
   und damit dieselbe Jest-Discovery wie der CI-Unit-Lauf.
5. Marker wie `.only`, `.skip`, `fit`, `xit`, `fdescribe` und `xdescribe`
   bleiben zunächst Befunde im Bericht. Sie werden nicht automatisch entfernt
   und machen den Job in Version 1 nicht allein deshalb rot. Der Job wird
   zunächst nicht als required GitHub-Check markiert; eine spätere Promotion
   ist ein eigener Entscheid.
6. Die Einführung ändert weder Produktionscode noch Datenbank, Native-Builds
   oder Testabhängigkeiten.

## Tech Stack

- Jest über das bestehende `bun scripts/run-test.ts`-Wrapper-Skript
- Bun 1.3.1 in CI
- TypeScript-AST-Auswertung über `typescript`
- Bash-Hilfsskript für Discovery und Berichtserzeugung
- GitHub Actions als CI-Orchestrierung
- Biome und `tsc --noEmit` als bestehende statische Gates

## Verifizierte technische Quellen

- Jest 29.7 dokumentiert `collectCoverageFrom` für Dateien, die auch ohne
  Import durch einen Test in die Coverage aufgenommen werden, sowie
  `coverageThreshold` für globale, Verzeichnis-, Glob- und Datei-Schwellen:
  <https://jestjs.io/docs/29.7/configuration#collectcoveragefrom> und
  <https://jestjs.io/docs/29.7/configuration#coveragethreshold-object>
- GitHub Actions dokumentiert `GITHUB_STEP_SUMMARY` als Step-Datei für
  Markdown-Jobzusammenfassungen:
  <https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions#adding-a-job-summary>

## Commands

Bestehende Gates, die unverändert gültig bleiben:

```bash
bun run test:unit
bun run test:coverage:unit
bun run check
bun run typecheck
```

Neue beziehungsweise zu verdrahtende Verifikation:

```bash
bash .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh
bun run test -- --runInBand test/conventions/coverage-gate.test.ts
bun run test -- --runInBand test/conventions/test-quality-metrics.test.ts
```

Der Per-File-Check gehört in den bestehenden Coverage-Lauf oder in einen
explizit benannten Unterlauf desselben CI-Scopes. Ein zweiter, abweichender
Testdatei-Filter ist nicht zulässig. Die Implementierung muss außerdem
nachweisen, dass die Coverage-Eingabemenge alle produktiven `src/`-Dateien
enthält, auch wenn sie von keiner Testdatei importiert werden. Dafür ist
`collectCoverageFrom` oder eine gleichwertige, zentral getestete
Scope-Auswertung erforderlich.

## Project Structure

- `jest.config.js` → globale Coverage-Baseline und Coverage-Optionen
- `package.json` → kanonische Unit- und Coverage-Kommandos
- `.github/workflows/ci.yml` → blockierende CI-Gates und neuer Metrikjob
- `scripts/` → Per-File-Auswertung beziehungsweise gemeinsame Policy-Logik
- `scripts/analyze-test-declarations.ts` → AST-Auswertung der
  Testdeklarationen
- `.codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh` →
  kanonischer Testqualitätsreport
- `.claude/skills/analyzing-test-quality/scripts/calculate-metrics.sh` →
  synchronisierte Kopie
- `test/conventions/` → Konfigurations-, Scope- und Report-Verträge
- `tasks/archive/spec-coverage-gate.md` → bestehender globaler Coverage-Vertrag
- `tasks/archive/spec-test-quality-metrics.md` → bestehender statischer Metrikvertrag
- diese Spec → übergeordneter Vertrag für die beiden Erweiterungen

## Code Style

Die Policy wird als typisierte Datenstruktur ausgewertet. Fehler müssen Datei,
Metrik, Istwert und Grenzwert nennen; keine unstrukturierten
String-Vergleiche in mehreren Stellen:

```ts
type CoverageMetric = 'statements' | 'branches' | 'functions' | 'lines';

type FileCoverageFailure = {
  file: string;
  metric: CoverageMetric;
  actual: number;
  minimum: number;
};

function formatFailure(failure: FileCoverageFailure): string {
  return `${failure.file}: ${failure.metric} ${failure.actual}% < ${failure.minimum}%`;
}
```

Der CI-Job muss den bestehenden Scope sichtbar machen und den Bericht in die
GitHub-Schrittzusammenfassung schreiben:

```yaml
- name: Testqualitätsmetriken
  run: |
    report="$(bash .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh)"
    printf '%s\n' "$report"
    printf '%s\n' "$report" >> "$GITHUB_STEP_SUMMARY"
```

Die konkrete Policy-Konfiguration wird im Plan festgelegt; ein separates
Artefakt ist für die erste Version nicht erforderlich.

## Testing Strategy

### Per-File-Coverage

- Ein fokussierter Konfigurationstest prüft die globale Baseline, die
  Per-File-Policy von 70 Prozent je Metrik und die Einschränkung auf
  produktive Dateien unter `src/`, einschließlich plattformspezifischer
  Varianten.
- Ein Scope-Test beweist, dass eine unimportierte produktive `src/`-Datei in
  der Coverage-Eingabemenge auftaucht und dass nur die im lokalen
  Qualitätsvertrag genannten Ausnahmen ausgeschlossen werden.
- Ein synthetischer Fixture-Test beweist den kritischen Fall: globale
  Coverage besteht, eine einzelne Datei unterschreitet die Per-File-Grenze,
  der Lauf endet mit Exit-Code 1 und nennt die betroffene Datei.
- Ein Positivfall prüft, dass eine Datei mit ausreichender Coverage und der
  bestehende globale Lauf erfolgreich bleiben.
- Ein Test prüft, dass Test-, Spec- und Deklarationsdateien ausgeschlossen
  bleiben und dass plattformspezifischer App-Code nicht stillschweigend aus
  der Per-File-Policy fällt.

### Automatischer Testqualitätsreport

- Ein Workflow-Konfigurationstest prüft, dass CI den Metrikjob mit dem
  kanonischen Skript startet.
- Der Report muss die durch Jest entdeckte Eingabemenge, den Scope, die
  Deklarationszahlen, Marker und die bekannten Heuristikgrenzen in
  `GITHUB_STEP_SUMMARY` ausgeben.
- Ein Fehler bei Jest-Discovery, fehlenden Eingabedateien oder der
  Report-Erzeugung schlägt den Job fehl.
- Markerbefunde bleiben report-only und werden als solche im Bericht
  gekennzeichnet.
- Die bestehenden AST-Fixtures prüfen weiterhin Kommentare, Stringliterale,
  Einrückung, Verschachtelung und alle unterstützten Marker.

### Gemeinsame Gates

Vor einem Commit und in CI laufen die fokussierten Tests, Biome und Typecheck.
Die vollständige Jest-Suite wird nicht als Standardverifikation dieses Specs
eingeführt.

## Boundaries

- Always: Unit-, Coverage- und Metrikläufe verwenden denselben kanonischen
  Jest-Scope; Fehler nennen reproduzierbare Datei-/Metrikdaten; globale und
  Per-File-Coverage bleiben getrennt sichtbar; Reports enthalten ihre
  Eingabemenge; die Coverage-Eingabemenge enthält alle produktiven
  `src/`-Dateien.
- Ask first: konkrete Per-File-Schwellen, Baseline-Ausnahmen, Änderung des
  CI-Triggerverhaltens, neue Dependencies, neue Artefaktaufbewahrung und die
  Entscheidung, ob Marker später blockierend werden.
- Never: Coverage nur report-only ausgeben; den globalen Wert als Ersatz für
  Per-File-Qualität behandeln; Testdateien oder Marker automatisch löschen;
  Test-, Spec- oder Deklarationsdateien als produktive App-Dateien behandeln;
  plattformspezifischen App-Code pauschal ausschließen; Integrationstests,
  Native-Build-Tests oder `node_modules` in den Unit-Scope aufnehmen;
  Produktionscode für den Metrikreport verändern.

## Success Criteria

- `per-file-coverage-enforcement` hat eine versionierte, im Repository
  überprüfte Policy und erkennt den Fall „global bestanden, einzelne Datei
  unterschritten“ mit Exit-Code 1. Die Policy erfasst auch unimportierte
  produktive `src/`-Dateien.
- Der globale Coverage-Lauf bleibt bei 70/60/65/72 bestehen und verwendet
  weiterhin denselben CI-Unit-Scope.
- CI führt einen eigenen, zunächst nicht-required Testqualitätsjob aus und
  veröffentlicht mindestens Scope, Eingabedateien, Metriken, Markerbefunde und
  Heuristikgrenzen in `GITHUB_STEP_SUMMARY`.
- Der Metrikjob schlägt bei technischen Ausführungs-/Discovery-Fehlern fehl,
  aber nicht allein wegen report-only Markerbefunden.
- Jede produktive App-Datei unter `src/` erreicht mindestens 70 Prozent in
  Statements, Branches, Functions und Lines oder wird mit einem klaren
  Datei-/Metrikfehler abgelehnt.
- Konfigurations-, Fixture- und Workflow-Tests schützen beide Verträge.
- `bun run check`, `bun run typecheck`, der fokussierte Testlauf und der
  Coverage-Lauf sind grün.
- Keine Änderung an Produktionsverhalten, Datenbankschema, Native-Build-Lock
  oder Remote-Transport ist erforderlich.

## Open Questions

- Keine offenen Fragen für die erste Implementierung.
- Die spätere Promotion des Metrikjobs zu einem required GitHub-Check wird
  nach einer Beobachtungsphase separat entschieden.

## Review Gate

Die Capability Map, die Per-File-Policy von 70 Prozent je Metrik für alle
produktiven `src/`-Dateien, der zunächst nicht-required Metrikjob,
`GITHUB_STEP_SUMMARY`, die Scope-Vollständigkeit und die unabhängigen
Beads-Aufgaben sind freigegeben. Die Implementierung kann nach dem Plan in
`tasks/spec-test-quality-gates-plan.md` beginnen. Die Beads-Aufgaben bleiben
bis zur tatsächlichen Implementierung offen.
