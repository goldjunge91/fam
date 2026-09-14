# Cycle 003: Datumslogik, Vertrauen und Anti-Food-Waste

## Forschungsfrage

Wie kann die Inventaransicht Ablaufdaten so priorisieren, dass sie Food Waste reduziert, ohne Mindesthaltbarkeitsdatum und Verbrauchsdatum zu verwechseln oder eine falsche Sicherheitsgarantie zu erzeugen?

## Gesicherte Grundlagen

Die Europäische Kommission unterscheidet ausdrücklich zwischen „use by“ als Sicherheitsgrenze und „best before“ als Qualitätsangabe. Sie berichtet außerdem, dass Missverständnisse bei der Datumskennzeichnung zu Haushalts-Food-Waste beitragen und dass Verbraucherinnen und Verbraucher insgesamt ein niedriges Verständnis der Datumsarten zeigen. [European Commission: Date marking and food waste prevention](https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en?prefLang=fi)

Das deutsche Bundeszentrum für Ernährung beschreibt dieselbe Unterscheidung: Ein Verbrauchsdatum ist für leicht verderbliche Lebensmittel ein Endpunkt; ein überschrittenes Mindesthaltbarkeitsdatum ist dagegen kein automatisches Wegwerfdatum und kann durch einen Sinnescheck bewertet werden. [BZfE: Haltbarkeit von Lebensmitteln](https://www.bzfe.de/kueche-und-alltag/kochen/haltbarkeit-von-lebensmitteln)

Lagerung und Öffnungszustand verändern die praktische Haltbarkeit. Das BZfE empfiehlt unter anderem, ältere Vorräte zuerst zu verwenden und geöffnete Verpackungen gesondert zu berücksichtigen. [BZfE: Lagerung](https://www.bzfe.de/einfache-sprache/kochen-und-aufbewahren/lagerung)

## Designfolgen

### 1. „Ablaufdatum“ darf kein einziger Status sein

Ein Produkt braucht mindestens:

- Datumsart: Mindesthaltbarkeitsdatum oder Verbrauchsdatum;
- konkretes Datum, falls vorhanden;
- Öffnungszustand beziehungsweise „geöffnet am“, falls relevant;
- Lagerort und gegebenenfalls Lagerhinweis;
- Herkunft des Datums: Packung, Nutzerangabe oder App-Schätzung.

Die letzte Information ist wichtig für Vertrauen. Eine geschätzte Haltbarkeit darf in der Oberfläche nicht wie ein vom Hersteller gedrucktes Datum erscheinen.

### 2. Dringlichkeit und Sicherheit müssen getrennt visualisiert werden

Für ein Verbrauchsdatum ist eine harte Warnung angemessen, weil das Datum laut BZfE nach Ablauf nicht überschritten werden soll. Für ein Mindesthaltbarkeitsdatum sollte der Zustand nach Ablauf nicht als pauschales „wegwerfen“ erscheinen. Sinnvoller sind Zustände wie:

`Verbrauchen bis heute → bald prüfen → MHD überschritten, prüfen → kein Datum`

Die Sprache sollte die Handlung erklären, nicht nur die Farbe wechseln. Farbe kann unterstützen, darf aber die einzige Bedeutungsträgerin sein.

### 3. Die Ansicht braucht einen erklärbaren Priorisierungsgrund

„Jetzt verwenden“ sollte auf dem Eintrag erklären können, warum ein Produkt oben steht: etwa „Verbrauchsdatum heute“, „geöffnet vor 3 Tagen“ oder „MHD in 2 Tagen“. Ein undurchsichtiger Haushaltsscore wäre für sicherheitsnahe Entscheidungen ungeeignet.

## Design-Hypothese

Die auffälligste Prioritätsinformation sollte nicht „rot = schlecht“ lauten, sondern eine Kombination aus Handlung und Grund:

**Heute verbrauchen**  ·  **Verbrauchsdatum heute**

**Bald verwenden**  ·  **MHD in 2 Tagen**

**Prüfen**  ·  **MHD überschritten**

**Ohne Datum**  ·  **Aussehen, Geruch und Lagerung beachten**

Diese Texte sind als Produktlogik gedacht, nicht als abschließende UI-Copy. Für Verbrauchs- und Gesundheitsfragen muss die endgültige Formulierung fachlich geprüft werden.

## Anti-Waste-Interaktion

Die wichtigste Rückmeldung ist nicht ein Score, sondern eine korrekte Zustandsänderung nach der Handlung:

- „Verwendet“ reduziert die Menge oder entfernt die letzte Einheit;
- „Teilweise verwendet“ lässt die Restmenge sichtbar;
- „Eingefroren“ verschiebt die relevante Frischelogik;
- „Weggeworfen“ erfasst Waste getrennt von Verbrauch;
- „Noch vorhanden“ verhindert versehentliches Entfernen.

Die App sollte nicht behaupten, Food Waste reduziert zu haben, nur weil eine Warnung angezeigt wurde. Der Nachweis entsteht erst aus den tatsächlichen Zustandsänderungen.

## Validierung

Mit realistischen Beispielen testen: Hackfleisch mit Verbrauchsdatum, Joghurt mit MHD, geöffnete Milch, loses Obst ohne Datum und tiefgefrorene Ware. Prüfen, ob Personen innerhalb weniger Sekunden erkennen:

- was heute sicherheitsrelevant ist;
- was nach MHD noch geprüft werden kann;
- welche Information geschätzt und welche vom Produkt übernommen wurde;
- welche Aktion die Menge korrekt aktualisiert.

## Quellen

1. European Commission, „Date marking and food waste prevention“, https://food.ec.europa.eu/food-safety/food-waste/eu-actions-against-food-waste/date-marking-and-food-waste-prevention_en?prefLang=fi
2. Bundeszentrum für Ernährung, „Haltbarkeit von Lebensmitteln“, https://www.bzfe.de/kueche-und-alltag/kochen/haltbarkeit-von-lebensmitteln
3. Bundeszentrum für Ernährung, „Lagerung“, https://www.bzfe.de/einfache-sprache/kochen-und-aufbewahren/lagerung
4. FoodSafety.gov, „Cold Food Storage Chart“, https://akaprod-www.foodsafety.gov/food-safety-charts/cold-food-storage-charts
