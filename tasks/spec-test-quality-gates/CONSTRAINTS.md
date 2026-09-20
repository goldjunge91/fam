# Constraints: Testqualitäts-Gates für Coverage und CI-Metriken

**Status:** Freigegeben durch Marco
**Stand:** 2026-09-20
**Geltungsbereich:** Ausschließlich
[`spec-test-quality-gates.md`](../spec-test-quality-gates.md),
[`spec-test-quality-gates-plan.md`](../spec-test-quality-gates-plan.md) und die
Beads-Aufgaben `fam-5yon`, `fam-5yon.1` und `fam-5yon.2`.

Diese Datei ergänzt den globalen Qualitätsvertrag
[`../../CONSTRAINTS.md`](../../CONSTRAINTS.md), schwächt ihn aber nicht ab.
Bei einem Konflikt gilt der globale Vertrag. Die Freigabe dieser lokalen Datei
gibt nicht den globalen Vertrag frei und ändert dessen Status nicht.

## Verbindlicher Floor

Ein Verstoß blockiert die Abnahme des jeweiligen Beads-Tasks.

- Keine neuen Suppressionen wie `@ts-ignore`, `as any`, `as unknown as`,
  `as never`, Non-null-Assertions oder `biome-ignore`, um fehlende Beweise zu
  umgehen.
- Keine übersprungenen oder gelöschten Tests ohne dokumentierte Begründung im
  zugehörigen Beads-Task.
- Keine unimplementierten Stubs, stillen leeren `catch`-Blöcke oder als Erfolg
  getarnten technischen Fehler.
- Keine Secrets in Quelltext, Tests, Logs oder GitHub-Step-Summaries.
- Keine Änderung an Produktionsverhalten, Datenbankschema, Native-Build-Lock
  oder Testabhängigkeiten für diese Spec.
- Kein abweichender oder doppelt gepflegter Jest-Testdatei-Scope.
- Keine automatische Entfernung oder Umwandlung von Markerbefunden.

## Verbindlicher App-Code-Scope

Als produktive App-Dateien gelten alle Laufzeitdateien mit der Endung `.ts`,
`.tsx`, `.js` oder `.jsx` unter `src/`.

- Plattformvarianten wie `.native`, `.ios` und `.android` sind eingeschlossen,
  sofern sie produktiven App-Code enthalten.
- Test- und Spec-Dateien (`*.test.*`, `*.spec.*`) sowie reine
  TypeScript-Deklarationen (`*.d.ts`) sind ausgeschlossen.
- Jede weitere Ausnahme muss im ausführbaren Policy-Code und in einem
  fokussierten Kontrakttest namentlich nachvollziehbar sein. Es gibt keine
  stillschweigende Sammelausnahme für `native`, `generated` oder ähnliche
  Verzeichnisnamen.
- Die Coverage-Eingabemenge muss alle Dateien dieses Scopes erfassen, auch
  wenn keine Testdatei sie importiert. Eine bloße Liste der tatsächlich
  ausgeführten Module reicht nicht.

## Verbindliche Metriken und Gates

| Dimension | Regel | Nachweis | Ausführungsort |
| --- | --- | --- | --- |
| Globale Coverage | Statements 70%, Branches 60%, Functions 65%, Lines 72% | bestehende Jest-`coverageThreshold.global`-Konfiguration | CI `Unit-Coverage` und lokaler Coverage-Lauf |
| Per-File-Coverage | Für jede produktive `src/`-Datei mindestens 70% Statements, Branches, Functions und Lines | Jest-Per-File-Threshold oder äquivalente zentrale Policy-Auswertung | CI `Unit-Coverage` und lokaler Coverage-Lauf |
| Scope-Vollständigkeit | Jede produktive Datei aus dem lokalen Scope erscheint in der Coverage-Eingabemenge | fokussierter Fixture-/Kontrakttest plus Coverage-Lauf | Task-Abnahme und CI |
| Testqualitätsreport | Discovery und Report-Erzeugung liefern einen reproduzierbaren Bericht; technische Fehler beenden den Job mit Fehler | `bash .codex/skills/analyzing-test-quality/scripts/calculate-metrics.sh` | eigener CI-Job und lokale Verifikation |
| Marker | `.only`, `.skip`, `fit`, `xit`, `fdescribe`, `xdescribe` werden gezählt und als report-only ausgewiesen | AST-Metrikreport und fokussierter AST-Test | eigener CI-Job und lokale Verifikation |
| Step Summary | Scope, Eingabedateien, Deklarationen, Marker und Heuristikgrenzen stehen in `GITHUB_STEP_SUMMARY` | Workflow-Kontrakttest und GitHub-Actions-Job | CI |
| Statische Gates | Keine TypeScript- oder Biome-Fehler | `bun run typecheck`, `bun run check` | Task-Abnahme und CI |

Die Per-File-Grenze darf nicht durch eine niedrigere globale Schwelle,
eine stillschweigende Datei-Ausnahme oder eine reine Report-Ausgabe erfüllt
werden. Ein technischer Discovery-, Parse- oder Reportfehler ist unabhängig
von Markerbefunden blockierend.

## CI-Governance

Der Testqualitätsjob wird in Version 1 ausgeführt und ist zunächst kein
required Branch-Protection-Check. Die Workflow-Änderung darf keine
Branch-Protection-Einstellung voraussetzen oder verändern. Eine spätere
Promotion zu einem required Check ist ein eigener Entscheid mit eigener
Spec-/Planänderung.

## Unabhängigkeit der Beads-Tasks

`fam-5yon.1` und `fam-5yon.2` müssen jeweils separat implementierbar,
prüfbar und abnehmbar sein. Kein Task darf Code, Konfiguration oder einen
grünen Lauf des anderen Tasks voraussetzen. Der bestehende Jest-Unit-Scope ist
ein gemeinsamer vorhandener Vertrag, aber keine neue Task-Abhängigkeit.

## Nachweis pro Beads-Task

Vor dem Schließen eines Tasks stehen im Beads-Task:

1. die fokussierten Tests und ihre Ergebnisse,
2. die Scope- und Floor-Prüfung,
3. die Ergebnisse von `bun run check` und `bun run typecheck`,
4. die fünf Reviewachsen Korrektheit, Lesbarkeit, Architektur, Sicherheit und
   Performance,
5. verbleibende Warnungen, insbesondere report-only Markerbefunde.

Diese lokale Constraint-Datei darf nicht geändert werden, um einen
fehlgeschlagenen Check grün erscheinen zu lassen. Eine Änderung der Schwelle,
der Scope-Definition oder des Blocking-/Non-Blocking-Status benötigt eine
neue explizite Entscheidung und eine Aktualisierung von Spec, Plan und Beads.
