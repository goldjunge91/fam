# H1: AI-Gateway an Abo und Credits binden

Priorität: High. Reihenfolge: Phase 1 und 2.
Maßgeblicher Bead: `fam-koxq`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Gateway prüft Auth und Mitgliedschaft, ruft den Provider aber ohne AI-Abo-Prüfung oder Credit-Buchung auf. Der globale Isolate-Limiter setzt kein dauerhaftes Nutzer- oder Monatsbudget durch.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-koxq.1` | AI-Credit-Buchungen bei Parallelität strikt begrenzen |
| 2 | `fam-koxq.2` | AI-Gateway vor Provider-Aufrufen autorisieren und Credits buchen |


## Vorgehen

1. In fam-koxq.1 den bestehenden Subscriber-Credit-Owner gegen konkurrierende Buchungen und doppelte Request-IDs absichern.
2. Die zwei Gateway-Skills bestehenden Credit-Aktionen zuordnen und die Fehlerabbuchung ausdrücklich festlegen.
3. In fam-koxq.2 den Gateway erst nach Mitgliedschaft, verifiziertem gültigem AI-Status und atomarer Buchung den Provider aufrufen lassen.
4. Unbezahlte, abgelaufene, fremde und erschöpfte Fälle bis zur Provider-Grenze prüfen; sie erzeugen null Provider-Aufrufe.

## Dateiscope

- `supabase/schemas/03_households.sql`
- `supabase/tests/20_ai_fair_use.test.sql`
- `gezielter lokaler Parallelitätstest im vorhandenen Integrationstest-Owner`
- `supabase/functions/ai-gateway/handler.ts`
- `supabase/functions/ai-gateway/index.ts`
- `supabase/functions/ai-gateway/handler_test.ts`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor DB-Nachweisen der Credit-Buchung.
- [M8: Abo-Zugriff bei verlorenen Ablaufereignissen begrenzen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/m8-abo-gueltigkeit/plan.md): Vor der Gateway-Integration des gültigen Abo-Status.

## Gezielte Verifikation

- Gezielte pgTAP-Datei 20_ai_fair_use.test.sql.
- Gezielter echter Parallelitätsnachweis gegen freigegebene lokale Testinstanz.
- Generierte Migration prüfen und bun run db:types erfolgreich ausführen.
- Gezielte Deno-Handler-Tests inklusive Membership-, Abo-, Budget- und Parallelitätsgrenzen.
- Deno fmt/lint/check für die berührten Function-Dateien.
- Provider und Entitlements in Tests injizieren; keine echten kostenpflichtigen Requests.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-koxq`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Credit-Parallelität ist in fam-koxq.1 korrekt begrenzt und geprüft.
- Gateway erzwingt Mitgliedschaft, gültiges AI-Entitlement und erfolgreiche Credit-Buchung gemäß fam-koxq.2 vor Kostenentstehung.
- Abo-/Credit-Semantik einschließlich Request-ID, Skill-Aktion und Fehlerabbuchung ist vor Verdrahtung festgelegt; beide Teilaufgaben sind nachgewiesen.


## Grenzen und Entscheidungen

Kein neuer allgemeiner Billing-Unterbau. Provider-Aufrufe in Tests injizieren, keine echten kostenpflichtigen Requests.

Aktionsmapping und Abbuchung bei Providerfehlern vor der Verdrahtung bestätigen; bestehende Limits und Gewichte sind Ausgangspunkt.
