# L1: Session-Fragment auf der Bestätigungsseite entfernen

Priorität: Low. Reihenfolge: Phase 4.
Maßgeblicher Bead: `fam-9qox`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für L1 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Die statische Bestätigungsseite liest ein mögliches Session-Fragment, benötigt die Tokens aber nicht und lässt es in der sichtbaren URL stehen.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-9qox` | Session-Fragment auf der Bestätigungsseite entfernen |


## Vorgehen

1. Das Fragment unmittelbar nach dem lokalen Auslesen mit history.replaceState aus der sichtbaren URL entfernen.
2. Erfolgs- und Fehlerdarstellung einschließlich fehlerhafter Links erhalten.
3. Den Verlaufseffekt mit künstlichen Token-Platzhaltern prüfen und die Function gezielt linten/typprüfen.

## Dateiscope

- `supabase/functions/auth-confirmed/index.ts`
- `fokussierter Fragment-/Response-Test`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Test mit simuliertem history.replaceState und Erfolgs-/Fehlerfragment.
- Deno-Lint/Typprüfung der betroffenen Function.
- Keine echten Bestätigungslinks oder Tokens als Fixture.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-9qox`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Das Fragment wird sofort nach Auswertung aus der sichtbaren URL entfernt, auch im Fehlerfall.
- Erfolgs-/Fehlerdarstellung funktioniert weiter; Tokens werden weder versandt, geloggt noch in der Seite gerendert.
- Die statische Bestätigungsseite bleibt ohne neue Session-Verantwortung oder externe Skripte.


## Grenzen und Entscheidungen

Keine echte Session einlösen, keine Tokens versenden/loggen und keine externen Skripte hinzufügen.

Die Seite bleibt rein informierend; ein größerer Bestätigungsflow-Umbau ist kein Teil dieses Fixes.
