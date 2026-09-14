# UI-Inspiration: Inventar, Küche, Einkauf und Haushalt

Die 12 Bilder in diesem Ordner sind eine lokale Referenzsammlung für das Inventar-Redesign. Sie dienen der visuellen Analyse und sind nicht als wiederverwendbare Produkt-Assets für die App gedacht.

## Quellen und Beobachtungen

| Datei | Quelle | Provenienz | Beobachtung |
|---|---|---|---|
| `pantry-check-inventory.png` | [Pantry Check](https://api.dev.aks.pantrycheck.com/img/iphone6-pantry.png) | offizielle Produktquelle | Kategorien, Produktbilder, Ablaufzeitleiste, vierteilige Navigation |
| `chefito-inventory.png` | [Chefito](https://chefito.de/Marketing/research-visuals/1.png?v=0.1.0) | offizielle Produktquelle | Inventar als Übersicht mit Ablaufpriorität |
| `chefito-inventory-shopping.png` | [Chefito](https://chefito.de/Marketing/research-visuals/10.png) | offizielle Produktquelle | Bestand und Einkaufsliste als zwei klar getrennte Flächen |
| `famn-shared-grocery-list.png` | [Famn](https://famn.app/_screenshots/en/famn-phone-en-02.ee5162a314.600w.png) | offizielle Produktquelle | Mengensteuerung, gemeinsamer Einkauf, klare Primäraktionen |
| `foodshiner-inventory.png` | [iMore: FoodShiner](https://www.imore.com/foodshiner-keeps-track-your-food-so-it-doesnt-get-wasted) | Editorial-Screenshot, nicht primär | Smart Lists, Ablauf-/Verbrauchsfokus, Timeline-Navigation |
| `my-inventory-location-list.webp` | [My Inventory via MWM](https://mwm.ai/apps/my-inventory-home-tracker/1362509132) | App-Preview-Mirror, nicht primär | Physische Orte, Teilmengen und Nullbestand nebeneinander |
| `anydo-shared-grocery-list.png` | [Any.do Grocery](https://ja.any.do/v4/images/translations/en/to-do-list/Grocery.png) | offizielle Produktquelle | Gruppen und Checkboxen als einfache Einkaufshandlung |
| `what-the-fridge-home-light.jpg` | [What The Fridge?!](https://www.what-the-fridge.app/images/gallery/01-home-light.png) | offizielle Produktquelle, Browser-Asset-Export | Home-Surface mit Ablauf- und Bestandszusammenfassung |
| `what-the-fridge-home-screen.png` | [What The Fridge?!](https://www.what-the-fridge.app/images/gallery/iphone/01-home-screen.png) | offizielle Produktquelle, Browser-Asset-Export | Mobile Home-Dashboard als Einstieg |
| `what-the-fridge-inventory-list.png` | [What The Fridge?!](https://www.what-the-fridge.app/images/gallery/iphone/02-inventory-list.png) | offizielle Produktquelle, Browser-Asset-Export | Vollständiger Bestand mit Ablaufdatum und Ortsbadges |
| `what-the-fridge-expired-filter.png` | [What The Fridge?!](https://www.what-the-fridge.app/images/gallery/iphone/03-inventory-expired-filter.png) | offizielle Produktquelle, Browser-Asset-Export | Statusfilter für abgelaufene Einträge |
| `what-the-fridge-add-item.png` | [What The Fridge?!](https://www.what-the-fridge.app/images/gallery/iphone/04-add-item-manual.png) | offizielle Produktquelle, Browser-Asset-Export | Manuelle Erfassung mit Menge, Ort und Datum |

## UI-Muster für Fam

1. **Home vor Verwaltung:** Zusammenfassung und dringende Artikel als Einstieg, vollständige Liste als zweite Ebene.
2. **Ort als Wiederfindehilfe:** Kühlschrank, Vorrat und Gefrierfach als stabile räumliche Struktur.
3. **Ablauf als Filter, nicht als rote Wand:** Statusansichten fokussieren, ohne den gesamten Bestand zu dramatisieren.
4. **Menge direkt verändern:** Plus/Minus oder „1 verwendet“ für den häufigsten Verbrauchsschritt.
5. **Haushalt sichtbar, aber ruhig:** gemeinsame Änderungen und Personenhinweise klein halten, keine Chat- oder Rankingfläche.
6. **Navigation nach Handlung:** Inventar, Einkauf, Ablauf und Verlauf sind unterschiedliche Aufgaben, nicht vier gleichwertige Datenbanken im selben Screen.

## Technischer Nachweis

Die offiziellen What-The-Fridge-Assets wurden aus der öffentlich sichtbaren Produktgalerie über den Browser-Asset-Export gebündelt. Das Manifest liegt als `what-the-fridge-assets-manifest.json` daneben. Die übrigen öffentlichen Bildquellen wurden anhand ihrer veröffentlichten Bild-URLs gespeichert.
