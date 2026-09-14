# Cycle 008: Tiefe Lebensmittel-Inventare

## Pantry Check

Pantry Check beschreibt mehrere eigenständige Flächen: Inventar, Artikeldetail, Barcode-Scanner, Einkaufslisten, ablaufende Artikel und eine Timeline. Besonders relevant ist der Verbrauchsfluss: „Finish“ entfernt einen Artikel aus dem aktiven Bestand und legt ihn in die Timeline; bei angebrochenen Produkten kann die Menge angepasst werden. Die App beschreibt außerdem eine automatisch generierte Einkaufsliste, Restock-Vorschläge, geschätzte Preise und ein laufendes Einkaufstotal. Quellen: [Overview](https://pantrycheck.com/kb/overview/) und [Produktseite](https://pantrycheck.com/).

**Übertragbares Muster:** Bestand ist nicht nur eine Liste. Es gibt eine klare Trennung zwischen aktivem Bestand, ablaufenden Artikeln und Verlauf.

**Risiko:** Automatisch geschätzte Preise und Datumswerte können präzise wirken, obwohl sie nur Näherungen sind.

## FoodShiner

FoodShiner verbindet Fridge, Freezer und Pantry mit Mengen und Ablaufdaten. Die „Smart lists“ sammeln laut Produktseite bald ablaufende Produkte und geöffnete Packungen. Ein Artikel kann aus dem Bestand in eine Einkaufsliste überführt werden; zusätzlich werden Widgets, Apple-Watch-Zugriff, CloudKit-Sync, Such- und Kontextaktionen beschrieben. Quelle: [FoodShiner](https://foodshiner.app/en/index.html).

**Übertragbares Muster:** „Bald leer“ und „bald schlecht“ sind zwei verschiedene Handlungsgründe. Beide können in einer fokussierten Smart List landen.

**Risiko:** Mehrere Smart Lists können die Startansicht fragmentieren, wenn sie nicht zu einer verständlichen Tagespriorität zusammengeführt werden.

## Fridgely

Fridgely positioniert sich als Ablaufdaten-Tracker mit Räumen wie Kühlschrank, Vorrat und Gefrierschrank. Die Produktseite nennt Ablaufwarnungen, gemeinsame Bearbeitung, geräteübergreifende Synchronisation, Rezeptvorschläge aus dem Bestand, Barcode-Erkennung und geschätzte Ablaufdaten. Quelle: [Fridgely](https://www.fridgelyapp.com/).

**Übertragbares Muster:** Lagerorte sind eine stabile mentale Struktur. Sie machen den Bestand beim Öffnen des Kühlschranks oder Vorratsschranks auffindbar.

**Risiko:** Eine aus Barcode-Daten geschätzte Haltbarkeit darf nicht wie ein aufgedrucktes Datum erscheinen. Diese Unterscheidung gehört in die Detailansicht und in den Prioritätsgrund.

## Grocy

Grocy ist eine webbasierte, selbst gehostete Haushaltslösung. Sie verbindet Mindestbestände, Einkaufsliste, Lagerbestand, Rezepte, Meal-Plan und Verbrauch. Rezepte können Bestand verbrauchen und fehlende Zutaten zur Einkaufsliste hinzufügen. Ein „Due Score“ priorisiert Rezepte, die bald fällige oder bereits überfällige Vorräte aufbrauchen. Der Bestand kann zwischen Lagerorten verschoben werden; dabei kann sich der Frischekontext ändern. Quellen: [Grocy](https://grocy.info/), [Food-Dokumentation](https://github.com/grocy/grocy-docs/blob/master/tutorials/food.md) und [Cooking-Dokumentation](https://github.com/grocy/grocy-docs/blob/master/tutorials/cooking.md).

**Übertragbares Muster:** Ein Bestand wird wertvoll, wenn andere Aktionen ihn zuverlässig verändern. Besonders stark ist die Verbindung „Rezept kochen → definierte Mengen verbrauchen“.

**Risiko:** Der Due Score ist als interne Berechnung nützlich, aber als primäre UI-Erklärung zu undurchsichtig. Fam sollte den konkreten Grund zeigen, nicht nur einen Wert.

## Pantri

Pantri beschreibt drei Bestandsstufen: „low“, „half“ und „full“, ergänzt um ein Ablaufzeitfenster. Die Produktseite nennt Beleg-OCR, Echtzeit-Synchronisation, automatisch nach Gängen sortierte Einkaufslisten, Ausgabenhistorie und Offline-first-Synchronisation. Quelle: [Pantri](https://pantri.devalab.app/).

**Übertragbares Muster:** Für Haushalte ist eine grobe Bestandsstufe bei Verbrauchsartikeln oft schneller pflegbar als eine exakte Stückzahl.

**Risiko:** „Half“ kann für Milch, Reis, Gewürze und lose Lebensmittel völlig Unterschiedliches bedeuten. Grobe Stufen eignen sich als schnelle Eingabe, nicht als einzige kanonische Mengenrepräsentation.

## Verdichtete Design-Learnings

| Problem | Starke Lösung aus dem Markt | Konsequenz für Fam |
|---|---|---|
| Was muss als Nächstes passieren? | Smart Lists, Expiring Items, Due Score | Eine Use-first-Ebene mit erklärbarem Grund |
| Was ist wirklich noch da? | Räume, Lagerorte, Stock Levels | Ort und Menge gemeinsam scanbar machen |
| Wie bleibt der Bestand aktuell? | Finish, Teilmenge, Rezeptverbrauch | Verbrauch als schnelle, reversible Aktion |
| Was soll nach dem Aufbrauchen passieren? | Restock, Mindestbestand, Liste | Bestand und Einkauf als getrennte, verbundene Zustände |
| Wie bleibt Vertrauen erhalten? | Timeline, offene Packung, Datumsquelle | Quelle und Unsicherheit sichtbar markieren |

