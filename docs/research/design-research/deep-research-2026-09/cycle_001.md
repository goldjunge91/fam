# Cycle 001: Informationsarchitektur für den täglichen Inventarblick

## Forschungsfrage

Welche Inventaransichten helfen beim nächsten Verbrauchsschritt schneller als eine statische Liste nach Lagerort oder Kategorie?

## Beobachtete Muster

### 1. Dynamische Dringlichkeitsliste

EatFirst beschreibt eine selbstsortierende Liste, bei der der früheste relevante Zeitpunkt oben steht. Jeder Eintrag zeigt neben dem Produkt auch Ort, Datumsart und verbleibende Zeit. [EatFirst](https://eatfirst.app/)

Foodminder verwendet eine „Use soon“-Sektion mit wenigen sichtbaren Einträgen, inklusive Lagerort und „heute / in x Tagen“. Die Seite verbindet diese Liste mit einer konkreten Abendessen-Idee. [Foodminder](https://www.foodminder.app/)

ok2eat geht noch weiter und beschreibt eine vollständige „Eat Me First“-Ansicht, in der das dringendste Produkt oben steht und ein Tap passende Rezeptideen liefert. [ok2eat](https://ok2eat.com/)

### 2. Fokusmodus statt alleiniger Inventaransicht

Celier trennt die Küchenübersicht von einer „Plate“-Ansicht. Die Übersicht zeigt den Bestand nach Dringlichkeit; die Plate-Ansicht reduziert die Entscheidung auf eine Rezeptidee und unterstützt Save/Skip per Swipe. [Celier](https://www.celier.app/)

Das ist ein wichtiges Gegenargument gegen eine reine „Alles nach Ablaufdatum“-Ansicht: Ein vollständiger Bestand braucht Suche, Filter und Lagerorte. Die tägliche Verbrauchsentscheidung darf dagegen fokussiert und klein sein.

### 3. Verwaltungs- und Suchperspektive

KitchenPal unterstützt sowohl eine kategorisierte Gesamtansicht als auch Lagerort-Tabs, Sortierung und Drag-and-drop. NoWaste ergänzt Kategorie-/Lagerortfilter, Kalender und Batch-Use. [KitchenPal FAQ](https://kitchenpalapp.com/en/faqs/kitchen.html), [NoWaste App Store](https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004)

Diese Muster sind für Pflege und Wiederfinden sinnvoll, aber sie beantworten nicht automatisch die Frage, was heute verbraucht werden sollte.

## Synthese

Eine robuste Inventararchitektur braucht drei Ebenen:

1. **Handlungsorientierter Einstieg:** „Jetzt verwenden“ mit maximal drei bis fünf priorisierten Einträgen.
2. **Vollständiger Bestand:** durchsuchbare Liste oder kompakte Gruppen für alle Lebensmittel.
3. **Strukturperspektiven:** Lagerort, Kategorie, Datum und Status als Filter oder alternative Ansicht.

Die Innovation liegt somit in einer dynamischen Priorisierungsschicht über dem Bestand, nicht in der Abschaffung der klassischen Inventarliste.

## Design-Hypothese

Die Startansicht sollte nicht dauerhaft als statisches Dashboard mit vielen Karten funktionieren. Sie sollte sich abhängig vom Bestand verändern:

- kein dringender Artikel: ruhiger Gesamtbestand mit nächster relevanter Aktion;
- wenige dringende Artikel: kompakte „Jetzt verwenden“-Gruppe;
- viele dringende Artikel: priorisierte Liste mit sichtbarer Gruppierung nach heute, bald und später;
- fehlende Datumsinformation: klarer neutraler Status statt erfundener Präzision.

Der letzte Punkt ist zentral: Eine Priorisierung ist nur vertrauenswürdig, wenn Unsicherheit sichtbar bleibt.

## Validierbare Produktentscheidung

Für einen ersten Prototyp sollten drei Ansichten verglichen werden:

- Lagerort-first,
- Kategorie-first,
- Use-first über vollständigem Bestand.

Die Kernaufgaben lauten: „Was soll ich heute zuerst verwenden?“, „Wo liegt die zweite Packung?“, „Welche Lebensmittel sind noch ohne Datum?“ und „Was ist bereits aufgebraucht?“. Erfolg bedeutet nicht nur schnelle Navigation, sondern korrekte Entscheidungen ohne versteckte oder falsch priorisierte Artikel.

## Quellen

1. EatFirst, https://eatfirst.app/
2. Foodminder, https://www.foodminder.app/
3. ok2eat, https://ok2eat.com/
4. Celier, https://www.celier.app/
5. KitchenPal, „Kitchen Inventory & Storage FAQs“, https://kitchenpalapp.com/en/faqs/kitchen.html
6. NoWaste, Apple App Store, https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004
