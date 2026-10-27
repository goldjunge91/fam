# M5: Tatsächliche Feature-Queries nach Sync invalidieren

Priorität: Medium. Reihenfolge: Phase 4.
Maßgeblicher Bead: `fam-ninv`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M5 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Sync-Runner invalidiert [entity, householdId], während Plan-, Planentry- und Rezeptdetail-Queries andere Keys verwenden. Geöffnete Ansichten können trotz aktualisierter SQLite-Daten veraltet bleiben.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-ninv` | Tatsächliche Feature-Queries nach Sync invalidieren |


## Vorgehen

1. Die tatsächlich verwendeten Feature-Keys und abgeleiteten Bedarfsqueries am bestehenden Invalidation-Owner abbilden.
2. Vorhandene Query-Key-Owner verwenden, statt weitere parallele Key-Varianten einzuführen.
3. Pull und Realtime mit echtem QueryClient und geöffneten Verbrauchern prüfen.
4. Account-/Haushaltswechsel und nicht betroffene Queries gezielt mitprüfen.

## Dateiscope

- `src/lib/sync/sync-runner.ts`
- `src/lib/sync/sync-runner.test.ts`
- `bestehender Wochenplan-Query-Key-Owner falls Zusammenführung nötig`
- `bestehender Recipe-Query-Key-Owner falls Zusammenführung nötig`
- `gezielter Consumer-/QueryClient-Test`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- QueryClient-Nachweis für vorhandene nicht passende Keys vor und nach Korrektur.
- Gezielte Sync-Runner-, Wochenplan- und Rezeptdetail-/Needs-Tests.
- Account-/Haushaltswechsel und nicht betroffene Query-Gruppen bleiben korrekt.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-ninv`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Pull und Realtime invalidieren die tatsächlichen Plan-, Planentry-, Rezeptdetail- und abgeleiteten Needs-Queries.
- Geöffnete Konsumenten zeigen fremde Änderungen ohne Remount oder zusätzliche Nutzeraktion.
- Invalidierung bleibt am vorhandenen Owner und wird mit echten QueryClient-Keys statt ausschließlich gemockten Methodencalls geprüft.


## Grenzen und Entscheidungen

Kein zusätzlicher Cache, kein neuer Sync-Unterbau und keine vollständige Feature-Neustrukturierung.

Gemockte invalidateQueries-Aufrufe allein sind kein Abnahmenachweis; Daten müssen im tatsächlichen Konsumenten aktuell werden.
