# Geprüfte Tageswerte für geöffnete Lebensmittel

Stand: 2026-09-07
Bezug: opened-expiry-rules_v1.md, opened-expiry-rules_v2.md
Implementierung: src/features/inventory/opened-expiry.ts

## Ergebnis der Überarbeitung

Die Tabellen aus v1 und v2 waren eine EverShelf-Referenzbasis. Sie waren
keine fachlich geprüfte Fam-Regelbasis. Diese Datei ersetzt die dortigen
Platzhalterwerte für die Fam-Implementierung.

Die Werte bedeuten: konservative Anzahl von Tagen ab dem Öffnen bei korrekter
Lagerung. Sie sind keine Garantie und ersetzen weder das Herstellerdatum noch
eine erforderliche Temperatur- oder Sichtprüfung. Ein kürzeres
Herstellerdatum gewinnt immer.

Die App verwendet absichtlich keine unendlichen Werte. Auch bei Salz, Zucker,
Honig, Essig und ähnlichen Produkten wird ein endlicher UI-Wert verwendet,
damit kein Produkt fälschlich als unbegrenzt sicher dargestellt wird.

## Fachliche Leitplanken

- Kühlschrankwerte setzen eine durchgängige Kühlung voraus. Für verderbliche
  Lebensmittel gilt die konservative Grenze von höchstens 3–5 °C als Ziel.
- Tiefkühlwerte sind überwiegend Qualitätsgrenzen. Bei dauerhaft -18 °C sind
  viele Lebensmittel sicher länger haltbar, verlieren aber Qualität. Die App
  erinnert deshalb an eine konservative Qualitätsgrenze und behauptet keine
  absolute Sicherheitsgrenze.
- Geöffnete Dosen werden nach dem Öffnen wie gekühlte Reste behandelt.
- Vakuum- oder Schutzgasverpackung verlängert die Fam-Tageszahl nicht
  automatisch. Ohne validierte Prozess-, Temperatur- und Herstellerdaten ist
  keine pauschale Multiplikation fachlich belastbar.
- Geruchs- und Geschmackstest sind keine ausreichende Sicherheitsprüfung für
  mögliche Toxine. Bei Unsicherheit gilt: nicht verzehren.
- Die Regeln erkennen nur deutsche und englische Namensmuster. Italienische
  EverShelf-Muster wurden auf deutsche oder englische Begriffe reduziert, zum
  Beispiel latte → Milch/milk, panna → Sahne/cream, burro →
  Butter/butter und pane → Brot/bread.

## Ortsunabhängige Regeln

| Produktgruppe | Tage |
| --- | ---: |
| Salz, Zucker, Honig, Essig, Bicarbonat/Natron | 365 |
| Backpulver, Natron als Backtriebmittel | 90 |
| Spirituosen | 365 |
| Aromen, Extrakte, Vanille, Farbstoffe | 365 |
| Tee und Kräutertee | 365 |
| Kaffee und Öl | 180 |
| Sojasauce, Paniermehl, Brotkrumen, Panko | 90 |

Der Backpulverwert von 90 Tagen folgt der USDA/FSIS-Angabe von drei Monaten
nach dem Öffnen für beste Qualität. Die übrigen trockenen oder stabilen
Produktgruppen erhalten eine endliche, konservative Fam-Qualitätsgrenze statt
des früheren 9999-Platzhalters.

## Tiefkühler

| Produktgruppe | Tage |
| --- | ---: |
| Brot, Gebäck, Kuchen, Muffins | 90 |
| Frische Pasta, Gnocchi, Ravioli, Tortellini | 60 |
| Eis, Sorbet | 60 |
| Fisch und Meeresfrüchte | 60 |
| Geflügel | 90 |
| Hackfleisch | 90 |
| Rind, Kalb, Lamm, Schwein, rotes Fleisch | 90 |
| Wurst und haltbare Fleischwaren | 60 |
| Butter | 180 |
| Sahne, Käse, Mozzarella, Ricotta | 30 |
| Gemüse | 180 |
| Obst | 180 |
| Brühe, Suppen, Saucen | 60 |

Die Werte sind jeweils konservativ unterhalb oder am unteren Rand der
verfügbaren Qualitätszeiträume. Das BfR nennt bei -18 °C als Orientierung
unter anderem drei Monate für Geflügel, drei bis sechs Monate für Rind und
Schwein, sechs Monate für Fisch sowie sechs bis zwölf Monate für Gemüse und
Obst. Die Fam-Regeln wählen daraus bewusst kurze, einheitliche Erinnerungs-
und Qualitätsgrenzen.

## Speisekammer

| Produktgruppe | Tage |
| --- | ---: |
| Pasta und Nudeln | 365 |
| Reis, Farro, Quinoa, Couscous | 365 |
| Mehl, Stärke, Polenta, Grieß | 180 |
| Linsen, Kichererbsen, Bohnen, Erbsen | 365 |
| Kekse, Waffeln, Cracker | 60 |
| Müsli, Cerealien, Cornflakes, Granola | 60 |
| Marmelade, Nuss-Nougat, Schokolade | 60 |
| Brot | 4 |
| Tomatensauce | 5 |
| Sahne | 3 |
| Joghurt | 2 |
| Milch | 1 |
| Käse | 2 |
| Kartoffeln, Zwiebeln, Knoblauch, Schalotten, Lauch | 30 |
| Karotten und Möhren | 14 |

Verderbliche Produkte in dieser Tabelle dürfen nicht bei Raumtemperatur
gelagert werden. Die kurzen Werte für Sahne, Joghurt, Milch und Käse decken
den Fall ab, dass der Eintrag als Vorrat erfasst, tatsächlich aber sofort
gekühlt wurde. Die UI sollte für solche Produkte weiterhin den Kühlschrank als
empfohlenen Lagerort anzeigen.

## Kühlschrank

| Produktgruppe | Tage |
| --- | ---: |
| Frische Milch | 3 |
| H-Milch und haltbare Milch | 7 |
| Joghurt | 7 |
| Mozzarella und Burrata | 3 |
| Frischkäse | 7 |
| Hartkäse, Parmesan, Emmentaler, Gruyère, Gouda | 21 |
| Frischer Käse, Ricotta, Mascarpone | 7 |
| Käse allgemein | 7 |
| Butter | 30 |
| Sahne und Rahm | 7 |
| Kochschinken, Mortadella, Wiener | 3 |
| Rohschinken, Salami, Bresaola, Speck | 7 |
| Rohes Fleisch | 2 |
| Fisch und frischer Fisch | 1 |
| Geöffnete Fischkonserven | 3 |
| Passata und Tomatensauce | 5 |
| Nudel-, Reis-, Pasta-, Getreide- und Couscous-Salat | 3 |
| Blattsalat und Sprossen | 4 |
| Saft | 5 |
| Bier | 3 |
| Wein | 5 |
| Beeren | 3 |
| Avocado | 3 |
| Banane, Pfirsich, Aprikose, Kirsche, Mango, Papaya | 3 |
| Apfel, Birne, Nektarine, Pflaume, Kiwi, Ananas, Trauben, Melone | 5 |
| Orange, Mandarine, Grapefruit, Zitrone, Zitrusfrüchte | 7 |
| Zucchini, Aubergine, Tomate, Paprika | 5 |
| Brokkoli, Blumenkohl, Kohl | 4 |
| Zwiebeln, Frühlingszwiebeln, Schalotten, Lauch | 6 |
| Karotten und Möhren | 7 |
| Kartoffeln | 4 |
| Knoblauch | 14 |
| Fladenbrot und Flatbread | 2 |
| Schnittbrot und verpacktes Brot | 4 |

Die gekühlten Fleisch-, Fisch- und Restewerte orientieren sich an den
offiziellen USDA-/FoodSafety.gov-Zeiträumen und verwenden bei Intervallen die
kurze Seite: rohes Geflügel und Hackfleisch 1–2 Tage, frischer Fisch 1–3
Tage, frisches Fleisch 3–5 Tage, geöffnete Aufschnittwaren 3–5 Tage,
geöffnete Fischkonserven 3–4 Tage und gekochte Reste 3–4 Tage. Für Fam wird
frischer Fisch mit einem Tag und rohes Fleisch mit zwei Tagen besonders
konservativ behandelt.

## Vakuumregel

getVacuumExpiryDays(baseDays) gibt baseDays unverändert zurück.

Vakuumverpackung ist kein Freifahrtschein für längere Lagerung. USDA/FSIS
verlangt weiterhin Kühlschrank- oder Tiefkühllagerung und verweist auf
Herstellerangaben. Das BfR weist zusätzlich darauf hin, dass sauerstoffarme
Verpackungen das Wachstum von Clostridium botulinum ermöglichen können und
die Kühlkette nicht ersetzen. Eine spätere produkt- oder prozessspezifische
Regel darf diesen Vertrag nur mit eigener Quelle und eigener Testmatrix
ersetzen.

## Fallbacks und Priorität

Die Auflösung bleibt deterministisch:

1. ortsunabhängiger Namens-Treffer,
2. ortsabhängiger Namens-Treffer,
3. ortsunabhängiger Kategorie-Treffer,
4. ortsabhängiger Kategorie-Treffer,
5. konservativer Lagerort-Fallback.

Die Fallbacks sind:

| Lagerort | Tage |
| --- | ---: |
| Tiefkühler | 60 |
| Kühlschrank | 3 |
| Speisekammer oder unbekannter Ort | 30 |

## Quellen

- [FDA: How to Cut Food Waste and Maintain Food Safety](https://www.fda.gov/food/consumers/how-cut-food-waste-and-maintain-food-safety) als offizieller Einstieg zu FoodKeeper sowie zu Kühl- und Resteregeln.
- [FoodSafety.gov: Cold Food Storage Charts](https://www.foodsafety.gov/food-safety-charts/cold-food-storage-charts) für gekühlte Fleisch-, Fisch-, Wurst-, Dosen- und Restewerte sowie die Einordnung von Tiefkühlzeiten als Qualitätsangaben.
- [USDA FSIS: Dairy Products](https://ask.fsis.usda.gov/article/How-long-can-you-keep-dairy-products-like-yogurt-milk-and-cheese-in-the-refrigerator) für Milch, Joghurt, Weichkäse und Hartkäse.
- [USDA FSIS: Shelf-Stable Food](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/shelf-stable-food) für geöffnete Dosen und trockene Produkte.
- [USDA FSIS: Sausages and Food Safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/meat-catfish/sausages-and-food-safety) für Kochwurst, Aufschnitt, frische Wurst und Rohwurst.
- [USDA FSIS: Freezing and Food Safety](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/freezing-and-food-safety) für die Einordnung von Tiefkühlwerten als Qualitätsgrenzen.
- [USDA FSIS: Vacuum Packaging](https://ask.fsis.usda.gov/article/Can-I-keep-meat-in-vacuum-packages-at-room-temperature) gegen Lagerung vakuumierter verderblicher Lebensmittel bei Raumtemperatur.
- [BfR: Korrektes Kühlen von Lebensmitteln im Privathaushalt](https://www.bfr.bund.de/fragen-und-antworten/thema/korrektes-kuehlen-von-lebensmitteln-im-privathaushalt/) für die Kühlkette und die Zieltemperatur.
- [BfR: Vorkochen für mehrere Tage](https://www.bfr.bund.de/fragen-und-antworten/thema/vorkochen-fuer-mehrere-tage/) für konservative Tiefkühlorientierungen.
- [BfR: Hinweise zum Botulismus durch Lebensmittel](https://www.bfr.bund.de/cm/350/hinweise_fuer_verbraucher_zum_botulismus_durch_lebensmittel.pdf) für die Einschränkung von Vakuum- und sauerstoffarmen Verpackungen.
