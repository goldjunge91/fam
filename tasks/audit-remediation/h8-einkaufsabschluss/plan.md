# H8: Gesamten Einkaufsabschluss atomar speichern

Priorität: High. Reihenfolge: Phase 3.
Maßgeblicher Bead: `fam-o1f1`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H8 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Einzelne Transfers werden bereits vor späteren History-/Quell-Writes committed. Ein Fehler beim zweiten Transfer kann Teilbestand hinterlassen und ein Retry Duplikate erzeugen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-o1f1` | Gesamten Einkaufsabschluss atomar speichern |


## Vorgehen

1. Mengen, Packungsmaße und 1:1-Beziehung zwischen Quellen und Transfers vollständig vor dem ersten Write validieren.
2. Den vorhandenen exklusiven Transaktions-Owner für Bestand, Ledger, History, Quell-Tombstones und Outbox verwenden.
3. Quellen innerhalb der Verarbeitung prüfen, damit bereits verbrauchte Quellen bei Wiederholung oder Double-Tap keine neuen Zugänge erzeugen.
4. Optionale Feier-/Streak-Effekte vom Commit-Ergebnis trennen und echte SQLite-Rollbacks bei mehreren Fehlerpositionen nachweisen.

## Dateiscope

- `src/features/shopping-list/hooks/use-complete-shopping-run.ts`
- `src/features/shopping-list/hooks/use-complete-shopping-run.test.tsx`
- `src/lib/db/outbox.ts nur falls bestehender Builder nicht ausreicht`
- `gezielter lokaler SQLite-Integrationstest`
- `reiner Vorab-Validator im Feature nur falls sinnvoll`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Echte SQLite-Integration mit Fehler beim zweiten Transfer, History-Write und Quell-Tombstone; Tabellen/Outbox danach unverändert.
- Fall 1.0001 vor jedem Write abweisen; erfolgreicher Abschluss und Double-Tap/Retry.
- Vorhandene Transaktions-Builder wiederverwenden; kein neues Run-/Undo-/CAS-Framework.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-o1f1`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Vollständige Mengen-, Packungsmaß- und 1:1-Quell-/Transferprüfung findet vor dem ersten Write statt.
- Bestand, Ledger, History, Quell-Tombstones und Outbox werden als ein exklusiver lokaler Commit gespeichert; jeder injizierte Fehler rollt alles zurück.
- Wiederholte/gleichzeitige Verarbeitung derselben bereits verbrauchten Quellen erzeugt keine Duplikate; optionale Feier-/Streak-Effekte können einen Commit nicht nachträglich als fehlgeschlagen melden.


## Grenzen und Entscheidungen

Kein neues Shopping-Run-/Undo-/CAS-Framework und keine allgemeine Inventory-Migration.

Die bestehende lokale Persistenzgrenze verwenden. Tests müssen tatsächlichen Rollback belegen; getrennte SQL-/Outbox-Mocks genügen nicht.
