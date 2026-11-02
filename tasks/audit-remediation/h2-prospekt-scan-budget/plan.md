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

1. Die von GeoNames unterstützten PLZ aus der vorhandenen Scraper-Quelle deklarativ in der Datenbank verfügbar machen und vor dem Enqueue prüfen.
2. Neue Enqueues im bestehenden Owner atomar auf drei je Account und 25 global pro rollierenden 24 Stunden begrenzen. Deduplizierte offene oder frische Scans verbrauchen kein weiteres Budget.
3. Retry-Backoff beibehalten und nach drei automatischen Wiederholungen stoppen; ein erneuter Nutzerwunsch startet danach einen budgetpflichtigen Versuch.
4. Budgetereignisse privat halten, RLS und Rechte explizit setzen und Queue-Abrufe auf höchstens 25 Scans begrenzen.
5. Grenzüberschreitung und konkurrierende verschiedene PLZ prüfen: keine Queue-Zeile und kein net.http_post bei Ablehnung.

## Dateiscope

- `supabase/schemas/23_brochures.sql`
- `supabase/schemas/99_privileges.sql`
- `supabase/tests/33_brochure_scan_dispatch.test.sql`
- `supabase/tests/35_brochure_scan_budget.test.sql`
- `supabase/tests/36_brochure_scan_retries.test.sql`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor gezielten DB-/Dispatch-Nachweisen.

## Gezielte Verifikation

- Gezielte Queue-/Dispatch-/Budget-pgTAP-Fälle mit Fake-Dispatch.
- Gleichzeitige Anfragen verschiedener PLZ an der globalen Budgetgrenze.
- PLZ aus der GeoNames-Quelle in der Datenbank gegen gültige und ungültige Eingaben prüfen.
- Grenzwerte anhand Kapazität/Kosten festlegen; keine echten GitHub-Dispatches zur Verifikation.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-r4ec`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Unterstützte PLZ werden serverseitig geprüft. Unterschiedliche PLZ unterliegen atomaren Limits von drei Enqueues pro Account und 25 global je rollierenden 24 Stunden.
- Wiederholte bereits gebündelte Anfragen verbrauchen kein zweites Enqueue-Budget und erzeugen keinen zusätzlichen Dispatch.
- Bei ungültiger PLZ oder Limitüberschreitung entstehen weder Queue-Zeile noch net.http_post.
- Der Queue-Reader liefert höchstens 25 Scans; automatische Wiederholungen bleiben stündlich und enden nach drei Retries. Eine spätere Nutzeranfrage kann einen neuen budgetpflichtigen Versuch starten.
- Die Budgetdaten sind per RLS aktiviert und für App- sowie Service-Rollen nicht direkt lesbar oder beschreibbar.


## Grenzen und Entscheidungen

Keine echten GitHub-Dispatches als Test. Die GeoNames-Datei ist die Quelle für die serverseitige PLZ-Liste im bestehenden Brochure-Schema.

Die Startlimits sind bewusst konservativ: drei neue PLZ pro Account und 25 neue Enqueues global innerhalb von 24 Stunden.
