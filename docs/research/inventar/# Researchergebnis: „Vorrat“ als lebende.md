# Researchergebnis: „Vorrat“ als lebendes Haushaltsmodell statt als Inventarliste

Die zentrale Erkenntnis aus der Recherche ist: **Das eigentliche Produkt ist nicht das Inventar und auch nicht die Einkaufsliste. Es ist der Kreislauf „zu Hause → wird knapp / muss verbraucht werden → Einkauf → wieder zu Hause“.** Genau an diesem Übergang liegt die größte UX-Chance.

Die Wettbewerber haben viele Einzelbausteine bereits gelöst. Kaum einer macht daraus jedoch ein wirklich leichtgewichtiges, visuelles Haushaltsmodell, bei dem **der Einkauf den Vorrat automatisch aktualisiert und der Vorrat wiederum die nächste Kaufentscheidung intelligent beeinflusst**, ohne dass der Nutzer ständig „Inventar pflegen“ muss.

Für eine Mobile-first-App würde ich deshalb nicht „eine bessere Vorratsliste“ bauen, sondern eine **Anti-Food-Waste-Control-Center für den Haushalt**.

![Image](https://kitchenpalapp.com/images/common-right.webp)

![Image](https://fastly.mwm-storage.mwmcdn.com/raw_files/710387ed-13d8-4629-a851-ea530444b16c?format=webp\&height=1280)

![Image](https://images.openai.com/static-rsc-4/F-7L3NDzIt9kWduXV8OfA28ycwUtlexKG2DWWqsY_QIom-6qxz9DMnUA4bkJABKgWSnJ1hnRpIsBd4Pvr3oy_4u4479Q_ZWtYc0PR3w0a5XXVc-u0_z4dmUGGzoGozOq5722f8Wj7mKI23FK88rIu9QppMrBdCCJEmrC_cig5lz2CD8z8EOmpSdKQRQSayD4?purpose=fullsize)

![Image](https://pantrywiseapp.com/screenshot-pantry.png)

![Image](https://cdn.sanity.io/images/fl949yr7/production/cc129d6e8445d899bb742d721c82168c0c6f0679-707x1080.png?auto=format\&fit=clip\&q=85)

---

# 1. Welche UX-Patterns und visuellen Designs nutzen KitchenPal, Your Food, PantryVault, NoWaste und zimmerfood – und wo liegen die gemeinsamen Schwachstellen?

## Wettbewerbsvergleich

| Produkt         | Inventar-Pattern                                                         | Produktübernahme / Einkauf                                                              | Kategorien / Lagerorte                                                  | Ablaufdaten                                                       | Besonders stark                                                            | Schwächen / Chance                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **KitchenPal**  | Karten/Listen, Single-Screen oder Multi-Tabs nach Lagerort               | Einkaufsliste → beim „Finish Shopping“ gekaufte Artikel automatisch in „Kitchen“        | Pantry, Kühlschrank, Gefrierfach etc.; Kategorien teilweise automatisch | Sortierung nach Ablaufdatum, Warnungen                            | Sehr gut verknüpft mit Rezepten, Shopping und Bestand                      | Viele Funktionen; Auto-Kategorisierung kann falsch sein; Nutzer berichten über Barcode- und Mengenprobleme                                                                    |
| **Your Food**   | stark visuelle Listen mit Illustrationen, Lagerlisten + Unterlisten      | bidirektional: Vorrat → Einkauf; gekauft → mit einem Tap zurück in Vorrat               | sehr flexibel: Orte, Listen, Unterlisten                                | explizit, individualisierbare Erinnerungen, „was zuerst dran ist“ | Sehr klarer „Stock ↔ Shopping“-Kreislauf und sympathische visuelle Sprache | Visuell teilweise verspielt/unübersichtlich; Barcode/Erfassung bleibt Feedschritt                                                                                             |
| **PantryVault** | bewusst „tactile“, List/Grid/Sections/Action; neuere Batch-Interaktionen | Einkauf und Inventar zunehmend eng gekoppelt; „Use Item“, Low Stock und Smart Refill    | Pantry/Fridge/Freezer + Kategorien                                      | Expiring-Soon, Widgets                                            | Sehr moderne Interaktionslogik, Batch-Use, Widgets, Smart Refill           | Noch relativ jung; kleine Reviewbasis; primär iOS                                                                                                                             |
| **NoWaste**     | klassische strukturierte Listen nach Fridge/Freezer/Pantry               | Shopping List vorhanden; Verbrauch und Inventar müssen stärker explizit gepflegt werden | Kategorien + Platzierung + Sortierung                                   | Ablaufdatum ist zentral, bis hin zu Expiry-Sortierung             | Breites Capture-Angebot: Barcode, Foto, Bon, AI; hohe Funktionsbreite      | Genau dort hoher manueller Aufwand; Nutzerberichte zu falschen Datumswerten, Scans und fehlender Automatisierung                                                              |
| **zimmerfood**  | **nicht belastbar verifizierbar**                                        | **nicht belastbar verifizierbar**                                                       | **nicht belastbar verifizierbar**                                       | **nicht belastbar verifizierbar**                                 | –                                                                          | Unter diesem exakten Namen ließ sich in der aktuellen Webrecherche kein ausreichend belastbarer, aktueller Produkt-/Store-Auftritt finden; daher keine erfundenen UX-Aussagen |

### KitchenPal

KitchenPal ist einer der stärksten Wettbewerber bei der **Verknüpfung der Funktionsbereiche**. Die App unterstützt Pantry, Kühlschrank und Gefrierschrank, Mengen, Ablaufdaten, gemeinsame Haushaltsnutzung und Shopping. Besonders interessant ist der Checkout-Flow: Nutzer markieren Produkte beim Einkauf und mit „Finish Shopping“ werden gekaufte Produkte automatisch ins Kücheninventar verschoben; nicht gekaufte Produkte können in eine neue Einkaufsliste übernommen werden. Außerdem können Produkte bei niedrigem Bestand oder nach bestimmten Ablaufbedingungen automatisch vorgeschlagen werden. ([App Store][1])

Die Inventaransicht arbeitet je nach Nutzung mit einer kompakten Single-Screen-Struktur oder mehreren Lagerort-Tabs. Es gibt Sortierungen nach Ablaufdatum, Kategorie, Name oder zuletzt hinzugefügt. ([KitchenPal][2])

Die Schwächen sind gerade deshalb relevant: Nutzer berichten von fehlerhafter Barcode-Erkennung, falschen Produktbildern, zu komplexer Kategorisierung und problematischen Einheiten. Ein aktueller Review beschreibt die automatische Kategorisierung als so schwierig, dass Produkte schlechter auffindbar werden. Andere Reviews kritisieren zu grobe Kategorien wie „Pantry“ für viele unterschiedliche Vorratsprodukte. ([Google Play][3])

**Design-Lehre:** Automatische Struktur ist nur dann hilfreich, wenn Nutzer sie nicht bekämpfen müssen. Das System sollte deshalb **„soft structure“** statt starrer Kategorisierung verwenden.

---

### Your Food

Your Food ist für die Fragestellung besonders interessant, weil es den gewünschten Zusammenhang sehr explizit modelliert: Ein Produkt kann vom Vorrat auf die Einkaufsliste wandern, ohne Name, Einheit oder Icon neu einzugeben; nach dem Einkauf wird es mit einem Tap wieder in den passenden Vorrat gelegt. Die App unterstützt außerdem Lagerorte, Unterlisten, Echtzeit-Haushaltssynchronisation, Such- und Filterfunktionen sowie individualisierbare Ablauf-Erinnerungen. ([YourFood][4])

Visuell setzt Your Food auf eine **illustrierte Produktwelt** mit über 1.000 Icons. Das Ziel ist ausdrücklich, lange Listen visuell scanbar zu halten. ([YourFood][5])

Das funktioniert offenbar gut: Nutzer loben die Icons und die Möglichkeit, bereits vorhandene Produkte bzw. Duplikate beim Einkauf zu erkennen. Gleichzeitig gibt es Hinweise auf eine gewisse Einstiegshürde und auf Probleme rund um Barcode-Scanning. Ein aktueller deutscher Review empfindet die verspielte Darstellung teilweise als unübersichtlich. ([App Store][6])

**Design-Lehre:** Visuelle Identität kann Informationsdichte deutlich reduzieren, aber **Illustration darf niemals die Statusinformation überdecken**.

---

### PantryVault

PantryVault ist ein interessanter Newcomer, weil die App bewusst versucht, Inventar **visuell und haptisch** wirken zu lassen. Die Website beschreibt Pantry, Kühlschrank und Tiefkühler als einheitliche Bereiche; Kategorien, Barcode-Erfassung, Low-Stock-Indikatoren und Ablauf-Erinnerungen gehören zum Kern. Die App hat inzwischen mehrere Darstellungsmodi, darunter List, Grid und Sections. ([PantryVault][7])

Noch interessanter sind die Interaktionen: Batch-Scan zum Hinzufügen und Verwenden, „Use Item“, Batch-Mengenänderungen, konfigurierbare Low-Stock-Schwellen und Widgets für „Expiring Soon“ bzw. Low Stock. In der aktuellen Version kommen Smart Refill, Rescue Meals und personalisierte Restock-Empfehlungen hinzu. ([App Store][8])

Ein Review beschreibt genau das gewünschte Nutzungserlebnis: einfach scrollen, den Bestand ansehen und beim Einkaufen feststellen, ob man etwas tatsächlich braucht – ohne zusätzliche Spielereien. ([App Store][9])

**Design-Lehre:** Die interessanteste Weiterentwicklung liegt nicht in noch mehr Datenfeldern, sondern in **Batch-Interaktionen + kontextbezogenen Aktionen**.

---

### NoWaste

NoWaste ist deutlich funktionsreicher und bietet klassische Inventarlisten für Kühlschrank, Gefrierschrank und Pantry, Kategorien, Sortierung nach Ablaufdatum/Name/Kategorie, Filter nach Kategorie und Platzierung sowie Barcode-, Bon-, Foto- und AI-Erfassung. Außerdem existiert eine Produktbibliothek und eine Funktion zum Nachschauen, ob ein bestimmtes Produkt bereits im Haushalt liegt. ([NoWaste][10])

Das Problem ist interessant: **Je mehr Erfassungsfunktionen vorhanden sind, desto stärker wird die Gefahr, dass Inventarpflege selbst zum Job wird.** In Reviews werden falsche Ablaufdaten, unzuverlässige Barcode-Erkennung und sehr viel manuelle Nachbearbeitung kritisiert. Besonders aufschlussreich ist der Wunsch eines Nutzers, dass ein neu eingetragenes Produkt automatisch mit einem bestehenden Einkaufsliste-Eintrag verbunden und abgearbeitet wird. ([App Store][11])

Die aktuelle Produktentwicklung versucht, diese Problematik mit Batch-Editing und verbesserten Erfassungs- und KI-Funktionen zu entschärfen. ([App Store][12])

**Design-Lehre:** Mehr AI/Capture ist nicht automatisch besser. **Die eigentliche Innovation ist weniger Eingabe**, nicht mehr Eingabeoptionen.

---

### zimmerfood

Unter der exakten Bezeichnung **„zimmerfood“** konnte ich in der aktuellen Webrecherche keinen belastbaren aktuellen App-/Produktauftritt finden. Deshalb würde ich hier bewusst keine UX-, Feature- oder Wettbewerbsbehauptungen erfinden.

Für eine spätere Konkurrenzanalyse wäre das der eine Datensatz, den ich mit einem direkten Store-Link oder Screenshot ergänzen würde.

---

# 2. Welche gemeinsamen UX-Schwächen zeigen sich?

Aus Wettbewerbern, Nutzerreviews und Forschung ergeben sich fünf besonders klare Problemfelder.

## A. Das Inventar ist oft eine Datenbank – kein Abbild des Haushalts

Viele Apps zeigen im Grunde:

> Produkt → Menge → Ablaufdatum → Kategorie

Das ist korrekt, aber mental relativ abstrakt.

Der Nutzer denkt jedoch eher:

> „Was ist gerade im Kühlschrank?“
> „Was muss zuerst weg?“
> „Was haben wir noch zweimal?“
> „Was sollte ich beim nächsten Einkauf nicht vergessen?“

CozZo hat deshalb bereits mit einer visuellen „At Home“-Darstellung und Lagerort-orientierter Sicht experimentiert. Forschung zu Food-Management-Apps zeigt ebenfalls, dass **Inventarlisten und Fotos des Kühlschranks das Wissen über den tatsächlichen Bestand verbessern können**. ([MDPI][13])

### Konsequenz

„Vorrat“ sollte primär beantworten:

**Was ist in unserem Haushalt gerade relevant?**

und nicht:

**Welche Datensätze existieren?**

---

## B. Ablaufdatum wird häufig als Metadatum behandelt statt als Handlungssignal

Das klassische Muster lautet:

> Joghurt — 18.09.2026

Das ist Information, aber keine Entscheidungshilfe.

Besser:

> **Joghurt**
> 🟠 **noch 2 Tage**
> → „Heute einplanen“

Genau in diese Richtung gehen Smantry und CozZo. Smantry bringt „Expiring Soon“ inzwischen sogar als iOS-/Android-Widget auf den Home-Screen und unterscheidet „überfällig“, „heute“ und „in den nächsten Tagen“ visuell. ([Smantry][14])

CozZo nutzt zusätzlich eine visuelle „Due Time“-Darstellung und unterscheidet zwischen „Use By“ und „Best By“. ([Cozzo][15])

### Konsequenz

**Ablaufdaten sollten nie nur Daten sein. Sie sollten Zustände sein.**

Zum Beispiel:

* 🟢 **Alles gut**
* 🟡 **bald verbrauchen**
* 🟠 **heute einplanen**
* 🔴 **dringend**
* ⚪ **lange haltbar / keine Priorität**

---

## C. Produktkategorisierung ist nützlich, aber reale Haushalte folgen nicht einer Taxonomie

KitchenPal hat vordefinierte Kategorien, die automatisch befüllt werden können; Nutzer berichten jedoch, dass die automatische Kategorie teilweise falsch ist oder zu grob bleibt. ([KitchenPal][2])

Pantrist verfolgt ein flexibleres Modell: Lagerorte, mehrere MHDs, Mindestbestände und eigene Strukturen können miteinander kombiniert werden. ([Pantrist][16])

Apple Reminders zeigt ein interessantes allgemeines Pattern: Produkte werden automatisch in Grocery-Kategorien sortiert, können aber per Drag-and-drop korrigiert werden; die App merkt sich die manuelle Präferenz. ([Apple Support][17])

### Konsequenz

Die beste Lösung ist vermutlich:

**Automatisch sortieren + jederzeit leicht korrigierbar + Nutzerpräferenzen lernen.**

Nicht:

**starres Kategorie-System oder komplett manuelle Struktur.**

---

## D. Die größte Reibung entsteht durch doppelte Dateneingabe

Das ist vermutlich die wichtigste Erkenntnis für eure Produktarchitektur.

Eine klassische App macht:

1. Einkaufsliste erstellen
2. Einkauf abhaken
3. Produkte erneut ins Inventar eintragen
4. Menge eingeben
5. Ablaufdatum eingeben
6. Lagerort eingeben

Das ist exakt der Grund, warum viele Systeme irgendwann nicht mehr gepflegt werden.

Eine Studie zu einer integrierten Food-Management-App kommt zu einem sehr ähnlichen Schluss: Produkte, die auf einer Einkaufsliste abgehakt werden, direkt ins Inventar zu übernehmen, reduziert die Pflegekosten erheblich und nutzt eine bestehende Gewohnheit – das Erstellen einer Einkaufsliste. ([MDPI][18])

Auch CozZo und KitchenPal verfolgen diesen Gedanken: Einkäufe werden automatisiert bzw. mit minimalen Eingriffen in das Haushaltsinventar überführt. ([Cozzo][19])

---

# 3. Was sagt die Forschung über Lebensmittelverschwendung und digitale Interventionen?

Die Forschung unterstützt ziemlich klar einen **integrierten Kreislauf aus Bestand + Einkauf + Ablauf + Handlung**.

Bei CozZo wurde die Anwendung in rund 50 Haushalten in Österreich, Finnland und Griechenland untersucht; berichtet wurden Verbesserungen beim Bewusstsein über Bestände, Ablaufdaten und Einkaufsplanung. Die Intervention war mit einer durchschnittlichen Verringerung von Food Waste um rund 43 % verbunden, wobei die Studie auch klar auf den Aufwand der Dateneingabe und Schwierigkeiten bei Ablaufprognosen hinweist. ([Zenodo][20])

Eine weitere Studie zu FoodSaveShare kombiniert Einkaufsliste, automatisch bzw. näherungsweise berechnete Ablaufdaten, Benachrichtigungen, Verbrauch/Waste-Logging und Rezeptvorschläge. Besonders interessant ist die Kette:

**Einkauf → Inventar → Ablauf → Rezept → Verbrauch/Waste → Lernsignal.** ([MDPI][21])

In einer aktuellen Studie mit 126 Haushalten reduzierte eine gamifizierte Self-Monitoring-Intervention die durchschnittliche wöchentliche Lebensmittelverschwendung in der Interventionsgruppe um 190 g bzw. 45 %; die Autoren fanden zugleich, dass bestimmte Verhaltensweisen wie „früher erkennen“, „sichtbarer platzieren“ und „früher verbrauchen“ beeinflusst wurden. ([Sciety][22])

Wichtig ist auch: Digitale Erfassung darf nicht zu aufwendig sein. Eine Untersuchung zur FoodImage-App zeigte gegenüber Tagebuchmethoden einen deutlichen Zeitvorteil; die Teilnehmer bewerteten den fotografischen Ansatz als weniger zeitaufwendig. ([PubMed Central (PMC)][23])

**Das bestätigt eure Grundannahme sehr stark:**
Nicht die perfekte Inventarisierung ist das Ziel, sondern **möglichst wenig Aufwand für möglichst viel Aktualität**.

---

# 4. Welche innovativen Inventar-Interaktionsparadigmen existieren außerhalb der Food-Kategorie?

Hier liegen einige der interessantesten Chancen.

## Paradigma 1: Visuelle Regale statt Listen

Aus allgemeinen Inventarsystemen wie Sortly kommt ein sehr relevantes Pattern: Produkte werden mit Fotos, Tags, Ordnern und Lagerorten visuell organisiert. Dadurch kann ein Nutzer Varianten leichter wiedererkennen als über reinen Text. ([Sortly][24])

Notion verwendet mit seiner Gallery View ebenfalls Karten mit Bildern und Properties, die gefiltert und gruppiert werden können. ([Notion][25])

### Übertragung auf „Vorrat“

Statt:

```text
Milch         2 × 1 L       19.09.
Tomaten       4 × 500 g     17.09.
Mozzarella    1             16.09.
```

könnte die App eine **virtuelle Haushaltslandschaft** zeigen:

```text
KÜHLSCHRANK

┌─────────┐ ┌─────────┐ ┌─────────┐
│ 🥛      │ │ 🍅      │ │ 🧀      │
│ Milch   │ │ Tomaten │ │ Mozz.   │
│ 2       │ │ 4       │ │ 1       │
│ 4 Tage  │ │ 2 Tage  │ │ 1 Tag   │
└─────────┘ └─────────┘ └─────────┘
```

Dabei muss das nicht wie eine fotorealistische 3D-Simulation aussehen. **Eine abstrahierte Regal-/Zonenansicht reicht.**

---

# 5. Noch spannender: „Household Map“ statt „Inventory“

Ich würde sogar noch einen Schritt weiter gehen.

Das bisherige Konzept:

**Inventar**

sollte eigentlich heißen:

**Unser Haushalt**

mit Zonen:

* Kühlschrank
* Gefrierschrank
* Vorratsschrank
* Keller
* ggf. Balkon / Getränkekühlschrank

Der Nutzer zoomt in eine Zone hinein.

### Beispiel

**Heute**

> 🟠 4 Lebensmittel bald verbrauchen
> 🛒 6 Dinge fehlen
> 🟢 83 Lebensmittel vorhanden
> ♻️ 3 Lebensmittel diese Woche gerettet

Darunter:

**Kühlschrank**

> 🥬 Salat — heute
> 🥛 Milch — morgen
> 🧀 Käse — 4 Tage

Dann:

**Vorratsschrank**

> 🍝 Pasta × 5
> 🥫 Tomaten × 3
> 🫘 Bohnen × 2

Das ist wesentlich näher an der mentalen Vorstellung eines Haushalts als eine flache Liste.

---

# 6. Paradigma 2: „Ambient Information“

Ein sehr starkes Muster kommt aus Smart-Home-Systemen: Informationen müssen nicht immer aktiv geöffnet werden.

Samsung setzt bei seinen Family-Hub-Geräten auf genau dieses Prinzip: Kamera/AI erfasst Lebensmittel, der Kühlschrank kennt seinen Inhalt und Shopping-/Food-Informationen werden geräteübergreifend verfügbar. ([Samsung se][26])

Smantry überträgt dasselbe Prinzip inzwischen auf normale Smartphones:

> Ein Blick auf den Home-Screen reicht, um zu sehen, was bald abläuft.

Das „Expiring Soon“-Widget funktioniert auf iOS und Android und öffnet beim Antippen direkt die relevante gefilterte Liste. ([Smantry][14])

### Für eure App wäre das enorm relevant

Nicht nur:

> „Du hast eine Benachrichtigung.“

Sondern:

> **Heute retten: 3 Lebensmittel**

mit kleinen Produktchips auf dem Home-Screen.

Das reduziert die mentale Hürde, die App überhaupt erst zu öffnen.

---

# 7. Paradigma 3: Kontextbezogene Erinnerungen statt klassische Notifications

Google Keep nutzt Zeit- und ortsbasierte Reminder, damit eine Erinnerung am relevanten Kontext erscheint. ([Google Blog][27])

Für Food Management lässt sich daraus etwas viel Interessanteres machen:

### Zuhause

> „Der Brokkoli sollte heute verbraucht werden.“

### Beim Öffnen der Einkaufsliste

> „Du möchtest Tomaten kaufen. Du hast noch 4 Stück zu Hause.“

### Im Supermarkt

> „Mozzarella steht auf deiner Liste. 1 Packung ist noch vorhanden.“

### Beim Erstellen eines Einkaufs

> „Du kaufst Milch gewöhnlich alle 6–7 Tage. Letzter Einkauf war vor 3 Tagen.“

Damit wird die App **situativ intelligent**, statt ständig allgemeine Push Notifications zu senden.

---

# 8. Paradigma 4: Streaks – aber nicht als „Punkte sammeln“

Gamification kann wirken, sollte beim Anti-Food-Waste-Produkt aber nicht wie ein Spiel wirken.

Finch zeigt ein gutes Pattern: kleine tägliche Aktionen, sanfte Streaks, Belohnungen und ein emotionaler Begleiter statt harter Gamification. ([Finch Care][28])

Duolingo zeigt zusätzlich den Wert sozialer Verantwortung: gemeinsame Streaks können die Wahrscheinlichkeit erhöhen, dass Nutzer eine Handlung ausführen. ([Duolingo Blog][29])

Für Food würde ich daraus aber etwas anderes machen:

### Nicht

> 🔥 14 Tage Vorrat gepflegt

Das belohnt eine Datenpflege.

### Sondern

> ♻️ **Diese Woche 7 Lebensmittel gerettet**

oder

> 🥕 **0 Lebensmittel weggeworfen**

oder

> 💚 **3 Mahlzeiten aus vorhandenen Zutaten**

Die Belohnung sollte **Vermeidung von Verschwendung** sichtbar machen, nicht App-Nutzung.

---

# 9. Paradigma 5: Das System sollte lernen, nicht nur speichern

Hier liegt vermutlich die größte Produktchance.

KitchenPal hat bereits Vorschläge auf Basis von häufig gekauften und zur Neige gehenden Produkten. Pantrist arbeitet mit Mindestbeständen. PantryVault entwickelt Smart Refill. CozZo nutzt Vorschläge und Auto-Update-Algorithmen. ([KitchenPal][30])

Der nächste Schritt wäre eine **Haushaltsroutine-Engine**.

Beispiel:

> Milch
> Bestand: 1
> Durchschnittlicher Verbrauch: 1,3 Packungen / Woche
> Nächster typischer Einkauf: Donnerstag
> → **Empfehlung: 2 × Milch**

Oder:

> Eier
> Bestand: 5
> Durchschnittlicher Bestand beim Einkauf: 8
> Verbrauch hoch
> → **wahrscheinlich bald nachkaufen**

Das ist interessanter als ein einfacher „Low Stock“-Schwellwert.

---

# 10. Das wichtigste neue Konzept: „Demand Forecasting für den Haushalt“

Der Vorrat sollte nicht nur sagen:

> „Du hast noch 1.“

Er sollte irgendwann sagen:

> **„Das reicht vermutlich noch 3 Tage.“**

Daraus ergibt sich:

**Bestand → Verbrauchsgeschwindigkeit → erwarteter Bedarf → Einkaufsempfehlung**

Beispiel:

```text
🥛 Milch

Aktuell       0,5 L
Verbrauch     ~0,25 L / Tag
Reicht noch   ~2 Tage
Nächster Einkauf: Donnerstag

→ Auf Einkaufsliste setzen?
   [Ja] [Nicht jetzt]
```

Das wäre deutlich intelligenter als reine Mindestbestände.

---

# 11. Noch wichtiger: Einkauf sollte nicht nur „gekauft / nicht gekauft“ kennen

Der ideale Einkaufsworkflow wäre:

### Vor dem Einkauf

> 12 Dinge auf Liste
> 4 davon sind eigentlich noch vorhanden
> 2 davon bald leer
> 3 davon wegen ablaufender Zutaten relevant

Die App könnte dann sagen:

> **Deine Liste optimieren?**

→ 4 Duplikate entfernen
→ 2 Mengen reduzieren
→ 1 Produkt ergänzen

Damit wird die Einkaufsliste zu einem **Live-Abbild der aktuellen Bedarfslage**.

---

# 12. Empfohlenes Datenmodell für die UX

Ich würde Produktzustände deutlich von Produktstammdaten trennen.

Ein Produkt hat:

**Produkt**

> Milch

und einen oder mehrere **Bestandsobjekte**:

> Milch #1
> 1 L
> Kühlschrank
> MHD 18.09.

> Milch #2
> 1 L
> Kühlschrank
> MHD 23.09.

Das ist relevant, weil PantryVault und insbesondere CozZo bereits zeigen, dass gleiche Produkte mehrere Chargen bzw. unterschiedliche Ablaufdaten haben können. CozZo legt bei einem Neukauf eines bereits vorhandenen Produkts bewusst einen neuen Eintrag an, damit alte und neue Ablaufdaten getrennt bleiben. ([Cozzo][19])

Das ermöglicht **FEFO**:

> First Expire → First Out

statt nur:

> First In → First Out

---

# 13. So würde ich die Mobile-First-Informationsarchitektur aufbauen

Ich würde nicht mit „Inventar“ als einer riesigen Liste starten.

## Home

**„Was ist gerade wichtig?“**

```text
Guten Morgen

🔴 HEUTE RETTEN
2 Lebensmittel

🟠 BALD VERBRAUCHEN
5 Lebensmittel

🛒 EINKAUF
8 Artikel

🏠 VORRAT
67 Artikel

♻️ DIESE WOCHE GERETTET
€ 11,40
```

## Vorrat

Nicht sofort alle 67 Artikel, sondern:

**Alle | Kühlschrank | Gefrierfach | Vorrat**

und darüber:

> „Sortieren nach: Relevanz / Ablauf / Menge / Ort“

Die Default-Sortierung sollte **Relevanz**, nicht Alphabet sein.

---

# 14. Die eigentliche Vorratsansicht

Ich würde ein Hybrid-Pattern aus **visuellen Karten + semantischer Dringlichkeit** wählen.

### Produktkarte

```text
┌───────────────────────────────────┐
│ 🥛                              2 │
│ Vollmilch 1,5 %                   │
│                                   │
│ 🟠 noch 2 Tage                    │
│ Kühlschrank                       │
│                                   │
│  −         2         +            │
└───────────────────────────────────┘
```

Swipe Actions:

**→ verbraucht**
**← Einkauf**

Long Press:

**Menge ändern / verschieben / MHD / löschen**

Das kombiniert die Einfachheit von PantryVault mit dem Informationsreichtum von KitchenPal und Your Food. ([App Store][8])

---

# 15. Entscheidend: „Verbraucht“ muss die primäre Aktion sein

Die meisten Inventarsysteme behandeln Entfernen als Ausnahme.

Für Anti-Food-Waste ist aber genau das Gegenteil sinnvoll:

**Lebensmittel werden normalerweise verbraucht.**

Daher:

> „1 verwenden“

soll eine First-Class-Aktion sein.

PantryVault zeigt bereits in diese Richtung mit „Use Item“ und Batch-Use. ([App Store][8])

Eine noch bessere Variante:

### Swipe nach links

> **+1 verwendet**

### Swipe erneut

> **+1 verwendet**

Kein Öffnen eines Formulars.

So bleibt der Bestand realistisch, ohne dass Pflege zur Aufgabe wird.

---

# 16. Der zentrale UX-Flow: Einkauf → Vorrat

Das sollte das Herzstück werden.

## Schritt 1: Liste

```text
EINKAUF

🥛 Milch        2
🍝 Pasta        1
🥦 Brokkoli     1
🧀 Mozzarella   2
```

## Schritt 2: Im Laden

Artikel abhaken.

## Schritt 3: Checkout

Die App erkennt:

> 4 von 5 Artikeln gekauft.

Dann nicht einfach alles still übertragen, sondern **einen schnellen „Receive“-Moment**:

```text
NEU ZU DEINEM VORRAT

🥛 Milch
2 × 1 L
Kühlschrank
MHD automatisch: 19.09.

🥦 Brokkoli
1 Stück
Kühlschrank
am besten bald verbrauchen

[Alles übernehmen]
```

Nur Sonderfälle werden abgefragt.

---

# 17. Automatisierung sollte kontextuell sein

Für normale Produkte:

**keine Nachfrage**

> Milch → Kühlschrank
> MHD = automatisch vorgeschlagen
> Menge = von Einkauf übernommen

Bei frischen Produkten:

> „Brokkoli: MHD übernehmen oder 3 Tage schätzen?“

Bei Unsicherheit:

> „Wo möchtest du es lagern?“

Das entspricht der Forschungserkenntnis, dass **weniger Dateneingabe**, bessere visuelle Rückmeldung und digitale Nudges die Nutzbarkeit verbessern. ([PolyU Scholars Hub][31])

---

# 18. Ablaufdatum niemals blind vertrauen

Ein wichtiger Punkt aus den NoWaste-Reviews: Falsch erkannte Ablaufdaten können das komplette Vertrauen in das System zerstören. ([App Store][11])

Deshalb sollte die App niemals so aussehen, als sei ein automatisch berechnetes Datum eine sichere Tatsache.

Besser:

> **MHD geschätzt: 21.09.**
> Quelle: „Milch, gekühlt“
> [ändern]

versus

> **MHD: 21.09.**
> Quelle: manueller Scan

Damit wird Transparenz Teil der UX.

---

# 19. Von Inventar zu intelligenter Einkaufsliste

Die Einkaufsliste sollte aus **vier verschiedenen Quellen** gespeist werden:

### 1. Niedriger Bestand

> Milch fast leer

### 2. Verbrauchsprognose

> Milch reicht wahrscheinlich nur 2 Tage

### 3. Ablaufmanagement

Nicht:

> „Joghurt läuft ab → kaufen“

Sondern:

> „Joghurt läuft ab → erst verbrauchen → nicht nachkaufen“

Das ist ein entscheidender Anti-Waste-Unterschied.

### 4. geplante Mahlzeiten

> Rezept benötigt 2 Tomaten
> Bestand 1
> → 1 kaufen

KitchenPal und mehrere aktuelle Wettbewerber gehen bereits in Richtung Rezept-/Inventar-Kopplung; eure Chance wäre, daraus eine allgemeinere Bedarfslogik zu machen. ([App Store][1])

---

# 20. Ein besonders starkes Pattern: „Why is this on my shopping list?“

Intelligente Empfehlungen erzeugen schnell Misstrauen.

Deshalb sollte jede Empfehlung erklärbar sein.

Beispiel:

> 🥛 Milch
> **Empfohlen: 2 Packungen**

Darunter klein:

> „Ihr kauft im Schnitt 2 Packungen / Woche. Aktuell ist noch 0,5 Packung da.“

Oder:

> 🍅 Tomaten
> **Nicht kaufen**

> „3 Stück vorhanden, davon 2 sollten zuerst verbraucht werden.“

Das macht AI/Automatisierung **verständlich und kontrollierbar**.

---

# 21. Was ich ausdrücklich nicht empfehlen würde

## Keine vollwertige „virtuelle 3D-Küche“

Sie sieht spektakulär aus, erhöht aber Interaktions- und Entwicklungsaufwand enorm.

Besser:

**2D-Zonen + visuelle Karten + räumliche Metapher.**

## Keine Pflicht, jedes Produkt perfekt zu erfassen

Das ist einer der Hauptfehler bestehender Systeme.

Besser:

> „80 % automatisch aktuell“
> als
> „100 % theoretisch präzise, aber niemand pflegt es“.

## Keine Gamification für Datenpflege

Nicht „7 Tage hintereinander Inventar gepflegt“.

Gamification sollte reale Ergebnisse belohnen:

> Lebensmittel gerettet
> Einkäufe vermieden
> Reste genutzt

## Keine AI als Selbstzweck

Die aktuelle Produktlandschaft zeigt bereits sehr viel AI: Fotoerkennung, Rezeptgenerierung, Scanner, Sortierung. Gleichzeitig gibt es Nutzer, die bewusst nach **ruhigeren, simpleren Pantry-Apps ohne „AI everywhere“** suchen. ([Reddit][32])

---

# 22. Empfohlenes Zielbild: „Living Pantry“

Ich würde das Konzept intern so beschreiben:

> **Der Vorrat ist ein lebender digitaler Zwilling des Haushalts.**

Er hat drei Zustände:

### ZU HAUSE

> Was haben wir?

### BALD

> Was muss zuerst verbraucht werden?

### BRAUCHEN

> Was wird als Nächstes benötigt?

Und einen Loop:

**Einkaufen → Einlagern → Verbrauch → Bedarf → Einkauf**

---

# 23. Die stärkste mögliche Startseite

Eine mögliche Hierarchie:

```text
VORRAT

Was braucht heute Aufmerksamkeit?

┌─────────────────────────────────┐
│ 🔴 HEUTE                       │
│ 2 Lebensmittel                 │
│                                │
│ 🥬 Salat       heute            │
│ 🥛 Milch       heute            │
│                                │
│ [Jetzt verwenden]              │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🟠 BALD                        │
│ 4 Lebensmittel                 │
│                                │
│ 🍓 Beeren      morgen           │
│ 🧀 Mozzarella  2 Tage           │
│                                │
│ [Alle anzeigen]                │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ 🛒 NÄCHSTER EINKAUF             │
│ 7 Artikel                       │
│                                │
│ 2 automatisch empfohlen         │
│ 1 wegen Mindestbestand          │
│ 4 manuell                       │
│                                │
│ [Liste ansehen]                 │
└─────────────────────────────────┘

67 Lebensmittel zu Hause
♻️ 5 diese Woche gerettet
```

Das ist wesentlich näher an eurem Ziel **„Haushalt darstellen und Food Waste reduzieren“** als ein klassisches Inventar.

---

# 24. Priorisierte Innovations-Roadmap

| Priorität | Konzept                                                  | Nutzen          | Aufwand   |
| --------- | -------------------------------------------------------- | --------------- | --------- |
| **P0**    | Einkauf → Vorrat mit 1-Tap-Übernahme                     | extrem hoch     | mittel    |
| **P0**    | Ablauf als visuelle Dringlichkeit                        | extrem hoch     | niedrig   |
| **P0**    | Verbrauch per Swipe / Stepper                            | extrem hoch     | niedrig   |
| **P0**    | Vorrat ↔ Einkauf echte bidirektionale Datenverbindung    | extrem hoch     | mittel    |
| **P1**    | Visuelle Haushaltszonen                                  | hoch            | mittel    |
| **P1**    | intelligente Einkaufs-Empfehlungen                       | sehr hoch       | hoch      |
| **P1**    | „Warum wird das empfohlen?“                              | hoch            | niedrig   |
| **P1**    | Home-/Lock-Screen-Widgets                                | hoch            | mittel    |
| **P1**    | Chargen / mehrere MHDs pro Produkt                       | hoch            | mittel    |
| **P2**    | Verbrauchsprognose                                       | sehr hoch       | hoch      |
| **P2**    | adaptive Haushaltsroutinen                               | sehr hoch       | hoch      |
| **P2**    | „Rescue Meals“ / Gerichte aus bald ablaufenden Produkten | hoch            | mittel    |
| **P2**    | Waste-Rewards / Fortschritt                              | mittel          | mittel    |
| **P3**    | Kamera-/Regalerkennung                                   | potenziell hoch | sehr hoch |

---

# 25. Meine Designentscheidung für eure App

### Ich würde **nicht** KitchenPal kopieren.

KitchenPal ist funktional sehr vollständig, aber gerade seine Funktionsfülle führt teilweise zu Komplexität und Kategorisierungsproblemen. ([Google Play][3])

### Ich würde **Your Food + PantryVault + Smantry** als Ausgangspunkt kombinieren.

**Von Your Food:**
die direkte bidirektionale Verbindung zwischen Einkauf und Bestand und die visuelle Lesbarkeit. ([YourFood][4])

**Von PantryVault:**
Batch-Aktionen, direkte „Use“-Interaktionen, Low-Stock-Logik, Widgets und intelligente Restock-Funktionen. ([App Store][8])

**Von Smantry:**
Ablaufdaten als **ambient sichtbares Signal** über Widgets und klare Countdown-States. ([Smantry][14])

**Aus der Forschung:**
möglichst wenig manuelle Pflege, sichtbare Handlungsoptionen, direkte Verbindung zwischen Einkauf, Bestand und Verbrauch. ([PolyU Scholars Hub][31])

**Aus Smart Home / Samsung:**
der Haushalt wird als zusammenhängendes System modelliert, nicht als mehrere voneinander getrennte Screens. ([Samsung se][26])

---

# 26. Konkret formuliertes UX-Prinzip

Das wäre mein zentraler Designgrundsatz:

> **„Der Nutzer pflegt den Vorrat nicht. Der Vorrat aktualisiert sich durch das Leben des Haushalts.“**

Das bedeutet:

**Einkaufen** aktualisiert den Bestand.
**Verbrauchen** aktualisiert den Bestand.
**Ablaufdaten** priorisieren Handlungen.
**Bestand** beeinflusst die Einkaufsliste.
**Einkaufsverhalten** verbessert Empfehlungen.
**Waste-Daten** verbessern das System.

Damit wird aus einer Vorratsliste ein **lernendes Haushaltsmodell**.

---

## Gesamtfazit

Die Marktlücke liegt nicht darin, noch eine schönere Pantry-Liste zu bauen. Die Konkurrenz besitzt bereits gute Listen, Kategorien, Scanner, Ablaufdaten, Widgets und Einkaufslisten. Der größere White Space ist ein **nahtloser, nahezu unsichtbarer Kreislauf zwischen Einkauf, Bestand, Verbrauch und nächstem Bedarf**.

Die beste Mobile-first-Lösung wäre deshalb:

**visuelle Haushaltszonen + dringlichkeitsbasierte Vorratsansicht + extrem schnelle Verbrauchsinteraktion + 1-Tap-Einkaufsübernahme + lernende Bedarfsvorschläge + kontextbezogene Anti-Waste-Nudges.**

Der Nutzer sollte möglichst selten das Gefühl haben, „Inventar zu verwalten“. Stattdessen soll die App immer wieder den nächsten sinnvollen Schritt anbieten:

> **„Das hast du.“**
> **„Das solltest du zuerst verbrauchen.“**
> **„Das brauchst du wahrscheinlich bald.“**
> **„Das musst du nicht kaufen.“**

Genau diese vier Aussagen würden den Unterschied zwischen einer **Inventar-App** und einem echten **Food-Management-System für den Haushalt** ausmachen.

[1]: https://apps.apple.com/de/app/kitchenpal-bestandsverfolgung/id1084982489?utm_source=chatgpt.com "‎KitchenPal: Bestandsverfolgung‑App – App Store"
[2]: https://www.kitchenpalapp.com/de/faqs/kitchen.html?utm_source=chatgpt.com "Küchenfragen, Tipps und hilfreiche Antworten | KitchenPal"
[3]: https://play.google.com/store/apps/details?hl=en_US&id=fr.icuisto.icuisto&utm_source=chatgpt.com "KitchenPal: Pantry Inventory - Apps on Google Play"
[4]: https://yourfood.app/de/?utm_source=chatgpt.com "Your Food: Vorrats-App mit Haltbarkeitsdatum"
[5]: https://yourfood.app/features/?utm_source=chatgpt.com "Features: inventory, expiration dates and sharing, Your Food"
[6]: https://apps.apple.com/de/app/your-food-vorrat-einkauf/id6473174562?utm_source=chatgpt.com "‎Your Food - Vorrat & Einkauf‑App – App Store"
[7]: https://www.pantryvault.app/?utm_source=chatgpt.com "PantryVault — The Elegantly Simple Pantry & Fridge Tracker for iOS"
[8]: https://apps.apple.com/cz/app/pantryvault/id6755187375?utm_source=chatgpt.com "‎PantryVault App - App Store"
[9]: https://apps.apple.com/us/app/pantryvault/id6755187375?utm_source=chatgpt.com "‎PantryVault App - App Store"
[10]: https://www.nowasteapp.com/?utm_source=chatgpt.com "NoWaste | Food inventory management with AI"
[11]: https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004?utm_source=chatgpt.com "‎NoWaste: Food Inventory List App - App Store"
[12]: https://apps.apple.com/de/app/nowaste-lebensmittelliste/id926211004?utm_source=chatgpt.com "‎NoWaste: Lebensmittelliste‑App – App Store"
[13]: https://www.mdpi.com/2071-1050/17/14/6392?utm_source=chatgpt.com "The Effects of Interventions Using Support Tools to Reduce Household Food Waste: A Study Using a Cloud-Based Automatic Weighing System"
[14]: https://smantry.com/en/blog/smantry-1-39-widgets-haltbarkeits-dialog/?utm_source=chatgpt.com "Smantry 1.39: Home Screen Widgets, a New Expiry Screen and a Cleanup List | Smantry"
[15]: https://cozzo.app/features/expiry-tracking-progress/?utm_source=chatgpt.com "Expiry Tracking and Progress Reporting • CozZo Smart Kitchen App"
[16]: https://www.pantrist.com/de-DE/app?utm_source=chatgpt.com "Pantrist | Vorrat, Einkauf & Rezepte smarter organisieren"
[17]: https://support.apple.com/en-lamr/105086?utm_source=chatgpt.com "Create grocery lists in Reminders on your iPhone - Apple Support"
[18]: https://www.mdpi.com/2071-1050/15/13/10597?utm_source=chatgpt.com "Less Is More: Preventing Household Food Waste through an Integrated Mobile Application"
[19]: https://cozzo.app/faqs/?utm_source=chatgpt.com "FAQs • CozZo Smart Kitchen App"
[20]: https://zenodo.org/records/14164532?utm_source=chatgpt.com "Mobile Kitchen Management App as an Intervention to Reduce Food Waste in Households - Experiences From Austria, Finland, and Greece | Zenodo"
[21]: https://www.mdpi.com/2071-1050/16/7/2800?utm_source=chatgpt.com "Managing Household Food Waste with the FoodSaveShare Mobile Application"
[22]: https://sciety.org/articles/activity/10.31025/2611-4135/2026.19596?utm_source=chatgpt.com "Effects of a gamified self-monitoring app on household food waste reduction | Sciety"
[23]: https://pmc.ncbi.nlm.nih.gov/articles/PMC7409719/?utm_source=chatgpt.com "The Validity, Time Burden, and User Satisfaction of the FoodImage™ Smartphone App for Food Waste Measurement Versus Diaries: A Randomized Crossover Trial - PMC"
[24]: https://www.sortly.com/features/photos/?utm_source=chatgpt.com "Inventory Photos | Sortly"
[25]: https://www.notion.com/de/help/guides/gallery-view-databases?utm_source=chatgpt.com "Gallery view databases"
[26]: https://www.samsung.com/de/business/refrigerators/french-door/rm90f-36-4-door-french-door-refrigerators-with-ai-home-and-ai-hybrid-cooling-654l-glam-deep-charcoal-rm90f67cecef/?utm_source=chatgpt.com "Business | 2025 Bespoke AI French Door | Schwarz | RM90F67CECEF | Samsung DE"
[27]: https://blog.google/products-and-platforms/products/workspace/google-keep-reminders-tasks-update/?utm_source=chatgpt.com "Google Keep reminders will save to Google Tasks"
[28]: https://help.finchcare.com/hc/en-us/articles/37935669335309-Our-Approach-to-Self-Care?utm_source=chatgpt.com "Our Approach to Self-Care – Finch"
[29]: https://blog.duolingo.com/product-lessons-friend-streak/?utm_source=chatgpt.com "How We Built the Friend Streak on Duolingo"
[30]: https://www.kitchenpalapp.com/de/faqs/shopping.html?utm_source=chatgpt.com "Häufige Fragen zu Einkauf und Einkaufslisten"
[31]: https://research.polyu.edu.hk/en/studentTheses/an-intelligent-system-for-tracking-and-managing-household-food-in/?utm_source=chatgpt.com "An intelligent system for tracking and managing household food inventory - PolyU Scholars Hub"
[32]: https://www.reddit.com/r/pantry/comments/1tguyeg/i_made_an_ios_pantry_app_and_would_love_feedback/?utm_source=chatgpt.com "I made an iOS pantry app and would love feedback from people who actually organize a pantry"











####################################################################################################################
####################################################################################################################
####################################################################################################################
####################################################################################################################
Ja — ich würde das als **konkretes Mobile-UI-Mockup** formulieren, sodass man es direkt in Figma, für Wireframes oder für einen Design-Prompt übernehmen kann.

# Mobile Mockup: „Vorrat“

## Grundidee

Die Seite „Vorrat“ stellt nicht einfach eine Liste von Lebensmitteln dar, sondern einen **visuellen digitalen Grundriss des Haushalts**.

Der Nutzer sieht auf einen Blick:

**Wo befinden sich Lebensmittel? Was muss zuerst verbraucht werden? Was fehlt bald?**

Die Darstellung basiert auf einer **2D-Zonenansicht mit visuellen Produktkarten**.

---

## Screen 1 – Vorrat / Haushaltsübersicht

**Header**

> Vorrat
> „Was ist gerade wichtig?“

Rechts oben:

> 🔍  Suche

Darunter eine horizontale Navigation:

> **Alles** · Kühlschrank · Gefrierfach · Vorratsschrank

---

### Bereich „Heute wichtig“

Eine große horizontale Karte:

> 🟠 **4 Lebensmittel bald verbrauchen**
>
> 2 heute · 2 morgen
>
> [Ansehen]

Darunter kleine Produktkarten:

> 🥬 Salat
> **heute**
>
> 🥛 Milch
> **heute**
>
> 🍓 Beeren
> **morgen**

Die Ablaufinformation steht dabei deutlich größer als das eigentliche Datum.

---

## Bereich „Dein Haushalt“

Hier beginnt die räumliche Metapher.

### Kühlschrank

Eine große abgerundete Fläche mit einer vereinfachten 2D-Kühlschrankdarstellung.

```text
┌─────────────────────────────┐
│        KÜHLSCHRANK          │
│                             │
│ ┌─────┐ ┌─────┐ ┌─────┐     │
│ │ 🥛  │ │ 🥬  │ │ 🧀  │     │
│ │  2  │ │  1  │ │  1  │     │
│ │ 2 T │ │ HEUTE│ │ 4 T │     │
│ └─────┘ └─────┘ └─────┘     │
│                             │
│ ┌─────┐ ┌─────┐             │
│ │ 🍅  │ │ 🥚  │             │
│ │  5  │ │  8  │             │
│ │ 3 T  │ │ 12 T │            │
│ └─────┘ └─────┘             │
│                             │
│              12 Lebensmittel│
└─────────────────────────────┘
```

Die Produkte erscheinen wie **kleine Objekte im Kühlschrank**, nicht wie klassische Listeneinträge.

Jede Karte zeigt nur die wichtigsten drei Informationen:

**Produkt · Menge · Dringlichkeit**

Beispiel:

> 🥬 Salat
> 1 Stück
> **heute**

---

## Bereich „Vorratsschrank“

Eine zweite räumliche Zone:

```text
┌─────────────────────────────┐
│       VORRATSSCHRANK        │
│                             │
│ 🍝 Pasta      🍅 Tomaten     │
│   ×5            ×3          │
│                             │
│ 🫘 Bohnen     🥫 Sauce       │
│   ×2            ×4          │
│                             │
│ 🍚 Reis       🥣 Müsli       │
│   ×2            ×1          │
│                             │
│              24 Lebensmittel│
└─────────────────────────────┘
```

Hier spielen Ablaufdaten eine geringere Rolle.

Stattdessen steht die **Menge** im Vordergrund.

---

## Bereich „Gefrierfach“

Kompakter dargestellt:

> ❄️ Gefrierfach
> 14 Lebensmittel

Darunter 3–4 Produktkarten.

---

# Produktkarte

Die Produktkarte ist die zentrale UI-Komponente.

```text
┌──────────────────┐
│                  │
│       🥬         │
│                  │
│      Salat       │
│                  │
│      ×1          │
│   🟠 heute       │
│                  │
└──────────────────┘
```

Bei Produkten ohne akute Dringlichkeit:

> 🧀 Käse
> ×1
> **4 Tage**

Bei Produkten mit starkem Handlungsbedarf:

> 🍓 Beeren
> ×1
> **HEUTE VERBRAUCHEN**

Die Farbe wird nur für den **Zustand** verwendet, nicht dekorativ.

---

# Interaktion mit einer Produktkarte

### Tap

Öffnet ein Bottom Sheet:

> **Salat**
>
> 1 Stück
> Kühlschrank
> Ablauf: heute
>
> **Was möchtest du tun?**
>
> **+ Verwenden**
>
> Auf Einkaufsliste
>
> Menge bearbeiten
> Lagerort ändern

---

### Swipe nach links

Direkte Aktion:

> **Verbraucht**

Ein Swipe reduziert die Menge um 1.

Bei Menge 0 verschwindet das Produkt aus dem Vorrat.

---

### Swipe nach rechts

> **Einkauf**

Das Produkt wird direkt auf die Einkaufsliste gesetzt.

---

# Screen 2 – Einkauf → Vorrat

Nach dem Einkauf öffnet die App beim Abschließen der Einkaufsliste automatisch einen kurzen Übergang:

> **Einkauf abgeschlossen 🎉**
>
> 5 Produkte gekauft
>
> Sie werden deinem Vorrat hinzugefügt.

Darunter:

```text
🥛 Milch ×2
→ Kühlschrank

🥦 Brokkoli ×1
→ Kühlschrank

🍝 Pasta ×1
→ Vorratsschrank

🧀 Mozzarella ×2
→ Kühlschrank
```

CTA:

> **Alles in den Vorrat übernehmen**

Darunter klein:

> Automatisch erkannte Lagerorte und Ablaufdaten können angepasst werden.

Der Nutzer muss also **nicht jedes Produkt erneut erfassen**.

---

# Screen 3 – Intelligente Einkaufsliste

Die Einkaufsliste erhält einen neuen Bereich:

> **Empfohlen für deinen nächsten Einkauf**

Beispiel:

```text
🛒 NÄCHSTER EINKAUF

○ Milch ×2
  reicht voraussichtlich noch 2 Tage

○ Eier ×1
  niedriger Bestand

○ Tomaten ×2
  durchschnittlicher Wochenverbrauch

────────────────────

⚠️ NICHT KAUFEN

Tomaten
Du hast noch 4 Stück zu Hause.
```

Damit wird der Vorrat aktiv zur **Entscheidungsgrundlage für den Einkauf**.

---

# Screen 4 – „Heute retten“

Eine spezielle Anti-Food-Waste-Ansicht:

> **Heute retten**
>
> Diese Lebensmittel solltest du zuerst verbrauchen.

Große Karten:

```text
┌─────────────────────────┐
│          🥬             │
│                         │
│        Salat            │
│                         │
│       läuft heute       │
│          ab             │
│                         │
│   [ Verwenden ]         │
└─────────────────────────┘
```

Darunter:

> 💡 **3 mögliche Mahlzeiten**
>
> Salat + Tomaten + Mozzarella
> → Caprese Bowl
>
> Eier + Gemüse
> → Omelette
>
> Joghurt + Beeren
> → Frühstücksbowl

Der Nutzer wird also nicht nur informiert, sondern bekommt direkt eine **Alternative zum Wegwerfen**.

---

# Visuelle Sprache

Die Gestaltung sollte eher wie ein **modernes Smart-Home-Dashboard** wirken als wie eine klassische Verwaltungs-App.

### Charakter

**ruhig · freundlich · räumlich · reduziert · visuell**

Keine überladenen Tabellen.

Keine permanent sichtbaren Zahlenkolonnen.

Stattdessen:

**Produktbild/Icon + Menge + Zustand + Ort**

---

# Wichtigstes UI-Prinzip

Die Hierarchie der Informationen lautet:

**1. Muss ich jetzt handeln?**
↓
**2. Was habe ich?**
↓
**3. Wo liegt es?**
↓
**4. Wie viel habe ich?**
↓
**5. Was brauche ich als Nächstes?**

Nicht:

**Name → Kategorie → Datum → Menge → Bearbeiten**

---

# Die zentrale visuelle Metapher

Der Screen soll sich anfühlen wie:

> **„Ich öffne digital meinen Kühlschrank.“**

Nicht wie:

> **„Ich öffne eine Datenbank mit 67 Datensätzen.“**

Die Kombination aus **2D-Zonen + Produktkarten + Ablaufzuständen** bildet deshalb den Kern des Mockups.

Die wichtigste UI-Komponente ist damit nicht die klassische Listenzeile, sondern die **visuelle Produktkarte innerhalb eines Haushaltsbereichs**.

Für einen echten ersten Figma-Entwurf würde ich daraus als Nächstes **einen konkreten iPhone-Screen mit Layout, Abständen, Navigation, Karten und Beispielinhalten** machen.
