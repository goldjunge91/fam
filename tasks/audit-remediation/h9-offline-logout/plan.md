# H9: Offline-Änderungen beim manuellen Logout erhalten

Priorität: High. Reihenfolge: Phase 3.
Maßgeblicher Bead: `fam-ncux`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H9 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die normale Abmeldung stoppt den Sync und löscht die lokale Datenbank mit noch ungesicherten Outbox-Einträgen. Nach der Rückkehr kann der Server diese Änderungen nicht wiederherstellen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-ncux` | Offline-Änderungen beim manuellen Logout erhalten |


## Vorgehen

1. Vor der destruktiven manuellen Abmeldung ausstehende und terminal fehlgeschlagene lokale Writes prüfen.
2. Laufende Mutationen und neue Writes während des abschließenden Checks berücksichtigen; bei ungesicherten Daten Session, DB und Keys erhalten.
3. Den bestehenden verständlichen Fehlerpfad verwenden und nach erfolgreichem Sync die normale Abmeldung zulassen.
4. Offline-Write, abgewiesenen Logout, Datenerhalt, Sync und erfolgreichen Logout zusammen mit Account-Isolation nachweisen.

## Dateiscope

- `src/features/auth/sign-out.ts`
- `src/features/auth/sign-out.test.ts`
- `vorhandener Outbox-Read-Owner nur soweit erforderlich`
- `src/features/settings/settings-screen.tsx falls bestehender Fehlerpfad nicht genügt`
- `betroffener Android-Settings-Pfad/Test nur bei tatsächlichem Unterschied`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Offline-Write → Logoutversuch → Daten/Outbox/Session erhalten → Sync → erfolgreicher Logout.
- Test mit terminal fehlgeschlagenem Outbox-Eintrag und leerer Outbox.
- Bei neuem Verwerfen-Dialog oder größerer Copy-/Layoutänderung vorher Marcos UI-/Mock-Entscheidung einholen.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-ncux`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Manueller Logout mit ausstehenden oder terminal fehlgeschlagenen lokalen Writes beendet die Session und löscht DB/Keys nicht unbemerkt.
- Kleinste erste Lösung blockiert die Abmeldung mit bestehendem verständlichem Fehlerpfad und ermöglicht nach erfolgreichem Sync den normalen Logout.
- Normaler Cleanup, Account-Isolation, doppelte Logout-Aufrufe und automatische Auth-Ereignisse bleiben geprüft; keine neue Konto-DB-Archivierung in diesem Slice.


## Grenzen und Entscheidungen

Keine neue Account-Archivierung in diesem Slice. Ein neuer Verwerfen-Dialog wird nicht als Voraussetzung eingeführt.

Empfohlener Standard ist blockieren statt unbemerkt verwerfen. Falls ein neuer Dialog oder größere Copy nötig wird, vorher Marcos UI-/Mock-Entscheidung einholen.
