# H4: Kind-Profil-Löschung nach Haushaltsaustritt sperren

Priorität: High. Reihenfolge: Phase 1.
Maßgeblicher Bead: `fam-qdjx`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für H4 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Nach dem Haushaltsaustritt kann managed_by weiter auf den ehemaligen Manager zeigen. Die DELETE-Policy verlangt für diesen Fall keine aktuelle Mitgliedschaft.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-qdjx` | Kind-Profil-Löschung nach Haushaltsaustritt sperren |


## Vorgehen

1. Den Fehler mit einem ehemaligen Manager und DELETE ohne WHERE/RETURNING im bestehenden pgTAP-Owner belegen.
2. Die DELETE-Berechtigung an aktuelle Mitgliedschaft und daran anschließend Manager-/Admin-Recht binden.
3. Positive Manager-/Admin-Fälle und Außenstehende prüfen.
4. Nach der abgewiesenen Löschung Existenz des Kind-Profils und seiner Trackingdaten prüfen.

## Dateiscope

- `supabase/schemas/07_child_profiles.sql`
- `supabase/tests/06_child_profiles.test.sql`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor gezielten pgTAP-Nachweisen.

## Gezielte Verifikation

- pgTAP-Szenario Mitgliedschaft entfernen → ehemalige Rolle → DELETE ohne WHERE/RETURNING → Existenz-/Trackingprüfung.
- Positive Manager-/Admin-Fälle und Outsider-Fälle.
- Schemaänderung generieren und lokale Typen erfolgreich erzeugen.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-qdjx`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Nach Haushaltsaustritt erlaubt weder verbliebenes managed_by noch ungefiltertes DELETE die Löschung des ehemaligen Haushaltsprofils.
- Manager/Admin mit aktueller Mitgliedschaft behalten ihre fachlich erlaubten Aktionen; fremde Accounts bleiben ausgeschlossen.
- Kind-Profile und verknüpfte Trackingdaten bleiben im Abweisungsfall vollständig erhalten.


## Grenzen und Entscheidungen

Keine Erweiterung der Sichtbarkeit privater Erwachsenendaten und kein allgemeiner Rollenumbau.

Der konkrete DELETE-Pfad wird vor dem Fix belegt; ein technischer Gegenbeleg würde im Bead dokumentiert.
