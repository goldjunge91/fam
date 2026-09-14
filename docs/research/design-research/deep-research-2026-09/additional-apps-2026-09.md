# Zusätzliche Apps für Inventar, Küche, Einkaufsliste und Haushalt

## Anlass und Scope

Diese Ergänzung basiert auf [briefmd-v1.md](../briefmd-v1.md) und erweitert die bereits dokumentierte Wettbewerbsrecherche. Untersucht wurden weitere Produkte rund um Lebensmittel-Inventar, Küche, gemeinsame Einkaufslisten und Haushaltskoordination.

Der primäre Produktjob bleibt unverändert: Die Inventaransicht soll den Lebensmittelbestand eines Haushalts abbilden und Food Waste reduzieren. Onboarding, Kassenbon-Import und eine konkrete Erfassungshierarchie sind in dieser Recherche nicht bewertet.

Die Recherche lief in vier zusätzlichen Zyklen, 007 bis 010. Die vorherigen Zyklen 000 bis 006 bleiben unverändert.

## Executive Summary

Die zusätzlichen Apps bestätigen die Richtung aus der ersten Recherche, verschärfen sie aber an einem Punkt: Der Wettbewerb besteht nicht aus einer einzigen Kategorie. Es gibt fünf Produktrollen:

1. **Inventory Ledger:** Bestand, Menge, Lagerort und Datum pflegen.
2. **Waste Radar:** Dringende oder bald vergessene Produkte hervorheben.
3. **Stock-to-List Bridge:** Niedrigen Bestand oder abgeschlossene Einkäufe zwischen Bestand und Einkaufsliste überführen.
4. **Kitchen Decision Layer:** Aus Bestand, Resten und Plan eine Kochhandlung machen.
5. **Household Coordination:** Gemeinsame Änderungen, Zuständigkeit und Synchronisation verständlich halten.

Die stärkste Position für Fam ist eine kontrollierbare Inventaransicht, die die Rollen 1, 2 und 5 sauber beherrscht und Rolle 3 vorbereitet. Die Koch- und Einkaufsbrücken dürfen den Kern bereichern, aber nicht die Bestandswahrheit ersetzen.

## 1. Die wichtigsten neuen direkten Benchmarks

### Pantry Check

Pantry Check ist der klarste Benchmark für eine dedizierte mobile Inventarstruktur. Die Produktdokumentation nennt getrennte Flächen für Inventar, Artikeldetail, ablaufende Artikel, Einkaufslisten und Timeline. „Finish“ entfernt den Artikel aus dem aktiven Bestand; angebrochene Produkte können mit einer Teilmenge gepflegt werden. Damit bildet die App einen nachvollziehbaren Zustandsübergang statt nur eine Warnung.

**Für Fam übernehmen:**

- aktiver Bestand und Verlauf als unterschiedliche Ebenen;
- Teilmenge als normale Aktion;
- „bald ablaufend“ als fokussierbare Teilmenge des Bestands.

**Nicht blind übernehmen:** automatisch geschätzte Preise oder Datumswerte als scheinbar exakte Wahrheit.

### FoodShiner

FoodShiner verbindet Mengen, Ablaufdaten, Lagerorte, Smart Lists, Widgets und gemeinsame Synchronisation. Besonders nützlich ist die Unterscheidung zwischen Produkten, die bald ablaufen, und geöffneten Packungen.

**Für Fam übernehmen:** Zwei unterschiedliche Prioritätsgründe können in einer gemeinsamen „Jetzt verwenden“-Ansicht landen. Die Karte muss aber erklären, ob das Produkt wegen Sicherheitsdatum, MHD, Öffnung oder Verbrauchsprognose oben steht.

### Fridgely

Fridgely ist ein reduzierter Ablaufdaten- und Lagerort-Tracker mit gemeinsamer Bearbeitung, Rezeptbezug und Barcode-Schätzung.

**Für Fam übernehmen:** Räume beziehungsweise Lagerorte bleiben ein schneller Weg, etwas wiederzufinden. Sie sollten aber eine Perspektive auf den Bestand sein, nicht die einzige Startlogik.

### Grocy

Grocy ist der stärkste Benchmark für die innere Bestandslogik. Mindestbestände erzeugen Einkaufslisten, Rezepte können Mengen verbrauchen, Lagerorte können gewechselt werden, und ein Due Score versucht, Rezepte nach drohendem Ablauf zu priorisieren.

**Für Fam übernehmen:** Jede wichtige Küchenhandlung sollte eine definierte Bestandsänderung erzeugen. Das spricht für eine spätere Verbindung von „Mahlzeit gekocht“ und „Mengen reduziert“, nicht für ein bloßes Rezeptkarussell.

**Für Fam anders lösen:** Kein undurchsichtiger Due Score als Hauptsignal. Der konkrete Grund muss auf der Karte lesbar sein.

### Pantri

Pantri ergänzt Ablaufzeitfenster um die drei schnellen Bestandsstufen „low“, „half“ und „full“. Dazu kommen Haushalts-Sync, Offline-Verhalten, Einkaufslisten nach Gang und Ausgabenhistorie.

**Für Fam übernehmen:** Eine schnelle, grobe Bestandsstufe kann die Pflege vereinfachen, wenn exakte Mengen nicht sinnvoll sind.

**Architekturhinweis:** Die UI-Stufe darf nicht die kanonische Menge ersetzen. Sie ist ein Eingabekürzel oder eine visuelle Zusammenfassung.

## 2. Die wichtigsten neuen Einkaufs- und Haushalts-Benchmarks

### Zoku und Mealuna: der Übergang ist das Produkt

Zoku beschreibt einen Übergang vom Abhaken im Einkauf in den häuslichen Bestand inklusive Ablaufdatum. Mealuna beschreibt einen ähnlichen Regelkreis zwischen geteilter Liste, Pantry, Offline-Einkauf, niedrigem Bestand und Meal-Plan.

Das ist für Fam strategisch wichtig, weil es die bestehende Produktidee stützt: Ein Einkauf kann später die Quelle eines neuen Bestandszustands sein. Für die jetzige Inventaransicht folgt daraus vor allem, dass Herkunft und Status eines Artikels nachvollziehbar sein sollten.

### OurGroceries, AnyList, Bring! und Cozi: die gemeinsame Aktion

Diese Produkte zeigen, dass gemeinsame Listen vor allem durch eine direkte Aktion funktionieren:

- Artikel hinzufügen;
- Artikel abhaken;
- Menge, Notiz oder Foto ergänzen;
- Liste nach Laden oder Gang sortieren;
- Änderung in Echtzeit sehen.

Für Fam ist die Entsprechung nicht „Artikel abhaken“, sondern „1 verwendet“. Der Button muss ebenso unmittelbar wirken, mit Undo und sichtbarer Mengenänderung.

### hmly und mitlist: Haushalt als Kontext

hmly und mitlist verbinden Listen, Aufgaben, Mahlzeiten, Kosten und mehrere Personen. Sie liefern interessante Muster für Haushaltsgrenzen, Präsenz, Offline-Warteschlangen, Open Source und Self-Hosting. Gleichzeitig zeigen sie die Gefahr einer zu breiten Haushaltszentrale.

**Empfehlung:** Im Inventarscreen nur die für den Bestand relevante Attribution zeigen: Person, Zeitpunkt, Änderung und Undo. Aufgaben, Kalender, Kosten und Kommunikation bleiben eigene Flächen.

### Cravly: „live claim“ statt doppelt kaufen

Cravly beschreibt, dass mehrere Personen im Laden Artikel für sich beanspruchen können. Dadurch wird nicht nur sichtbar, was gekauft werden soll, sondern wer es gerade übernimmt.

**Übertragbare Idee:** Für geteilte Bestandsänderungen könnte ein kurzer Status „Mara aktualisiert gerade“ helfen, bevor ein Konflikt entsteht. Das sollte opt-in und temporär bleiben, nicht als dauerhafte Präsenzschicht auf jeder Karte.

## 3. Die wichtigsten neuen Küchen- und Anti-Waste-Benchmarks

### Kitchen Pantri, Helpings und SwiftLists

Diese Produkte behandeln Einkauf, Rezepte und Kochen als zusammenhängenden Ablauf. Helpings hält eine gemeinsame Rezeptbox, Wochenplan und Einkaufsliste synchron. SwiftLists trennt Shop- und Cook-Modus. Kitchen Pantri beschreibt die Lücke zwischen Liste, Pantry und Dinner als Kernproblem.

**Für Fam übernehmen:** Moduswechsel und Kontext. Eine Inventaransicht kann eine nächste Handlung anbieten, ohne zum vollständigen Rezept- oder Planungsbildschirm zu werden.

### GroceryShare

GroceryShare beschreibt einen „My Fridge“-Bereich mit Frische-Timern und einen Vorschlag „What can I cook?“. Das ist ein gutes Beispiel für eine konkrete Handlung aus dem Bestand.

**Für Fam übernehmen:** „Was kann ich jetzt sinnvoll tun?“ als spätere Aktion auf dem Bestand.

**Für Fam vermeiden:** Kochvorschläge als Ersatz für die vollständige, kontrollierbare Bestandsansicht.

### Olio

Olio liegt außerhalb des direkten Wettbewerbs, ist aber für Food-Waste-Vermeidung relevant. Die App macht aus überschüssigen Lebensmitteln eine lokale Weitergabe mit Foto, Angebot, Nachricht und Abholung.

**Mögliche spätere Richtung:** Wenn ein Lebensmittel im Haushalt nicht mehr gebraucht wird, könnte „weitergeben“ eine Alternative zu „wegwerfen“ werden. Wegen Food-Safety, Datenschutz und lokaler Verfügbarkeit gehört das klar in eine spätere Produktentscheidung.

## 4. Wettbewerbs-Matrix

| App | Inventar | Ablauf / Frische | Einkaufsliste | Haushaltssync | Rezept-/Meal-Bridge | Relevanz |
|---|---:|---:|---:|---:|---:|---|
| Pantry Check | stark | stark | stark | nicht zentral belegt | mittel | direkter Mobile-Inventory-Benchmark |
| FoodShiner | stark | stark | stark | stark | mittel | Smart Lists, Widgets und Verbrauch |
| Fridgely | mittel | stark | nicht zentral | stark | mittel | einfacher Lagerort-/Expiry-Tracker |
| Grocy | sehr stark | stark | stark | selbst gehostet | stark | tiefstes Bestandsmodell |
| Pantri | mittel | mittel | stark | stark | nicht zentral | schnelle Stock-Level und Offline-Ansatz |
| Zoku | mittel | mittel | stark | stark | stark | Einkauf → Bestand als Brücke |
| Mealuna | stark | stark | stark | stark | stark | Regelkreis und Offline-Einkauf |
| Kitchen Pantri | mittel | mittel | stark | stark | stark | Verbindung von Liste, Pantry und Dinner |
| OurGroceries | nicht zentral | nein | sehr stark | stark | mittel | Synchronisations- und Listenbenchmark |
| AnyList | nicht zentral | nein | sehr stark | stark | stark | Kategorien, Fotos, Plan und Listen |
| Bring! | nicht zentral | nein | sehr stark | stark | mittel | leichte gemeinsame Aktionen |
| Cozi | nicht zentral | nein | stark | stark | mittel | Familienkontext und mehrere Listen |
| hmly | stark | stark | stark | stark | stark | breite Haushaltsplattform |
| mitlist | mittel | nicht zentral | stark | stark | stark | Open Source, Offline, Haushaltshub |
| Cravly | mittel | mittel | stark | stark | stark | Live claims und Leftover-Planung |
| Olio | nein | Food-Safety-Kontext | nein | Community | nein | Weitergabe statt Entsorgung |

Die Matrix ist eine qualitative Einordnung der beschriebenen Produktfunktionen. Sie ist keine unabhängige Usability-Bewertung und keine Aussage über Marktanteil.

## 5. Priorisierte Konsequenzen für das Inventar-Redesign

### P0: Ein Bestand, zwei Lesarten

Die erste Lesart ist „Jetzt verwenden“. Die zweite ist „Alles im Bestand“. Dieser Dualismus wird durch Pantry Check, FoodShiner, Fridgely und die Use-first-Produkte gestützt.

### P0: Zustandsänderung statt Benachrichtigung

„1 verwendet“, Teilmenge, eingefroren und weggeworfen müssen den Bestand sichtbar und reversibel ändern. Eine Warnung allein ist kein Fortschritt.

### P0: Herkunft und Unsicherheit

Ein Artikel sollte unterscheiden können zwischen:

- bestätigtem Verbrauchsdatum;
- MHD;
- Öffnungsdatum;
- automatisch geschätztem Datum;
- eigener Haushaltsschätzung;
- keinem Datum.

### P1: Stock-to-List als späterer Übergang

Low-stock- und Restock-Muster sind in Grocy, Pantry Check, Pantri, Zoku und Mealuna stark vertreten. Der Übergang ist relevant, aber nicht Bestandteil des jetzigen Inventar-Mockup-Sprints.

### P1: Haushaltsklarheit ohne Haushaltsfeed

Person, Zeit, Status und Undo auf Artikel- oder Detailniveau. Kein globaler Feed, keine Rangliste und kein Schuldgefühl.

### P2: Kochen und Weitergeben als nächste Handlung

„Was kann ich kochen?“ und „Kann das jemand anderes verwenden?“ sind wertvolle spätere Aktionen. Beide dürfen erst nach einem vertrauenswürdigen Bestandskern ergänzt werden.

## 6. Empfohlene Shortlist für konkrete Produktanalyse

Für eine spätere Detailanalyse mit Screenshots oder installierten Testversionen würde ich diese Reihenfolge wählen:

1. Pantry Check: mobile Bestands- und Verbrauchsstruktur;
2. Grocy: Tiefenmodell für Bestand, Verbrauch und Rezeptlogik;
3. FoodShiner: Smart Lists und Waste-Priorisierung;
4. Mealuna: Liste, Pantry, Offline und Haushalt als Regelkreis;
5. Zoku: Einkauf nach dem Abhaken in den Bestand überführen;
6. OurGroceries: gemeinsame Listenaktion und Sync-Verhalten;
7. AnyList: Kategorien, Fotos, Plan und Listenorganisation;
8. hmly oder mitlist: Haushaltsgrenzen, Präsenz und Offline-Verhalten.

## Quellen

1. Pantry Check, [Overview](https://pantrycheck.com/kb/overview/) und [Produktseite](https://pantrycheck.com/)
2. FoodShiner, [Product page](https://foodshiner.app/en/index.html)
3. Fridgely, [Product page](https://www.fridgelyapp.com/)
4. Grocy, [Product page](https://grocy.info/), [Food docs](https://github.com/grocy/grocy-docs/blob/master/tutorials/food.md), [Cooking docs](https://github.com/grocy/grocy-docs/blob/master/tutorials/cooking.md)
5. Pantri, [Product page](https://pantri.devalab.app/)
6. Zoku, [Shared shopping list](https://www.myzoku.fr/en/liste-de-courses-partagee)
7. Mealuna, [Product page](https://mealuna.varres.ee/)
8. Kitchen Pantri, [Product page](https://www.kitchenpantri.com/)
9. OurGroceries, [User Guide](https://www.ourgroceries.com/user-guide)
10. AnyList, [Lists](https://www.anylist.com/lists) und [Meal Planning](https://www.anylist.com/meal-planning)
11. Bring!, [Collaborative](https://www.getbring.com/en/features/collaborative)
12. Cozi, [FAQ](https://www.cozi.com/faq/) und [Shopping Lists](https://www.cozi.com/getting-started-with-cozi-shopping-lists/)
13. Pepperjack, [Product page](https://pepperjack.app/)
14. Helpings, [Product page](https://www.gethelpings.com/)
15. SwiftLists, [Product page](https://swiftlists.app/)
16. hmly, [German App Store listing](https://apps.apple.com/de/app/hmly-vorr%C3%A4te-rezepte-plan/id6758858235)
17. mitlist, [Product page](https://mitlist.me/)
18. Cravly, [Product page](https://www.cravly.app/)
19. GroceryShare, [Product page](https://groceryshare.app/)
20. HNGRY, [Terms of use](https://iamhngry.com/nutzungsbedingungen/)
21. Olio, [Google Play listing](https://play.google.com/store/apps/details?id=com.olioex.android) und [How to use](https://olioapp.com/en/getting-started-on-olio/discover-the-olio-app/)

