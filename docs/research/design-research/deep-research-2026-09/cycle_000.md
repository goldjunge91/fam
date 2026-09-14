# Cycle 000: Wettbewerbslandschaft und wiederkehrende Inventar-Muster

## Forschungsfrage

Welche Inventar-Modelle und Interaktionen verwenden KitchenPal, Your Food, NoWaste, PantryVault und Zimmerfood? Welche Muster sind etabliert, und wo liegt ein glaubwürdiger Raum für Differenzierung?

## Befunde

| Produkt | Belegt durch die geprüfte Quelle | Relevanz für die Inventaransicht |
|---|---|---|
| KitchenPal | Zwei Ansichten: eine kategorisierte Single-Screen-Ansicht und eine Multi-Tab-Ansicht nach Lagerort. Sortierung nach Ablaufdatum, Kategorie, Name oder zuletzt hinzugefügt. Karten können per Drag-and-drop zwischen Lagerorten verschoben werden. [KitchenPal FAQ](https://kitchenpalapp.com/en/faqs/kitchen.html) | Lagerort bleibt ein starkes Organisationsmodell, wird aber als umschaltbare Perspektive behandelt. Ein einzelnes starres Modell ist nicht nötig. |
| Your Food | Eine lesbare Gesamtansicht, optionale Details wie Menge, Datum, Preis und Notiz, Ablauf-Erinnerungen, „use first“-Orientierung, Haushalts-Sharing und verbundene Bestands-/Einkaufslisten. [Your Food](https://yourfood.app/) | Reduktion auf wenige Pflichtinformationen ist ein wiederkehrendes Usability-Muster. Der Bestand wird als Haushaltssystem statt als reine Vorratsliste positioniert. |
| NoWaste | Sortierung nach Ablaufdatum, Name oder Kategorie, Filter nach Kategorie oder Lagerort, mehrere Listen, Kalender für Mindesthaltbarkeitsdaten, Batch-Use, Undo/Restore und KI-/Foto-/Receipt-Funktionen. [App Store](https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004) | Funktionsbreite ist hoch, erhöht aber die Gefahr, dass die tägliche Kernhandlung zwischen Verwaltungsfunktionen verschwindet. |
| PantryVault | „Use It First“ als tägliche Ansicht, Waste-Dashboard, „used or tossed“-Rückfrage, Low-Stock- und Expiring-Soon-Widgets, Batch-Use sowie Aktionen direkt im Widget. [App Store](https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad) | Der stärkste sichtbare Differenzierungsansatz liegt nicht in weiterer Datenerfassung, sondern in einer direkten Verbrauchsaktion. |
| Zimmer | Pantry als Überblick vor dem Einkauf, Mengen, Receipt-Import, gemeinsamer Pantry-Zustand und Anzeige, wer einen Eintrag hinzugefügt hat. Widgets bringen zentrale Aktionen auf Home- und Lock-Screen. [Zimmer Pantry](https://zimmerfood.com/), [Zimmer Sharing](https://zimmerfood.com/sharing/) | Der Bestand wird in einen gemeinsamen Haushaltskontext eingebettet. Attribution kann Konflikte und Rückfragen reduzieren. |

## Synthese

Der Markt konvergiert auf fünf Grundbausteine: Lagerorte, Ablaufdaten, Mengen, Filter/Sortierung und Verknüpfung mit Einkauf oder Rezepten. Innovation entsteht deshalb wahrscheinlich nicht durch einen weiteren Datentyp, sondern durch die Entscheidung, welche Handlung die Inventaransicht priorisiert.

Die deutlichste unbesetzte Position ist eine konsequente „Use-first“-Ansicht: nicht „Was ist wo gespeichert?“, sondern „Was ist die nächste sinnvolle Handlung?“. PantryVault belegt dieses Muster bereits als Produktfeature; eine eigene Ausprägung muss deshalb stärker durch Haushaltskontext, Vertrauenswürdigkeit und geringe kognitive Last differenzieren.

## Design-Hypothese

Die Standardansicht sollte eine handlungsorientierte Priorisierung anbieten und Lagerort als sekundäre Perspektive behalten:

1. Jetzt verwenden
2. Bald verwenden
3. Im Bestand

Ein Eintrag sollte mindestens Name, Menge und verständliche Frische-/Dringlichkeitsinformation zeigen. Lagerort, Kategorie und Detaildatum bleiben filter- oder detailfähig, müssen aber nicht die erste Entscheidung bestimmen.

## Grenzen

Die Quellen belegen Produktversprechen und veröffentlichte Funktionsbeschreibungen, nicht deren tatsächliche tägliche Nutzung oder Erfolgsquote. Screenshots wurden nicht systematisch visuell ausgewertet. Aussagen zu Zimmer sind wegen der offiziellen Produktseiten gut belegbar, die Android-Verfügbarkeit ist laut FAQ weiterhin nicht gegeben.

## Quellen

1. KitchenPal, „Kitchen Inventory & Storage FAQs“, https://kitchenpalapp.com/en/faqs/kitchen.html
2. Your Food, „No Waste Inventory“, https://yourfood.app/
3. NoWaste, „Food Inventory List“, Apple App Store, https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004
4. PantryVault, „PantryVault“, Apple App Store, https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad
5. Zimmer, „The meal-planning app“, https://zimmerfood.com/
6. Zimmer, „Sharing“, https://zimmerfood.com/sharing/
