# M3: Demotion des einzigen Haushaltsadmins verhindern

Priorität: Medium. Reihenfolge: Phase 1.
Maßgeblicher Bead: `fam-1tju`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M3 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der Last-Admin-Guard erlaubt remaining = 0 auch bei einer Rollenänderung. Dadurch kann ein bewohnter Solo-Haushalt ohne Admin zurückbleiben.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-1tju` | Demotion des einzigen Haushaltsadmins verhindern |


## Vorgehen

1. Solo-Demotion getrennt vom erlaubten Solo-Austritt nachweisen.
2. Die Ausnahme auf einen tatsächlich durch DELETE leer werdenden Haushalt begrenzen.
3. Legitimen Admin-Wechsel, zwei Admins, Mitglieder und Household-Cascade prüfen.
4. Konkurrierende Rollenänderungen gezielt prüfen und nötige Serialisierung im bestehenden Household-Guard halten.

## Dateiscope

- `supabase/schemas/03_households.sql`
- `supabase/tests/03_households.test.sql`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor den gezielten Household-pgTAP-Fällen.

## Gezielte Verifikation

- Gezielte pgTAP-Fälle Solo-Demotion, Solo-Austritt, zwei Admins, Mitglied und Cascade.
- Bei notwendiger Sperre echter begrenzter Konkurrenznachweis.
- Generierte Migration/Typen und bestehende Household-Suite.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-1tju`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Ein alleiniger Admin kann sich nicht zum Mitglied degradieren; jeder verbleibende bewohnte Haushalt besitzt einen Admin.
- Der letzte Nutzer darf den Haushalt weiterhin durch Austritt leeren; legitimer Admin-Wechsel und Haushalts-Cascade bleiben möglich.
- Konkurrierende Rollenänderungen sind geprüft; erforderliche Serialisierung gehört zum bestehenden Household-Guard.


## Grenzen und Entscheidungen

Kein allgemeiner Rollenumbau und keine neue Auth-Zustandsmaschine.

CONTEXT.md bleibt maßgeblich: Jeder nicht leere Haushalt benötigt mindestens einen Admin.
