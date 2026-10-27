# H2: Prospekt-Scan-Dispatch begrenzen

Priorität: High. Reihenfolge: Phase 1.
Maßgeblicher Bead: `fam-r4ec`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H2 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Jede neue fünfstellige Zeichenfolge kann eine Queue-Zeile und einen GitHub-Workflow-Dispatch auslösen. Die aktuelle Concurrency begrenzt nur dieselbe PLZ.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-r4ec` | Prospekt-Scan-Dispatch begrenzen |


## Vorgehen

1. Die Budgetentscheidung im bestehenden Scan-Enqueue-Owner verankern und private dauerhafte Nutzer- und Globalgrenzen festlegen.
2. Budget, Deduplizierung und Queue-Erzeugung atomar ausführen; gebündelte Requests verbrauchen nicht erneut das Enqueue-Budget.
3. Neue Budgettabellen mit expliziten Rechten/RLS und pgTAP-Nachweisen ausstatten.
4. Grenzüberschreitung und konkurrierende verschiedene PLZ prüfen: keine Queue-Zeile und kein net.http_post bei Ablehnung.

## Dateiscope

- `supabase/schemas/23_brochures.sql`
- `supabase/schemas/20_privileges.sql falls erforderlich`
- `supabase/tests/33_brochure_scan_dispatch.test.sql`
- `gezielter Budget-/Parallelitätstest`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor gezielten DB-/Dispatch-Nachweisen.

## Gezielte Verifikation

- Gezielte Queue-/Dispatch-/Budget-pgTAP-Fälle mit Fake-Dispatch.
- Parallelitätsfall für mehrere neue PLZ an der Budgetgrenze.
- Grenzwerte anhand Kapazität/Kosten festlegen; keine echten GitHub-Dispatches zur Verifikation.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-r4ec`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Unterschiedliche PLZ unterliegen atomaren persistenten Nutzer- und Globalbudgets; neue Budgettabellen haben explizite Rechte/RLS und pgTAP-Nachweise.
- Wiederholte bereits gebündelte Anfragen verbrauchen kein zweites Enqueue-Budget und erzeugen keinen zusätzlichen Dispatch.
- Bei Limitüberschreitung entstehen weder Queue-Zeile noch net.http_post; normale Anfragen und Retry-Backoff bleiben korrekt.


## Grenzen und Entscheidungen

Kein neuer PLZ-Katalog für den ersten Fix und keine echten GitHub-Dispatches als Test.

Konkrete Nutzer-/Globalbudgets anhand vorhandener Kapazität und Kosten bestätigen.
