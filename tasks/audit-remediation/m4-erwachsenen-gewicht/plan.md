# M4: Erwachsenengewicht von Kind-Einträgen trennen

Priorität: Medium. Reihenfolge: Phase 4.
Maßgeblicher Bead: `fam-vyb2`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M4 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die Latest-Weight-Abfrage filtert nur die verwaltende User-ID. Ein neuerer Kind-Eintrag kann deshalb mit den Stammdaten des Erwachsenen in dessen Zielberechnung eingehen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-vyb2` | Erwachsenengewicht von Kind-Einträgen trennen |


## Vorgehen

1. In der Latest-Weight-Abfrage für Erwachsene child_profile_id IS NULL analog zur bestehenden History-Abfrage erzwingen.
2. Gemischte Einträge desselben Accounts mit neuerem Kind-Gewicht testen.
3. GoalSetup mit vorhandenem Erwachsenengewicht und ohne Erwachsenengewicht prüfen.

## Dateiscope

- `src/features/calorie-tracking/api.ts`
- `src/features/calorie-tracking/api.test.ts`
- `src/features/calorie-tracking/goal-setup-screen.test.tsx`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Gemischte zeitliche Reihenfolge in API-Test.
- GoalSetup-Test mit Erwachsenenprofil und neuerem Kind-Gewicht.
- Gezielte benachbarte Tracking-/History-Tests.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-vyb2`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Latest-Weight für den Erwachsenen enthält immer child_profile_id IS NULL.
- Ein neuerer Kind-Eintrag desselben Accounts verändert die Erwachsenen-Zielberechnung nicht; bei fehlendem Erwachsenengewicht bleibt der korrekte Eingabepfad aktiv.
- Erwachsenen-/Kind-Abfragen und Account-Query-Keys bleiben voneinander getrennt.


## Grenzen und Entscheidungen

Keine Änderung der BMR-Formeln, Ziele oder des gesamten Kind-Tracking-Modells.

Erwachsenen- und Kind-Abfragen behalten getrennte fachliche Scopes und Query-Keys.
