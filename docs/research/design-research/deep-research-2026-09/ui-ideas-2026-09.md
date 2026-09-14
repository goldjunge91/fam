# Online UI-Ideen für das Inventar-Redesign

Diese Recherche untersucht mobile UI-Muster für Lebensmittelbestand, Haltbarkeit, Lagerorte und Haushaltskontext. Sie baut auf dem Produktbrief [briefmd-v1.md](../briefmd-v1.md) auf. Die primäre Produktfrage ist nicht, wie ein Einkaufszettel möglichst schnell abgehakt wird, sondern wie ein Haushalt seinen vorhandenen Bestand ruhig, zuverlässig und mit wenig Pflegeaufwand versteht.

## Kurzfazit

Die stärkste gemeinsame Struktur der untersuchten Produkte ist eine Inventaransicht mit drei Lesarten:

1. **Jetzt:** Was sollte bald verwendet, geprüft oder korrigiert werden?
2. **Wo:** In welchem Lagerort liegt der Artikel?
3. **Alles:** Wie sieht der vollständige, durchsuchbare Bestand aus?

Für Fam ergibt sich daraus ein klarer Redesign-Rahmen: Eine kompakte „Jetzt verwenden“-Schicht steht über der vollständigen Inventarliste. Lagerorte und Haltbarkeitsstatus sind alternative Perspektiven auf denselben Bestand. Die häufigste Zustandsänderung, etwa „1 verwendet“, muss direkt in der Liste möglich sein und eine sichtbare Rücknahme anbieten.

Der Einkauf bleibt in dieser Sammlung eine angrenzende Referenz. Ein Übergang „aus der Einkaufsliste in den Bestand“ wird nicht als primärer Einstieg vorgeschlagen. Die aktuelle Richtung bleibt Inventar zuerst.

## Was die visuellen Beispiele zeigen

| Muster | Sichtbare Evidenz | Konsequenz für Fam |
|---|---|---|
| Priorisierte Startfläche | Pantry Check, Chefito und What The Fridge?! zeigen eine Home- oder Ablaufebene vor der Vollansicht.[^1][^2][^3] | Der erste Screen sollte Aufmerksamkeit bündeln, nicht nur Daten auflisten. |
| Physischer Lagerort | My Inventory und What The Fridge?! machen Kühlschrank, Vorrat und andere Orte als schnelle Wiederfindehilfe sichtbar.[^4][^3] | Ort ist eine wichtige Perspektive, aber nicht die einzige Sortierung. |
| Ablauf als fokussierbare Ansicht | Pantry Check arbeitet mit Ablauf- bzw. Timeline-Flächen. FoodShiner zeigt Smart Lists und Verbrauchsfokus. What The Fridge?! stellt einen Ablauf-Filter aus.[^1][^5][^3] | Ablauf sollte als temporäre Aufgabe funktionieren, nicht als permanente rote Warnwand. |
| Mengen direkt bearbeiten | Famn zeigt Mengensteuerung direkt an der gemeinsamen Liste. My Inventory stellt Teilmengen und Bestandswerte in der Liste dar.[^6][^4] | Die häufigste Pflegehandlung darf kein Detailformular voraussetzen. |
| Gemeinsamer Haushalt ohne Datenfeed | Famn und FoodShiner zeigen geteilte bzw. synchronisierte Nutzung als Produktnutzen, ohne dass ein Aktivitätsfeed den Kernbildschirm dominieren muss.[^6][^5] | Attribution, Zeitpunkt und Undo reichen zunächst für Vertrauen. |
| Klare Modi | Chefito zeigt Bestand und Einkauf als zusammengehörige, aber getrennte Flächen. Any.do reduziert die Einkaufshandlung auf Gruppierung und Checkboxen.[^2][^7] | Inventar, Einkauf und Planung dürfen verbunden sein, sollten aber nicht dieselbe Oberfläche erzwingen. |

## Screenshot-Sammlung

Die vollständige Galerie liegt als lokal öffnbarer HTML-Bericht vor: [UI-Inspiration-Galerie](ui-inspiration-gallery.html). Die Originaldateien liegen in [ui-inspiration-screenshots-2026-09](ui-inspiration-screenshots-2026-09/README.md).

| Referenz | Lokal gespeicherter Screenshot | Primäre Beobachtung |
|---|---|---|
| Pantry Check | [pantry-check-inventory.png](ui-inspiration-screenshots-2026-09/pantry-check-inventory.png) | Inventar, Ablauf und Verlauf als getrennte mentale Ebenen |
| Chefito | [chefito-inventory.png](ui-inspiration-screenshots-2026-09/chefito-inventory.png) | Ablaufpriorität als kompakte Übersicht |
| Chefito | [chefito-inventory-shopping.png](ui-inspiration-screenshots-2026-09/chefito-inventory-shopping.png) | Bestand und Einkauf als getrennte Modi |
| FoodShiner | [foodshiner-inventory.png](ui-inspiration-screenshots-2026-09/foodshiner-inventory.png) | Smart Lists, Verbrauch und Lagerort |
| My Inventory | [my-inventory-location-list.webp](ui-inspiration-screenshots-2026-09/my-inventory-location-list.webp) | Lagerort und Teilmenge |
| What The Fridge?! | [what-the-fridge-home-screen.png](ui-inspiration-screenshots-2026-09/what-the-fridge-home-screen.png) | Mobile Home-Surface |
| What The Fridge?! | [what-the-fridge-home-light.jpg](ui-inspiration-screenshots-2026-09/what-the-fridge-home-light.jpg) | Alternative Home-Galerieansicht |
| What The Fridge?! | [what-the-fridge-inventory-list.png](ui-inspiration-screenshots-2026-09/what-the-fridge-inventory-list.png) | Vollständige Liste mit Ort und Datum |
| What The Fridge?! | [what-the-fridge-expired-filter.png](ui-inspiration-screenshots-2026-09/what-the-fridge-expired-filter.png) | Statusfilter für abgelaufene Artikel |
| What The Fridge?! | [what-the-fridge-add-item.png](ui-inspiration-screenshots-2026-09/what-the-fridge-add-item.png) | Manuelle Erfassung |
| Famn | [famn-shared-grocery-list.png](ui-inspiration-screenshots-2026-09/famn-shared-grocery-list.png) | Gemeinsame Mengenaktion |
| Any.do | [anydo-shared-grocery-list.png](ui-inspiration-screenshots-2026-09/anydo-shared-grocery-list.png) | Reduzierte Listenhandlung |

Die FoodShiner-Ansicht stammt aus einem iMore-Editorial-Screenshot und die My-Inventory-Ansicht aus einem App-Preview-Mirror. Beide sind deshalb als visuelle Hinweise nützlich, aber als Funktionsbeleg schwächer als offizielle Produktseiten. Die What-The-Fridge-Assets wurden aus der öffentlich sichtbaren Produktgalerie exportiert; der zugehörige Asset-Nachweis liegt als [Manifest](ui-inspiration-screenshots-2026-09/what-the-fridge-assets-manifest.json) daneben.

## Konkrete UI-Richtungen für Fam

### 1. „Jetzt verwenden“ als Aufmerksamkeits-Schicht

Der Home-Screen zeigt oben eine kurze, begründete Auswahl statt einer zufälligen Produktauswahl:

- **Heute:** Verbrauchs- oder Öffnungsdatum ist relevant.
- **Bald:** MHD oder eigene Erinnerung liegt im nahen Zeitraum.
- **Offen:** Eine Packung sollte zuerst aufgebraucht werden.
- **Ohne Datum:** Bestand ist vorhanden, aber noch nicht klassifiziert.

Jede Zeile erklärt den Grund direkt am Artikel. „Joghurt, geöffnet vor 4 Tagen“ ist informativer als ein roter Punkt. Die Auswahl ist eine Ansicht auf den Bestand, kein eigener Datenbestand.

### 2. Lagerorte als räumliche Karte

Die zweite Ebene gruppiert nach Kühlschrank, Gefrierfach, Vorrat und optional eigenen Orten. Ein Ort kann als kompakter Abschnitt oder als horizontales Umschalten funktionieren. Die Liste bleibt dabei dieselbe Liste, damit eine Mengenänderung aus jeder Perspektive denselben Bestand aktualisiert.

Innovationschance: Der Ort kann nicht nur als Badge, sondern als mentale Karte behandelt werden. Ein Artikel kann „Kühlschrank · obere Ablage“ oder „Vorrat · Frühstück“ anzeigen, ohne die Oberfläche mit verschachtelten Ordnern zu überladen. Die Unterteilung sollte nur so tief sein, wie sie beim Wiederfinden hilft.

### 3. Verbrauch als direkte Zustandsänderung

Die Standardzeile sollte den häufigsten Schritt anbieten:

```text
Hafermilch                 1,5 l
Vorrat · geöffnet           MHD in 3 Tagen       − 1 verwendet   +
```

Nach der Aktion ändert sich Menge und Status sofort. Ein kleines Undo bleibt sichtbar. Ein Detail-Sheet ergänzt seltene Aktionen wie Verschieben, Datum korrigieren, Öffnungsdatum setzen oder als verbraucht markieren.

Wichtig ist die Trennung zwischen exakter Menge und grober Bestandsstufe. „Halbvoll“ kann eine schnelle Eingabe sein, darf aber nicht unbemerkt die kanonische Einheit oder Menge ersetzen. Pantri zeigt, wie grobe Zustände wie „low“, „half“ und „full“ die Pflege vereinfachen können.[^8]

### 4. Ablauf als Lens statt als globaler Alarm

Ein Filter „Ablauf“ öffnet eine konzentrierte Arbeitsansicht. Die Reihenfolge kann lauten:

1. heute relevant;
2. innerhalb der nächsten Tage;
3. überfällig oder zu prüfen;
4. ohne Datum.

Die Farbe bleibt sekundär. Primär sind Datum, Statuswort und ein verständlicher Grund. MHD, Verbrauchsdatum, Öffnungsdatum und Haushaltsschätzung sollten nicht wie dieselbe Datenart aussehen. Die europäische Kommunikation zu Datumskennzeichnungen unterscheidet ebenfalls zwischen „use by“ und „best before“, was für die Informationsarchitektur relevant ist.[^9]

### 5. Add-Flow mit minimalem Pflichtumfang

Die manuelle Erfassung sollte nicht zuerst ein großes Formular zeigen. Ein sinnvoller Ablauf ist:

1. Name und Menge;
2. Ort;
3. optional Datum oder „ohne Datum“;
4. speichern und direkt in der aktuellen Liste weiterarbeiten.

Barcode oder externe Produktdaten können später ergänzen. Für den Inventar-Kern ist entscheidend, dass ein Artikel auch ohne Treffer, Netzverbindung oder perfekte Produktdaten als lokaler Haushaltsbestand angelegt werden kann.

### 6. Haushalts-Sync als ruhige Vertrauensebene

Ein Artikel kann bei einer Änderung kurz anzeigen, wer ihn zuletzt verändert hat und ob die Änderung synchronisiert ist. Das genügt für den Anfang:

- „von Lina geändert“;
- „vor 2 Min.“;
- „Rückgängig“;
- bei Offline-Status: „wird synchronisiert“.

Ein globaler Feed, Ranking oder Chat im Inventar würde Aufmerksamkeit vom Bestand abziehen. Die Funktion gemeinsamer Listen bei Famn und die Synchronisationsidee bei FoodShiner bestätigen den Wert des Haushaltskontexts, nicht die Notwendigkeit einer feedartigen Oberfläche.[^5][^6]

## Ein möglicher Screen-Stack

### Screen A, Inventar-Home

- Haushaltsname und Sync-Zustand oben;
- „Jetzt verwenden“ mit maximal drei bis fünf Artikeln;
- Ortsübersicht mit Mengen je Lagerort;
- darunter „Alle Artikel“ mit Suche;
- eine primäre Aktion „Artikel hinzufügen“.

### Screen B, Lagerort-Liste

- Ort als aktive Perspektive;
- Artikelzeilen mit Name, Menge, Status und Datum;
- direkte Mengenaktion;
- Filter „Ablauf“, „offen“, „ohne Datum“;
- keine dekorativen Produktkarten, wenn sie die Scan-Geschwindigkeit reduzieren.

### Screen C, Artikel-Sheet

- Name, Menge und Einheit;
- Lagerort;
- Datumsart und Datum;
- „1 verwendet“ sowie „als verbraucht markieren“;
- verschieben, bearbeiten, löschen;
- letzte Änderung und Undo.

### Screen D, Ablauf-Lens

- vier Statusgruppen;
- verständliche Gründe pro Artikel;
- Sammelaktion nur für eindeutig gleiche Zustände;
- Rückkehr zum unveränderten Inventar ohne Navigationsverlust.

## Was übernommen werden sollte

| Priorität | Entscheidung | Warum |
|---|---|---|
| P0 | „Jetzt“ über der vollständigen Liste | Verbindet Bestand mit einer täglichen Handlung. |
| P0 | Lagerort und Ablauf als Perspektiven | Unterstützt sowohl räumliches Wiederfinden als auch Food-Waste-Prävention. |
| P0 | Direkte Mengenänderung mit Undo | Reduziert Pflegeaufwand und macht den Bestand glaubwürdiger. |
| P0 | Kein Datum als gültiger Zustand | Verhindert erfundene Präzision. |
| P1 | Grobe Stock-Level als Schnellaktion | Sinnvoll, wenn exakte Mengen im Alltag zu teuer sind. |
| P1 | Letzte Änderung pro Artikel | Erzeugt Haushaltsvertrauen ohne Feed. |
| P2 | „Was kann ich kochen?“ | Gute nächste Handlung, aber erst nach einem stabilen Bestand. Grocy und GroceryShare zeigen den Wert dieser späteren Brücke.[^10][^11] |

## Was nicht kopiert werden sollte

- Ein Dashboard, das nur hübsch aussieht, aber keine Zustandsänderung erlaubt.
- Permanente rote Ablaufmarkierung für jeden Artikel mit Datum.
- Ein Pflichtformular mit allen optionalen Feldern vor dem ersten Speichern.
- Lagerorte als starre Ordner, aus denen die globale Suche verschwindet.
- Ein Haushaltsfeed, der jede kleine Mengenänderung zu einer sozialen Aktivität macht.
- Externe Produktdaten als scheinbar sichere Wahrheit, wenn die Quelle nur eine Schätzung liefert.
- Einkauf als dominanter Einstieg in eine Inventaraufgabe.

## Differenzierungsideen

### Inventory Attention Budget

Jeder Screen zeigt nur so viele dringende Artikel, wie eine Person realistisch in einer kurzen Küchenhandlung bearbeiten kann. Der Rest bleibt im vollständigen Bestand. Dadurch wird Aufmerksamkeit selbst zu einer begrenzten Ressource.

### Date Confidence

Neben der Datumsart kann Fam anzeigen, wie sicher ein Datum ist: bestätigt, selbst gesetzt, aus Öffnung abgeleitet oder ohne Datum. So wird Unsicherheit nicht versteckt und die App vermeidet falsche Autorität.

### Spatial Memory

Der Nutzer kann den Bestand über den physischen Ort lesen, ohne eine neue Taxonomie lernen zu müssen. „Kühlschrank“, „Vorrat“ und „Gefrierfach“ sind dabei keine dekorativen Kategorien, sondern kurze Wege zur realen Handlung.

### Reversible Household State

Jede gemeinsame Änderung ist sofort sichtbar, lokal bedienbar und rücknehmbar. Das passt zu einer Offline-first-App: Die Oberfläche muss nicht auf die Serverbestätigung warten, darf den Synchronisationsstatus aber klar benennen.

## Empfehlung für den nächsten Mockup-Sprint

Der nächste statische Prototyp sollte drei Varianten derselben Inventarlogik gegenüberstellen:

1. **Now-first:** Ablauf und offene Packungen oben, Bestand darunter.
2. **Location-first:** Lagerorte als Startpunkt, Now-Lens als prominenter Filter.
3. **Hybrid:** kleine Now-Leiste, danach eine sehr dichte, suchbare Gesamtliste.

Alle drei Varianten sollten dieselben fünf Testdaten zeigen: ein bald ablaufendes Produkt, ein geöffnetes Produkt, ein Produkt ohne Datum, ein Mehrfachbestand und eine Offline-Mengenänderung. So wird die Informationsarchitektur verglichen, nicht nur die Farbe oder Kartenform.

## Grenzen der Evidenz

Die Screenshots zeigen veröffentlichte Produktdarstellungen, nicht vollständige Nutzertests. Marketinggalerien betonen gewünschte Produktmomente und können reale Interaktionskosten auslassen. Funktionen wurden deshalb nur dann als belastbare Produktbeobachtung verwendet, wenn eine offizielle Produktseite oder Dokumentation sie stützt. FoodShiner und My Inventory sind im Screenshot-Ordner ausdrücklich als Sekundärquellen markiert.

## Quellen

1. Pantry Check, [Produktseite](https://pantrycheck.com/) und [Overview-Dokumentation](https://pantrycheck.com/kb/overview/). Produktstruktur, Ablauf, Artikelstatus und Verbrauch.
2. Chefito, [offizielle Produktseite](https://chefito.de/en) und [Download-/Screenshot-Seite](https://chefito.de/en/download). Inventar, Ablauf, Haushalt und getrennte Einkaufsfläche.
3. What The Fridge?!, [offizielle Produktseite](https://www.what-the-fridge.app/). Home, Inventarliste, Orte, Ablauf-Filter und manuelle Erfassung.
4. My Inventory, [App-Preview-Mirror](https://mwm.ai/apps/my-inventory-home-tracker/1362509132). Sekundäre visuelle Referenz für Orte und Mengen.
5. FoodShiner, [offizielle Produktseite](https://foodshiner.app/en/index.html) und [iMore-Editorial mit Screenshot](https://www.imore.com/foodshiner-keeps-track-your-food-so-it-doesnt-get-wasted). Smart Lists, Ablauf, Verbrauch und Sync; Screenshot sekundär.
6. Famn, [offizielle Produktseite](https://famn.app/). Gemeinsame Haushaltsnutzung, Mengen und Synchronisation.
7. Any.do, [Grocery-Produktseite](https://ja.any.do/to-do-list/) und [offizielle Grocery-Preview](https://ja.any.do/v4/images/translations/en/to-do-list/Grocery.png). Gruppierte Listen und Checkbox-Handlung.
8. Pantri, [offizielle Produktseite](https://pantri.devalab.app/). Grobe Bestandsstufen, Ablauf und Offline-/Haushaltskontext.
9. European Commission, [Date marking and food waste prevention](https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en?prefLang=fi). Unterschied zwischen Datumsarten als Informationskontext.
10. Grocy, [Produktseite](https://grocy.info/) und [Food-Dokumentation](https://github.com/grocy/grocy-docs/blob/master/tutorials/food.md). Tiefes Bestandsmodell, Verbrauch und Rezeptverknüpfung.
11. GroceryShare, [offizielle Produktseite](https://groceryshare.app/). Frische-Timer, Fridge-Bereich und spätere Kochhandlung.
12. Zoku, [Shared shopping list](https://www.myzoku.fr/en/liste-de-courses-partagee), Mealuna, [Produktseite](https://mealuna.varres.ee/), OurGroceries, [User Guide](https://www.ourgroceries.com/user-guide), AnyList, [Lists](https://www.anylist.com/lists), und Bring!, [Collaborative](https://www.getbring.com/en/features/collaborative). Angrenzende Benchmarks für gemeinsame Listen und Übergänge.
