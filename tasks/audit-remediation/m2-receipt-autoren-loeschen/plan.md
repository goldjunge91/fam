# M2: Account-Löschung für Receipt-Autoren ermöglichen

Priorität: Medium. Reihenfolge: Phase 3.
Maßgeblicher Bead: `fam-i0om`. Umsetzungsstatus ausschließlich in Beads.
Ausgangsbasis: Audit `fam-aen4` vom 27. Oktober 2026.
Dieser Einzelplan ersetzt für M2 den entsprechenden Abschnitt des bisherigen Gesamtplans.

[Übersicht](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/plan.md) · [Gemeinsamer Arbeitsrahmen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/workflow.md) · [Auditbericht](/Volumes/Programme/github/family_app/fam/reports/code-security-review-2026-10-27.md)

## Problem und Ziel

Receipt- und Asset-Autorenschaft verwenden ON DELETE RESTRICT. Ein Autor kann sein Konto nicht löschen, wenn seine Bons in einem erhalten bleibenden Haushalt liegen; ein Trigger verhindert einfaches Umschreiben.


## Eigener Task und begrenzte Umsetzungspakete

| Reihenfolge | Bead | Verantwortung |
| --- | --- | --- |
| 1 | `fam-i0om` | Account-Löschung für Receipt-Autoren ermöglichen |


## Vorgehen

1. Die fachliche Empfehlung nullable created_by mit ON DELETE SET NULL bestätigen und im Domänenvertrag festhalten.
2. Das deklarative Schema so ändern, dass alte Autorenschaft bei Account-Löschung entfernt wird, neue Client-Receipts aber weiter den eigenen Autor verlangen.
3. Den tatsächlichen Admin-Auth-Löschpfad unter realistischen Claims testen und willkürliche Client-Umschreibung weiterhin abweisen.
4. Generierte Typen, bereits nullable SQLite-Spalte, Pull/Realtime und Receipt-History-Konsumenten für entfernte Autorenschaft nachweisen.

## Dateiscope

- `CONTEXT.md nach fachlicher Bestätigung`
- `supabase/schemas/26_receipts.sql`
- `supabase/tests/26_receipts.test.sql`
- `supabase/tests/03_households.test.sql oder vorhandener Account-Delete-Test`
- `src/features/ocr/authority/api.test.ts falls NULL-Konsument abgesichert werden muss`


## Abhängigkeiten

- [H10: DB-Teststarter ohne automatischen Reset ausführen](/Volumes/Programme/github/family_app/fam/tasks/audit-remediation/h10-db-testguard/plan.md): Vor gezielten DB-Lösch- und Rechteprüfungen.

## Gezielte Verifikation

- Löschung als tatsächlicher Admin-Auth-Delete-Pfad unter realistischen JWT-Claims testen; bestehender Immutable-Actor-Trigger bleibt wirksam.
- Lokaler Mirror-/Pull-Nachweis und gezielte OCR-History-/API-Tests.
- Nur Schema ändern, Migration generieren, genehmigten lokalen Reset/Typgenerator ausführen; keine manuelle Migration/Typänderung.


## Abnahme

Die verbindlichen Akzeptanzkriterien und die tatsächlichen Nachweise besitzt
`fam-i0om`. Der vorgesehene fachliche Abnahmerahmen lautet:

- Ein Receipt-Autor kann sein Konto in gemeinsamem und bereits verlassenem Haushalt löschen; Bon, Positionen und Assets bleiben fachlich erhalten.
- Empfohlen ist nach Freigabe nullable created_by mit ON DELETE SET NULL; neue Client-Datensätze benötigen weiter den eigenen Autor und beliebige Client-Umschreibung bleibt verboten.
- Generierte DB-Typen, bereits nullable lokale Receipt-Spalte, Pull/Realtime und History-Konsumenten verarbeiten entfernte Autorenschaft korrekt.


## Grenzen und Entscheidungen

Kein verbleibendes Mitglied nachträglich zum vermeintlichen ursprünglichen Autor machen und keine Haushaltsbons löschen.

Die nullable Autorenschaft braucht fachliche Freigabe. Trigger-Verhalten und Admin-JWT-Kontext werden vor Umsetzung geprüft.
