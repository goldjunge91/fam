# Chef-Koch-History gehört dem Haushalt

## Status

Akzeptiert

## Datum

2026-11-07

## Kontext

Chef-Koch erzeugt sichtbare Unterhaltungen und Rezeptvorschläge, die alle
Mitglieder eines Haushalts später lesen können sollen. Die Inhalte müssen nach
einem Gerätewechsel weiterhin verfügbar sein und dürfen nicht vom Fortbestand
des erstellenden Accounts, des damaligen Inventars oder eines Quellrezepts
abhängen.

Für die Aufbewahrung wurden eine feste Lebensdauer am Haushalt und eine
individuelle Lösch- oder Archivfunktion betrachtet. Zusätzlich war zu klären,
ob jede Mahlzeit oder jede vollständige Chef-Koch-Antwort einen eigenen
Rezept-History-Eintrag bildet.

## Entscheidung

Chef-Koch-Conversations, ihre sichtbaren Nutzer- und Chef-Koch-Nachrichten und
die Rezept-History gehören dem Haushalt. Alle aktuellen Mitglieder dürfen sie
über die Haushaltmitgliedschaft und RLS lesen.

Die History bleibt erhalten, bis der Haushalt gelöscht wird. Dann entfernt die
Haushaltskaskade Conversations, Turns und Rezept-History. Das Löschen eines
Accounts setzt nur persönliche Autor-Referenzen auf `NULL`; die Inhalte bleiben
für den Haushalt bestehen.

Eine erfolgreiche Chef-Koch-Antwort mit validierten Rezeptdaten erzeugt genau
einen Rezept-History-Snapshot. Dieser Snapshot enthält alle Mahlzeiten der
Antwort sowie die damals aufgelösten Inventarangaben. Er verweist nicht
verbindlich auf aktuelles Inventar oder ein später veränderbares Rezept.

Es gibt für diesen Funktionsumfang keine manuelle Löschung, Archivierung,
Wiederherstellung oder zeitgesteuerte Entfernung. Die 48-Stunden-Grenze steuert
nur, ob aus einer Unterhaltung eine neue Unterhaltung fortgesetzt werden darf.
Sie begrenzt nicht die Lesbarkeit oder Aufbewahrung.

## Alternativen

### Individuelle Löschung oder Archivierung

Verworfen. Dafür wären zusätzliche Haushaltsregeln, Reverse States, Sync-
Operationen und Konfliktbehandlung nötig. Der bestätigte Produktumfang verlangt
diese Bedienung nicht.

### Ein Rezept-History-Eintrag pro Mahlzeit

Verworfen. Eine Chef-Koch-Antwort ist die fachliche Einheit, die später wieder
geöffnet wird. Ein gemeinsamer Snapshot erhält die Antwort unverändert und
vermeidet künstliche Einzelverläufe für zusammengehörige Vorschläge.

### Aufbewahrung nur für 48 Stunden

Verworfen. Die Zeitgrenze schützt ausschließlich den Fortsetzungspfad. Alte
Unterhaltungen und Rezeptvorschläge bleiben als Haushalt-History lesbar.

## Folgen

- Der Server ist Eigentümer der History-Schreibvorgänge; Mobile-Clients lesen
  die RLS-geschützten Daten aus dem lokalen SQLite-Spiegel.
- Autor-IDs sind optionale Audit-Herkunft und keine Eigentumsgrenze.
- History-Tabellen besitzen keinen manuellen Delete-, Archive- oder Restore-
  Vertrag.
- Rezept-History speichert validierte Antwortdaten und Inventar-Snapshots,
  keine internen Systemnachrichten, Provider-Rohdaten oder Prompt-Kontexte.
- Eine Fortsetzung erhält eine neue Conversation-ID und einen Parent-Link. Die
  Quellunterhaltung bleibt unverändert.
