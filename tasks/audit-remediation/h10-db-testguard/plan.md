# H10: DB-Teststarter ohne automatischen Reset ausführen

Priorität: High. Reihenfolge: Phase 0.
Maßgeblicher Bead: `fam-0mww`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H10 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Der aktuelle DB-Teststarter setzt eine als benutzt erkannte Datenbank ungefragt zurück. Der Guard wählt zudem den ersten Container mit einem allgemeinen Supabase-Präfix.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-0mww` | DB-Teststarter ohne automatischen Reset ausführen |


## Vorgehen

1. Guard standardmäßig nur prüfen lassen und bei Daten außerhalb der Testtransaktionen mit einer verständlichen Meldung abbrechen.
2. Die lokale Projektinstanz eindeutig auswählen und fremde Projekte ausschließen.
3. Dateiparameter des Teststarters tatsächlich als ausschließliche Auswahl weiterreichen; notwendige CI-Aufrufe kompatibel anpassen.
4. Mit Fake-Docker/Fake-Supabase sauber, dirty, fehlende Instanz, mehrere Projekte und Dateiauswahl nachweisen.

## Dateiscope

- `scripts/check-clean-db.sh`
- `package.json`
- `gezielter Shell-Guard-Test`
- `CI-Aufruf nur falls das Dateiauswahlverhalten angepasst werden muss`


## Abhängigkeiten

Keine fachliche Vorbedingung aus einem anderen Problemplan. Gemeinsame Dateigrenzen und Betriebsfreigaben bleiben zu beachten.

## Gezielte Verifikation

- Shell-Test mit Fake-Docker/Fake-Supabase für sauber, dirty, keine Instanz und mehrere Projekte.
- Gezielter lokaler pgTAP-Lauf nach check-only und Sauberkeitsprüfung danach.
- Kein echter db reset als Test der Schutzfunktion.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-0mww`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Guard und lokaler DB-Teststart löschen niemals selbstständig Daten; Dirty-Zustand beendet mit verständlicher Fehlermeldung.
- Es wird eindeutig die lokale Projektinstanz ausgewählt; fremde Projekte werden nicht geprüft oder zurückgesetzt.
- Angegebene Testdateien werden unverändert und ausschließlich ausgeführt; bestehende CI-Aufrufe sind bewusst kompatibel angepasst.


## Grenzen und Entscheidungen

Kein echter DB-Reset zum Testen der Schutzfunktion und keine Änderungen an laufenden Entwicklerdiensten.

Ein nötiger lokaler Reset bleibt eine ausdrückliche separate Handlung.
