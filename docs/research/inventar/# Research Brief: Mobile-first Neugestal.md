# Research Brief: Mobile-first Neugestaltung von „Vorrat“ und Einkaufsliste

## Executive Summary

Die Wettbewerbsanalyse zeigt einen klaren UX-Befund: **Die meisten Food-Management-Apps behandeln Inventar und Einkaufsliste zwar als verbundene Funktionen, aber noch nicht als einen einzigen kontinuierlichen Haushaltsprozess.** Die stärksten Ansätze sind KitchenPal, Your Food und Pantry Check; Zimmer zeigt zusätzlich einen sehr interessanten Übergang von Einkauf → Vorrat über den Kassenbon. NoWaste geht bei AI, Foto-/Receipt-Scanning und Ablaufdaten weit, bleibt in der Inventardarstellung aber überwiegend listenorientiert. PantryVault positioniert sich stärker über eine ästhetische, „taktile“ Inventory-Metapher, ist aber noch ein junges Produkt. ([App Store][1])

Die wichtigste strategische Schlussfolgerung ist deshalb:

> **„Vorrat“ sollte nicht primär eine Datenbank aller Lebensmittel sein, sondern eine lebendige Darstellung des Haushaltszustands: Was ist da? Was muss zuerst verbraucht werden? Was geht aus? Was sollte deshalb als Nächstes gekauft werden?**

Daraus ergibt sich ein sinnvoller Kreislauf:

**Einkaufsbedarf → Einkaufsliste → Einkauf → Heimbringen → 1-Tap-Übernahme → Vorrat → Verbrauch → „bald leer“ / „bald schlecht“ → Empfehlung → neue Einkaufsliste**

Der entscheidende Innovationspunkt wäre, diesen Kreislauf **nicht über zwei separate Screens**, sondern über ein gemeinsames Produktmodell abzubilden.

---

# 1. Die beiden Pflichtfragen

## 1.1 Welche UX-Patterns und visuellen Designs nutzen KitchenPal, Your Food, PantryVault, NoWaste und zimmerfood für ihre Inventaransicht – und wo liegen gemeinsame Schwachstellen?

### Vergleich auf einen Blick

| Produkt          | Inventar-Pattern                                | Einkauf → Inventar                                       | Ablaufdaten                                     | Kategorisierung / Ort                     | Visuelle Sprache                      | Hauptstärke                           | Hauptschwäche                                  |
| ---------------- | ----------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------- | ------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| **KitchenPal**   | Produktkarten, Grid, Fridge/Pantry/Freezer-Tabs | Verschieben von Vorrat → Einkauf; automatische Checks    | Automatische Schätzung + Warnungen              | sehr stark nach Lagerort                  | farbig, bild-/kartenorientiert        | hoher visueller Überblick             | viele Funktionen, relativ komplex              |
| **Your Food**    | kompakte Listen + Icons                         | **2-Wege-Transfer**, nach Einkauf 1 Tap zurück in Vorrat | individuelle Erinnerungen, „zuerst verbrauchen“ | Orte + Sublists                           | freundlich, ikonisch, leicht          | sehr niedrige Dateneingabe            | weiterhin primär Listenmodell                  |
| **PantryVault**  | separate Pantry/Fridge/Freezer-Ansichten        | Sync mit Einkaufsliste                                   | Expiry Reminders                                | Kategorien + Lagerbereiche                | bewusst hochwertig/taktil             | klare Produktidentität                | noch wenig bewiesenes Ökosystem                |
| **NoWaste**      | Karten-/Listenansicht, Kategorien, Filter       | Inventory ↔ Shopping, Library                            | Sortierung + Kalender + mehrere Erinnerungen    | Fridge/Freezer/Pantry + eigene Kategorien | minimalistisch, utility-orientiert    | sehr umfangreiches Food-Waste-Toolkit | Feature-Dichte kann die Kernaufgabe überlagern |
| **Zimmer**       | Pantry eher als unterstützende Ansicht          | **Receipt Scan → Pantry**                                | weniger zentral                                 | Pantry + Rezept-/Meal-Kontext             | sehr editorial / lifestyle-orientiert | verbindet Einkauf, Pantry und Kochen  | aktuell iPhone-only                            |
| **Pantry Check** | Kategorien als auf-/zuklappbare Gruppen         | **Checkout → Inventar**                                  | visuelle Expiry Progress + Expiring Screen      | Kategorien + eigene Orte                  | informationsdicht, funktional         | sehr klarer Transaktionskreislauf     | weniger „Haushalt als Raum“                    |

### KitchenPal

KitchenPal ist eines der umfassendsten Beispiele. Die App kann Pantry, Kühlschrank, Gefrierschrank, Einkaufsliste, Rezepte und Meal Planning miteinander verbinden. Im Inventar gibt es eine Einzelansicht oder eine **Multi-Tab-Struktur nach Lagerort**; Produktkarten zeigen Bild, Menge und Ablaufinformationen. Produkte können per Drag & Drop zwischen Lagerbereichen bewegt werden. ([KitchenPal][2])

Visuell ist KitchenPal deutlich **karten- und bildorientierter** als klassische Listen. Die offizielle Darstellung zeigt etwa Kühlschrank/Pantry/Freezer als Tabs und Produkte als einzelne Karten mit Produktfoto, Menge, Ablaufzeit und Mengensteuerung.

Interessant für das geplante Konzept ist besonders die Einkaufslogik: KitchenPal generiert Empfehlungen aus „recently finished“, „running low“, häufig gekauften Produkten und Lieblingsrezepten. Zusätzlich können beim Erstellen einer Einkaufsliste vorhandene Zutaten aus dem Vorrat berücksichtigt werden. ([App Store][1])

**UX-Lektion:**
KitchenPal zeigt, dass **Ort + Produkt + Menge + Ablauf** sehr gut in einer Karte funktionieren. Gleichzeitig wird sichtbar, wie schnell eine Food-App überladen wird, wenn Inventar, Rezepte, Ernährung, Shopping und Produktvergleich dieselbe Informationsarchitektur teilen.

---

### Your Food

Your Food ist für die Fragestellung besonders relevant, weil es die gewünschte Verbindung zwischen Vorrat und Einkauf bereits sehr explizit formuliert:

* Produkt aus Vorrat auf Einkaufsliste
* Name, Einheit und Icon werden übernommen
* nach dem Einkauf mit einem Tap zurück in den richtigen Vorrat
* Bestand und Einkaufsliste werden geteilt und synchronisiert. ([YourFood][3])

Die App setzt auf eine **einfache, ikonische Listenstruktur**. Mehr als 1.000 illustrierte Icons sollen lange Bestandslisten visuell scanbarer machen. Gleichzeitig sind Name, Menge, Einheit, Datum, Preis, Notiz und Icon optional – eine wichtige Strategie gegen Erfassungsfriktion. ([YourFood][4])

Besonders interessant ist das zugrunde liegende Prinzip:

> Nicht jedes Lebensmittel braucht dieselbe Menge an Metadaten.

Bei Salz oder Pasta ist ein exaktes Haltbarkeitsdatum wenig wertvoll; bei geöffnetem Joghurt oder Fleisch dagegen sehr relevant. Your Food erlaubt deshalb, Datumsinformationen selektiv zu verwenden. ([YourFood][5])

**UX-Lektion:**
Das stärkste Pattern von Your Food ist nicht die visuelle Gestaltung, sondern die **Reduktion von Doppelarbeit**.

Das ist für das neue Konzept wahrscheinlich wichtiger als Barcode-Scanning:

**Die Einkaufsliste kennt bereits das Produkt. Deshalb sollte der Einkauf nicht anschließend erneut erfasst werden müssen.**

---

### PantryVault

PantryVault verfolgt eine andere Positionierung: „elegantly tactile inventory“ für Pantry, Kühlschrank und Gefrierschrank. Die App betont klare, getrennte Ansichten, Instant Scanning, automatische Kategorisierung, Ablauf-Erinnerungen und Household Sync. Zusätzlich gibt es verschiedene visuelle Themes. ([PantryVault][6])

Das ist interessant, weil PantryVault nicht nur „Inventory Management“ verkaufen möchte, sondern eine **emotionale Beziehung zum Haushaltsinventar** aufbaut.

Die visuelle Metapher „Vault“ macht den Vorrat zu einem **Ort**, nicht bloß zu einer Liste.

Allerdings ist PantryVault noch ein sehr junges Produkt; die App-Store-Präsenz weist aktuell nur wenige Bewertungen aus. ([App Store][7])

**UX-Lektion:**
Die visuelle Qualität des Inventars kann selbst Teil des Produktwerts werden. Allerdings sollte Ästhetik die Informationshierarchie nicht überdecken.

---

### NoWaste

NoWaste verfolgt einen besonders funktionalen Ansatz. Inventare können für **Freezer, Fridge und Pantry** getrennt geführt werden; Produkte lassen sich nach Ablaufdatum, Name oder Kategorie sortieren und nach Kategorie bzw. Lagerort filtern. Die App bietet zusätzlich Barcode-, Foto- und Receipt-Scanning, AI-Unterstützung, Rezepte, eigene Kategorien und einen Ablaufkalender. ([App Store][8])

Besonders interessant ist die Entwicklung der App: 2025 kamen unter anderem

* Receipt Scanner
* Photo Recognition
* AI Recipe Generation
* eigene Food-Kategorien
* Library für Produkte
* Kalender für Ablaufdaten
* Batch Editing
* mehrere Expiry-Reminder

hinzu. ([App Store][9])

Die visuelle Darstellung bleibt dabei trotzdem überwiegend **listen-/kartenbasiert**. Ein Screenshot zeigt beispielsweise Produktzeilen mit Menge, Lagerort und Ablaufhinweis.

**UX-Lektion:**
NoWaste zeigt, dass zusätzliche Automatisierung allein noch keine grundsätzlich neue Inventar-UX erzeugt. AI reduziert die Eingabe – aber das mentale Modell bleibt weiterhin „Liste von Lebensmitteln“.

---

### Zimmer / zimmerfood

Zimmer ist besonders interessant, weil es den Haushalt nicht vom Inventar, sondern vom **Kochen und Wochenplan** her denkt.

Die Einkaufsliste wird automatisch aus dem Meal Plan erzeugt und nach Gängen sortiert. Nach dem Einkauf kann ein Kassenbon in der Pantry gescannt werden; die gekauften Produkte werden anschließend in den Vorrat übernommen. ([Zimmer][10])

Damit entsteht ein anderer Übergang:

**Meal Plan → Einkaufsliste → Einkauf → Receipt Scan → Pantry**

Das ist konzeptionell sehr relevant.

Zimmer besitzt außerdem Widgets für Home- und Lock-Screen, eine gemeinsam genutzte Pantry und gespeicherte Einkaufs-Mengen. ([Zimmer][10])

Die Einschränkung: Zimmer ist derzeit für **iPhone** gebaut; Android befindet sich noch auf der Warteliste. ([Zimmer][10])

**UX-Lektion:**
Der Einkauf ist nicht das Ende der Einkaufsliste. Er ist der **Übergang in den Haushaltsbestand**.

Das ist für die neue Lösung wahrscheinlich eines der wertvollsten Patterns.

---

# 2. Der stärkste Wettbewerber für den konkreten Inventory-Flow: Pantry Check

Pantry Check verdient eine gesonderte Betrachtung, weil es den gewünschten Kreislauf besonders explizit umgesetzt hat.

Die Inventaransicht:

* gruppiert Produkte nach Kategorien,
* kann Kategorien auf-/zuklappen,
* sortiert Produkte nach Ablaufdatum bzw. Alter,
* stapelt gleiche Produkte,
* zeigt Ablauf-Fortschritt,
* zeigt bei angebrochenen Produkten eine Mengenanzeige. ([Pantry Check][11])

Noch wichtiger: Wenn ein Einkauf abgeschlossen wird, werden die abgehakten Produkte **direkt ins Inventar übernommen**. Bei individuellen Lagerorten erscheint anschließend gegebenenfalls ein Review-Schritt. ([Pantry Check][12])

Auch die Einkaufsliste wird nicht isoliert behandelt: Sie wird aus Inventar und Nutzungsmustern generiert und enthält zusätzliche Restock Suggestions. ([Pantry Check][13])

### Das ist ein sehr wichtiges Benchmark-Pattern

**Shopping List Item**

→ gekauft
→ Menge/Preis/Ablauf ggf. bestätigen
→ Lagerort bestimmen
→ Inventarbestand erhöhen
→ Shopping Item verschwindet
→ Produkt wird Teil des zukünftigen Restock-Modells

Genau diese Logik sollte zum **Grundgerüst** der neuen Lösung werden.

---

# 3. Gemeinsame Schwachstellen der Wettbewerber

Die Schwächen sind weniger einzelne Bugs als **strukturelle UX-Probleme**.

## 3.1 Das Inventar ist meistens noch eine Liste

Selbst moderne Apps wie NoWaste, Your Food und Pantry Check repräsentieren den Haushalt primär als:

> Produkt A
> Produkt B
> Produkt C

Das ist effizient für Suche, aber nicht unbedingt für die Frage:

> **„Wie sieht mein Haushalt gerade aus?“**

Das ist ein Unterschied.

Der Nutzer denkt räumlich:

**Kühlschrank → oberes Fach → Milchprodukte**

oder:

**Vorratsschrank → Pasta → Konserven → Frühstück**

Die App denkt dagegen häufig:

**Dairy: 5 items**

Hier liegt eine große Designchance.

---

## 3.2 Ablaufdaten sind häufig ein Attribut – nicht der zentrale Handlungsimpuls

Wettbewerber können Ablaufdaten anzeigen und Benachrichtigungen senden. Pantry Check geht mit visuellen Progress-Indikatoren bereits weiter; Samsung Food gruppiert beispielsweise Lebensmittel nach „days left“. ([Pantry Check][11])

Aber aus Anti-Food-Waste-Sicht reicht:

> „Milch – 4 Tage“

nicht unbedingt.

Besser wäre:

> **„4 Tage – diese Woche verwenden“**

und noch besser:

> **„4 Tage – passt zu 3 Gerichten“**

Die Information muss also von **Datum → Handlung** transformiert werden.

---

## 3.3 „Bald leer“ und „bald schlecht“ werden zu wenig gemeinsam gedacht

Das sind zwei unterschiedliche Zustände:

**Expiration pressure**

* Produkt muss bald verwendet werden.

**Stock pressure**

* Produkt muss bald nachgekauft werden.

Die meisten Apps behandeln beide eher getrennt.

Das neue Konzept sollte daraus einen gemeinsamen Haushaltsstatus machen:

### Household Food State

| Zustand             | Bedeutung                   | Aktion              |
| ------------------- | --------------------------- | ------------------- |
| 🟢 vorhanden        | ausreichend Bestand         | nichts              |
| 🟡 bald verbrauchen | Ablauf-/Frische-Risiko      | Rezept / Verbrauch  |
| 🟠 bald leer        | Bestand sinkt               | Einkauf empfehlen   |
| 🔴 kritisch         | Verbrauchsdatum / fast leer | sofort handeln      |
| ⚪ unbekannt         | Daten fehlen                | optional nachfragen |

---

# 4. Die zweite Pflichtfrage: Innovative Paradigmen außerhalb Food

Hier liegt wahrscheinlich der größte Innovationsraum.

## 4.1 Visuelle Regale statt Listen

Inventory-Apps aus anderen Kategorien zeigen, dass **Ort als primäres Navigationsmodell** funktionieren kann.

Rattib beispielsweise modelliert Inventar über Räume, Schränke, Schubladen und Regale und zeigt Fotos, Orte, Status und Mengen bereits vor dem Öffnen eines einzelnen Datensatzes. ([Rattib][14])

Auch visuelle Retail-Inventory-Systeme wie ShelfSwift setzen auf Produktfotos statt Tabellenzeilen und kombinieren dies mit schnellen Bestandsänderungen und automatischen Reorder-Listen. ([ShelfSwift][15])

### Übertragung auf Food

Statt:

> Pantry
> 43 Produkte

könnte die App zeigen:

```text
┌─────────────────────────┐
│       KÜHLSCHRANK       │
│                         │
│ 🥛 🧀 🥬 🍓             │
│                         │
│ ─────────────────────── │
│ 🥛 Milch       3 Tage   │
│ 🍓 Beeren      2 Tage   │
└─────────────────────────┘

┌─────────────────────────┐
│       VORRATSSCHRANK    │
│                         │
│ 🍝 🍅 🫘 🥫             │
│                         │
│ 2 Dinge bald nachkaufen │
└─────────────────────────┘
```

Das wäre kein fotorealistischer Kühlschrank-Simulator.

Es wäre ein **semi-räumliches Dashboard**.

---

# 5. Empfehlenswertes neues Paradigma: „Household Map“

Ich würde für die neue App nicht einfach „Inventory List 2.0“ bauen.

Ich würde eine **Household Map** bauen.

## Ebene 1: Haushalt

Der Nutzer sieht:

**Mein Vorrat**

> 86 Lebensmittel
> 7 bald verbrauchen
> 5 bald leer
> 2 kritische Produkte
> 8 Einkaufsempfehlungen

Darunter visuelle Bereiche:

* Kühlschrank
* Gefrierschrank
* Vorratsschrank
* Obst/Gemüse
* Sonstige

---

## Ebene 2: Raum / Lagerort

Tap auf Kühlschrank:

```text
KÜHLSCHRANK

⚠ 3 zuerst verwenden

┌────────┐ ┌────────┐ ┌────────┐
│ 🍓     │ │ 🥛     │ │ 🧀     │
│ Beeren │ │ Milch  │ │ Käse   │
│ 2 Tage │ │ 4 Tage │ │ 9 Tage │
└────────┘ └────────┘ └────────┘

┌────────┐ ┌────────┐
│ 🥕     │ │ 🥚     │
│ Möhren  │ │ Eier   │
│ 8 Tage │ │ 14 Tage│
└────────┘ └────────┘
```

Dabei ist **die Ablaufpriorität visuell stärker als die Produktkategorie**.

---

# 6. Das wichtigste neue Konzept: Food Lifecycle

Die eigentliche Innovation sollte nicht der Screen sein, sondern das **Datenmodell dahinter**.

Ein Produkt durchläuft einen Lebenszyklus:

```text
NEED
 ↓
SHOPPING LIST
 ↓
BOUGHT
 ↓
AT HOME
 ↓
OPENED
 ↓
LOW
 ↓
USED
 ↓
RESTOCK
```

oder:

```text
AT HOME
 ↓
EXPIRING SOON
 ↓
USE / FREEZE / COOK
 ↓
USED
```

Damit wird ein Produkt nicht als statischer Datensatz behandelt.

Es ist ein **Objekt mit Zustand**.

---

# 7. „Einkauf abgeschlossen“ sollte der magische Moment sein

Das ist vermutlich die wichtigste konkrete UX-Entscheidung.

## Heute

Viele Apps:

1. Einkaufsliste abhaken
2. Inventar öffnen
3. Produkt hinzufügen
4. Menge eingeben
5. Lagerort wählen
6. Ablaufdatum eingeben

Das erzeugt genau die Friktion, die Inventory-Systeme langfristig unbrauchbar macht.

Studien zu Food-Management-Apps bestätigen, dass manuelle Aktualisierung nach Einkauf, Lagerung, Verbrauch und Wegwerfen ein erheblicher Teil der laufenden Arbeit ist. ([ScienceDirect][16])

## Ziel

### Nach dem Einkauf:

**„12 Produkte gekauft“**

↓

**„In Vorrat übernehmen“**

↓

App schlägt vor:

> 🥛 Milch × 2 → Kühlschrank
> 🍝 Pasta × 2 → Vorrat
> 🧀 Gouda × 1 → Kühlschrank
> 🍅 Tomaten × 6 → Kühlschrank

**[Alles übernehmen]**

Optional:

> Ablaufdaten automatisch schätzen
> Lagerorte aus letzter Nutzung übernehmen
> Mengen aus Einkaufsliste übernehmen

**1 Tap. Fertig.**

---

# 8. Noch besser: kein „Import“-Moment

Die beste Version wäre sogar:

> **Der Nutzer muss überhaupt keinen Import ausführen.**

Sobald ein Einkaufslistenprodukt als „gekauft“ markiert wird, wechselt sein Zustand automatisch:

**Shopping → Purchased → Pending placement → Home**

Dann bekommt der Nutzer nur bei Unsicherheit eine kleine Bestätigung:

> **4 neue Lebensmittel zu deinem Kühlschrank hinzufügen?**

**[Übernehmen]**

Das reduziert den mentalen Aufwand nochmals.

---

# 9. Intelligente Empfehlungen für die nächste Einkaufsliste

Hier sollte die App deutlich über „Milch ist leer“ hinausgehen.

## 9.1 Drei Recommendation Layers

### A. Replenishment

> Milch ist fast leer.

→ **Milch hinzufügen**

### B. Habit

> Du kaufst Milch normalerweise alle 6–7 Tage.

→ **Milch für diese Woche vorschlagen**

### C. Household context

> Du hast noch 1 Liter Milch und kaufst normalerweise 2 Liter/Woche.

→ **1 Liter Milch vorschlagen**

Das ist viel intelligenter als ein simpler Low-Stock-Schwellwert.

---

# 10. Noch wichtiger: „Nicht kaufen“

Anti-Food-Waste sollte nicht nur Einkaufsempfehlungen erzeugen.

Die App sollte auch aktiv **vom Kauf abraten**.

Beispiel:

> 🥫 Tomaten
> **Du hast bereits 4 Dosen zu Hause.**
> Durchschnittlicher Verbrauch: 1,2/Woche.

**Nicht auf die Liste setzen**

Das ist ein sehr starker Moment, weil die App den Nutzer beim eigentlichen Food-Waste-Treiber unterstützt: **unnötiger Einkauf**.

Forschung zeigt, dass Einkaufs- und Planungsroutinen zentrale Faktoren beim Haushalts-Food-Waste sind. ([PubMed][17])

---

# 11. „Use before buy“ als zentrale Interaktion

Eine besonders interessante Innovation wäre ein **Konfliktcheck**, bevor ein Produkt auf die Einkaufsliste kommt.

Beispiel:

Der Nutzer fügt hinzu:

> 🥒 Gurken

Die App antwortet:

> Du hast bereits 2 Gurken zu Hause.
> Eine davon sollte in den nächsten 3 Tagen verwendet werden.

**[Vorhandene verwenden] [Trotzdem kaufen]**

Das ist deutlich besser als eine reine Warnung.

Die App macht aus Inventardaten eine **Entscheidungshilfe**.

Eine Studie zu FoodSaveShare fand ebenfalls Interesse an genau solchen Funktionen: Nutzer wünschten unter anderem Hinweise, wenn ein Produkt bereits im Inventar vorhanden ist, Mengenempfehlungen anhand der Haushaltsgröße und Hinweise auf Produkte, die bald ablaufen. ([MDPI][18])

---

# 12. Ablaufdatum → konkrete Aktion

Hier liegt ein besonders großer UX-Hebel.

Statt:

> ⚠️ Joghurt – läuft in 2 Tagen ab

sollte die App anbieten:

> 🥣 **Joghurt – 2 Tage**
> Verwende ihn diese Woche.

**3 passende Gerichte**

* Overnight Oats
* Kräuter-Dip
* Pfannkuchen

**[Rezept öffnen]**

Damit wird aus einer **Warnung eine Handlung**.

Forschung zu Food-Waste-Nudges deutet ebenfalls darauf hin, dass **aktionsbezogene Informationen** wirksamer sind als reine Informationen über das Problem bzw. dessen Umweltfolgen. ([ScienceDirect][19])

---

# 13. Gamification: ja – aber nicht als Punkte-Spiel

Gamification kann funktionieren. Eine aktuelle Studie mit 126 Haushalten untersuchte eine gamifizierte Self-Monitoring-App und berichtete eine Reduktion des wöchentlichen Haushalts-Food-Waste um durchschnittlich 190 g bzw. 45 % in der Interventionsgruppe gegenüber 13 % in der Kontrollgruppe. Die Studie zeigt damit interessantes Potenzial, sollte wegen des Studiendesigns aber nicht als Beweis für einen allgemeinen Effekt interpretiert werden. ([Sciety][20])

Für das Produkt würde ich deshalb **keine klassische XP-/Badge-App** bauen.

Besser:

### „Diese Woche gerettet“

> 🥕 6 Lebensmittel rechtzeitig verwendet
> 💶 ca. 8,40 € nicht verschwendet
> 🌱 1,9 kg Lebensmittel vor dem Wegwerfen bewahrt

Oder:

> **Haushalt im grünen Bereich**

Das ist Feedback statt Spielmechanik.

---

# 14. „Waste Story“ statt Waste Counter

Noch interessanter wäre eine positive Rückschau:

> **Dein Haushalt diese Woche**
>
> 31 Lebensmittel gekauft
> 24 verwendet
> 5 noch vorhanden
> 2 kritisch
> 0 entsorgt

Das ist psychologisch besser als:

> „Du hast 2 Lebensmittel verschwendet.“

Denn das System soll **Verhaltenskompetenz aufbauen**, nicht Schuld erzeugen.

Goal-setting, Feedback, Erinnerungen und die Vereinfachung gewünschter Handlungen gehören zu den in der Forschung untersuchten wirksamen Interventionsmustern. ([ScienceDirect][21])

---

# 15. Ambient / Contextual UX

Die nächste Stufe ist, dass der Nutzer nicht immer die App öffnen muss.

Apple beschreibt Widgets explizit als Möglichkeit, **zeitrelevante Informationen auf einen Blick** bereitzustellen; Lock-Screen-Widgets sollen die wichtigsten Informationen direkt zugänglich machen. ([Apple Developer][22])

Für Food Management wären sinnvoll:

### Lock Screen

> 🥬 3 Lebensmittel zuerst verwenden

### Home Widget

> **Heute**
>
> Erdbeeren – 1 Tag
> Joghurt – 2 Tage
> Frischkäse – 3 Tage

### Shopping Widget

> **Noch 7 Dinge**
>
> Milch
> Brot
> Eier
> …

### Kontextuelle Notification

Nicht:

> „3 Lebensmittel laufen ab.“

Sondern:

> **„Du hast noch Erdbeeren + Joghurt. Möchtest du daraus heute ein Frühstück machen?“**

---

# 16. Der physische Haushalt als UX-Metapher

Hier würde ich eine klare Grenze ziehen.

Eine **fotorealistische virtuelle Küche** wäre wahrscheinlich zu verspielt und schwer zu pflegen.

Besser:

### Spatial-lite

```text
MEIN HAUSHALT

┌─────────────────────┐
│ 🧊 Kühlschrank      │
│ 24 Produkte         │
│ ⚠ 3 zuerst nutzen   │
└─────────────────────┘

┌─────────────────────┐
│ ❄ Gefrierschrank    │
│ 12 Produkte         │
└─────────────────────┘

┌─────────────────────┐
│ 🗄 Vorratsschrank   │
│ 41 Produkte         │
│ ↓ 4 fast leer       │
└─────────────────────┘
```

Das verbindet:

**räumliche Orientierung + Informationsdichte + mobile Scanbarkeit.**

---

# 17. Ein besonders interessantes Pattern: „Visual Health“

PantryVault, Restokk, Pantri und andere neue Produkte zeigen eine Entwicklung hin zu **Dashboard-artigen Haushaltszuständen** statt reinen Listen. Pantri beispielsweise stellt explizit „total items“, „expiring soon“, „running low“ und „ready recipes“ nebeneinander.

Das ist für das neue Produkt sehr relevant.

Der Vorrat könnte oben vier Zustände zeigen:

### 86 Lebensmittel

**7**
bald verbrauchen

**5**
fast leer

**12**
für diese Woche relevant

**€14**
potenziell geretteter Wert

Darunter kommt erst das eigentliche Inventar.

---

# 18. Empfohlenes Informationsmodell

Ich würde nicht primär mit „Produkten“ arbeiten, sondern mit **Food Items + Product Memory**.

### Food Item

```text
id
product
quantity
unit
storage_location
category
best_before
use_by
opened_at
status
```

### Product Memory

```text
product_id
usual_quantity
usual_price
purchase_frequency
last_purchased
preferred_storage
household_consumption_rate
```

Damit kann die App lernen:

> „Die Familie kauft Milch alle 6 Tage.“

statt lediglich:

> „Milch ist aktuell vorhanden.“

Das ermöglicht wirklich intelligente Empfehlungen.

---

# 19. Kategorisierung: weniger wichtig als Ort + Zustand

Die Wettbewerber investieren viel in Kategorien.

Ich würde Kategorien aber **sekundär** behandeln.

Primäre Navigation:

**Wo?**

* Kühlschrank
* Gefrierschrank
* Vorrat
* Obstkorb

Sekundäre Filter:

**Was?**

* Milchprodukte
* Gemüse
* Fleisch
* Konserven
* Snacks

Dritte Dimension:

**Was muss ich tun?**

* zuerst verwenden
* bald leer
* vorhanden
* eingefroren
* geöffnet

Das entspricht eher dem tatsächlichen Haushaltsverhalten.

---

# 20. Ablaufdaten sollten nicht nur ein Datum sein

Für die deutsche Nutzung sollte außerdem zwischen **Mindesthaltbarkeitsdatum (MHD)** und **Verbrauchsdatum** unterschieden werden. Das MHD ist kein automatisches Wegwerfdatum; das Verbrauchsdatum ist bei leicht verderblichen Lebensmitteln hingegen ein sicherheitsrelevanter Endpunkt. ([BMEL][23])

Daraus folgt eine wichtige UI-Regel:

### Nicht alles rot färben.

Beispiel:

**MHD**

> „seit gestern überschritten – prüfen“

**Verbrauchsdatum**

> „heute verbrauchen“

Damit verhindert man, dass die App selbst unnötig Food Waste erzeugt.

---

# 21. Die optimale mobile Informationsarchitektur

Für iOS und Android würde ich maximal vier Hauptbereiche empfehlen:

### 1. **Heute**

Haushaltsstatus + kritische Lebensmittel + Empfehlungen

### 2. **Vorrat**

Der komplette Haushalt / Household Map

### 3. **Einkauf**

Einkaufsliste + intelligente Vorschläge

### 4. **Kochen**

Rezepte / „Was kann ich jetzt verwenden?“

Der Nutzer sollte nicht zwischen fünf verschiedenen Inventar-, Listen-, Expiry- und Reminder-Screens wechseln müssen.

---

# 22. Empfohlener „Vorrat“-Screen

## Header

**Mein Vorrat**

> 86 Lebensmittel · 4 Orte

### Priority Strip

**⚠ 7 zuerst verwenden**

**↓ 5 fast leer**

**✓ 74 im grünen Bereich**

---

### Storage Map

**Kühlschrank · 24**

> 🥬 3 kritisch
> 🥛 2 fast leer

**Vorratsschrank · 41**

> 🥫 4 fast leer

**Gefrierschrank · 12**

> ✓ alles ok

---

### „Für dich relevant“

> 🍓 Erdbeeren
> **2 Tage**
> → 3 Rezepte

> 🥛 Milch
> **1 Einheit übrig**
> → normalerweise in 2 Tagen leer

---

# 23. Empfohlener Einkaufslisten-Screen

Nicht einfach:

```text
□ Milch
□ Eier
□ Brot
```

sondern:

### Empfohlen

**Milch**
1 l · 92 % wahrscheinlich benötigt

**Eier**
10 St. · regelmäßig gekauft

**Bananen**
1 kg · letzte Woche leer

---

### Du hast bereits zu Hause

**Tomaten**
2 Dosen vorhanden
→ nicht empfohlen

---

### Bald ablaufend

**Joghurt**
→ nicht nachkaufen
→ zuerst verwenden

Das ist die eigentliche Verbindung von Inventar und Einkaufsliste.

---

# 24. Der ideale Einkaufsabschluss

Nach dem Einkauf:

## „Einkauf fertig“

**12 gekauft**

| Produkt    | Ziel        | Status |
| ---------- | ----------- | ------ |
| Milch ×2   | Kühlschrank | ✓      |
| Eier ×10   | Kühlschrank | ✓      |
| Pasta ×2   | Vorrat      | ✓      |
| Tomaten ×4 | Vorrat      | ✓      |
| Beeren ×1  | Kühlschrank | ?      |

Nur bei Unsicherheit wird gefragt.

**[12 übernehmen]**

Danach:

> **Vorrat aktualisiert**

und die Einkaufsliste ist automatisch bereinigt.

Das ist UX-seitig wahrscheinlich der wichtigste Screen der gesamten Lösung.

---

# 25. Was die Forschung für die Produktstrategie bedeutet

Eine kleine Studie zu Food-Management-Apps zeigte, dass Inventarlisten und Kühlschrankfotos den Überblick über vorhandene Lebensmittel verbessern können und dass Echtzeitverwaltung auf mobilen Geräten als Vorteil wahrgenommen wurde. Gleichzeitig müssen Bestände laufend aktualisiert werden, wenn Lebensmittel verwendet, verschoben oder weggeworfen werden. ([MDPI][24])

Das führt zu einem wichtigen Prinzip:

> **Die App darf nicht versuchen, den Nutzer zum permanenten Datenpfleger zu machen.**

Sie muss sich möglichst oft **aus ohnehin stattfindenden Handlungen aktualisieren**:

* Einkauf abschließen
* Produkt kaufen
* Produkt verbrauchen
* Produkt aufbrauchen
* Produkt wegwerfen
* Rezept kochen

Das ist wesentlich nachhaltiger als „Bitte pflege dein Inventar“.

---

# 26. Wettbewerbs-White-Space

Die interessanteste Lücke liegt meines Erachtens hier:

| Wettbewerber                 | stark bei                                                | weniger stark bei                    |
| ---------------------------- | -------------------------------------------------------- | ------------------------------------ |
| KitchenPal                   | umfassendes Kitchen OS                                   | Komplexität                          |
| Your Food                    | niedrige Friktion / Stock ↔ Shopping                     | räumliche Visualisierung             |
| PantryVault                  | visuelles Erlebnis                                       | Reife / Ökosystem                    |
| NoWaste                      | Automatisierung + Waste Tools                            | Informationsdichte                   |
| Zimmer                       | Meal Plan → Shopping → Pantry                            | Inventar als zentrale Funktion       |
| Pantry Check                 | Inventory → Restock → Shopping                           | emotionale/spatial UX                |
| Samsung Food                 | Food List + Meal Plan + Shopping                         | Haushaltsinventar als eigenes System |
| SuperCook                    | Pantry → Rezepte                                         | Einkauf/Bestandskreislauf            |
| **Chance für neues Produkt** | **Household Map + Food Lifecycle + predictive shopping** | —                                    |

Samsung Food zeigt beispielsweise bereits die Kombination aus Food List, Lagerort und „days left“, während SuperCook den Pantry-Bestand direkt als Grundlage für Rezeptempfehlungen verwendet. ([Google Play][25])

---

# 27. Meine klare Designempfehlung

## Nicht bauen:

**„Eine bessere Vorratsliste“**

## Bauen:

# **„Das Betriebssystem für den Lebensmittelhaushalt“**

Der zentrale Screen ist nicht:

> Was habe ich?

sondern:

> **Was sollte ich mit dem machen, was ich habe?**

Daraus entsteht eine Hierarchie:

### 1. Jetzt handeln

Was läuft ab?

### 2. Heute nicht kaufen

Was habe ich schon?

### 3. Bald kaufen

Was geht aus?

### 4. Planen

Was brauche ich wahrscheinlich nächste Woche?

### 5. Entdecken

Was kann ich aus meinem vorhandenen Bestand kochen?

---

# 28. Das ideale Kernprinzip

Ich würde die komplette UX auf **vier Zustände** reduzieren:

## **HAVE**

> Was ist zu Hause?

## **USE**

> Was sollte zuerst verbraucht werden?

## **NEED**

> Was fehlt bzw. wird bald fehlen?

## **BUY**

> Was soll beim nächsten Einkauf tatsächlich gekauft werden?

Und die App verschiebt Lebensmittel automatisch zwischen diesen Zuständen.

```text
                 ┌──────────────┐
                 │     HAVE     │
                 │  Vorrat      │
                 └──────┬───────┘
                        │
             ┌──────────┴──────────┐
             ↓                     ↓
          USE                     NEED
       bald schlecht           bald leer
             │                     │
             ↓                     ↓
          RECIPE                  BUY
             │                     │
             └──────────┬──────────┘
                        ↓
                      SHOP
                        │
                        ↓
                      HAVE
```

**Das ist die eigentliche Verbindung zwischen Inventar und Einkaufsliste.**

---

# 29. Priorisierte Innovations-Roadmap

### P0 — unbedingt

1. **Shopping → Inventory 1-Tap / automatisch**
2. Gemeinsames Produktmodell für Vorrat und Einkauf
3. Mengenübernahme
4. Lagerortübernahme
5. „Bereits vorhanden“-Check
6. Expiry-/Use-priority
7. Low-stock-Zustand
8. Haushaltssynchronisation

### P1 — hoher Differenzierungswert

9. Household Map / visuelle Lagerorte
10. Verbrauchsgeschwindigkeit
11. automatische Restock Recommendations
12. „Use before buy“
13. Expiry → Rezept
14. personalisierte Einkaufsmenge
15. Lock-Screen/Home Widgets

### P2 — Innovation

16. Receipt Scan als Fallback
17. Shelf/fridge photo recognition
18. Waste analytics
19. „Saved food“ / positive Gamification
20. adaptive Empfehlungen
21. Kontext-Nudges
22. saisonale / temperaturbezogene Hinweise

---

# 30. Finales Konzept in einem Satz

**Die neue „Vorrat“-Seite sollte nicht als digitale Speisekammer funktionieren, sondern als lebendige Household Map, die jedes Lebensmittel entlang seines gesamten Lebenszyklus verfolgt – vom geplanten Einkauf über das Heimkommen und Verbrauchen bis zur intelligenten nächsten Einkaufsentscheidung.**

Damit wird die Einkaufsliste nicht mehr zu einem separaten Feature, sondern zur **nächsten Phase desselben Inventars**.

Das ist gleichzeitig die stärkste Anti-Food-Waste-Strategie: Die App hilft nicht nur dabei, zu wissen, **was vorhanden ist**, sondern entscheidet kontextbezogen, **was jetzt verwendet, was nicht gekauft und was als Nächstes gekauft werden sollte**.

### Quellen / weiterführende Referenzen

* [KitchenPal](https://kitchenpalapp.com/?utm_source=chatgpt.com) – Pantry, Ablaufdaten, Shopping, Rezepte und visuelle Lageransichten. ([KitchenPal][26])
* [Your Food](https://yourfood.app/?utm_source=chatgpt.com) – besonders relevant für die Zwei-Wege-Verbindung zwischen Vorrat und Einkauf. ([YourFood][3])
* [PantryVault](https://www.pantryvault.app/?utm_source=chatgpt.com) – räumliche und ästhetische Inventory-Metapher. ([PantryVault][6])
* [NoWaste](https://www.nowasteapp.com/?utm_source=chatgpt.com) – Expiry, Kategorien, AI, Foto-/Receipt-Scanning. ([NoWaste][27])
* [Zimmer](https://zimmerfood.com/?utm_source=chatgpt.com) – Meal Plan → Shopping → Receipt → Pantry. ([Zimmer][10])
* [Pantry Check](https://pantrycheck.com/?utm_source=chatgpt.com) – besonders starkes Checkout-to-Inventory- und Restock-Modell. ([Pantry Check][28])
* Samsung Food – Food List mit Ablauf-/Tage-Anzeige und Meal-Plan-to-Shopping. ([Samsung Food Hilfe][29])
* FoodSaveShare-Forschung – Verbindung von Einkauf, Inventar, Ablaufdaten, Rezepten und Waste Feedback. ([MDPI][18])
* Forschung zu Gamification und Food Waste – aktueller Interventionsbefund 2026. ([Sciety][20])
* Forschung zu Food-Waste-Nudges und aktionsbezogenen Informationen. ([ScienceDirect][19])
* Bundesministerium / Verbraucherzentrale – MHD vs. Verbrauchsdatum. ([BMEL][23])
* Apple Human Interface Guidelines – Widgets und glanceable contextual information. ([Apple Developer][22])

**Bottom line:** Wenn das Ziel wirklich **Anti-Food-Waste** ist, würde ich die Differenzierung nicht über einen besseren Barcode-Scanner oder noch mehr Kategorien suchen. Der größte White-Space liegt in einer **visuellen, zustandsbasierten Household Map + automatischem Food Lifecycle + „Use before Buy“-Logik**. Das macht aus Vorrat und Einkaufsliste erstmals wirklich **ein zusammenhängendes System**.

[1]: https://apps.apple.com/de/app/kitchenpal-bestandsverfolgung/id1084982489?utm_source=chatgpt.com "‎KitchenPal: Bestandsverfolgung‑App – App Store"
[2]: https://kitchenpalapp.com/de/faqs/kitchen.html?utm_source=chatgpt.com "KitchenPal (iCuisto) - Vorratskammer & Einkaufs-App"
[3]: https://yourfood.app/de/?utm_source=chatgpt.com "Your Food: Vorrats-App mit Haltbarkeitsdatum"
[4]: https://yourfood.app/?utm_source=chatgpt.com "Your Food: Pantry Inventory App with Expiration Dates"
[5]: https://yourfood.app/pantry-inventory-app/?utm_source=chatgpt.com "Pantry Inventory App for iPhone & Android, Your Food"
[6]: https://www.pantryvault.app/?utm_source=chatgpt.com "PantryVault — The Elegantly Simple Pantry & Fridge Tracker for iOS"
[7]: https://apps.apple.com/us/app/pantryvault/id6755187375?platform=ipad&utm_source=chatgpt.com "‎PantryVault App - App Store"
[8]: https://apps.apple.com/us/app/nowaste-food-inventory-list/id926211004?utm_source=chatgpt.com "‎NoWaste: Food Inventory List App - App Store"
[9]: https://apps.apple.com/de/app/nowaste-lebensmittelliste/id926211004?utm_source=chatgpt.com "‎NoWaste: Lebensmittelliste‑App – App Store"
[10]: https://zimmerfood.com/?utm_source=chatgpt.com "Zimmer — the meal-planning app · Less to plan, more to explore."
[11]: https://pantrycheck.com/kb/inventory-screen/?utm_source=chatgpt.com "Inventory Screen – Pantry Check"
[12]: https://pantrycheck.com/kb/updating-the-inventory/?utm_source=chatgpt.com "Updating The Inventory – Pantry Check"
[13]: https://pantrycheck.com/kb/grocery-shopping/?utm_source=chatgpt.com "Grocery Shopping – Pantry Check"
[14]: https://rattib.com/features/?utm_source=chatgpt.com "Features — Rattib"
[15]: https://shelfswift.com/?utm_source=chatgpt.com "ShelfSwift - Manage Inventory Visually - No Spreadsheets Needed"
[16]: https://www.sciencedirect.com/org/science/article/pii/S2561326X22007971?utm_source=chatgpt.com "The Impact of Smartphone Apps Designed to Reduce Food Waste on Improving Healthy Eating, Financial Expenses and Personal Food Waste: Crossover Pilot Intervention Trial Studying Students’ User Experiences - ScienceDirect"
[17]: https://pubmed.ncbi.nlm.nih.gov/26299713/?utm_source=chatgpt.com "Determinants of consumer food waste behaviour: Two routes to food waste - PubMed"
[18]: https://www.mdpi.com/2071-1050/16/7/2800?utm_source=chatgpt.com "Managing Household Food Waste with the FoodSaveShare Mobile Application"
[19]: https://www.sciencedirect.com/science/article/pii/S0959652620311732?utm_source=chatgpt.com "Action-related information trumps system information: Influencing consumers’ intention to reduce food waste - ScienceDirect"
[20]: https://sciety.org/articles/activity/10.31025/2611-4135/2026.19596?utm_source=chatgpt.com "Effects of a gamified self-monitoring app on household food waste reduction | Sciety"
[21]: https://www.sciencedirect.com/science/article/pii/S0921344916300908?utm_source=chatgpt.com "Explaining and promoting household food waste-prevention by an environmental psychological based intervention study - ScienceDirect"
[22]: https://developer.apple.com/design/human-interface-guidelines/widgets?changes=_3&utm_source=chatgpt.com "Widgets | Apple Developer Documentation"
[23]: https://www.bmel.de/DE/themen/ernaehrung/lebensmittelverschwendung/mindesthaltbarkeit-kein-verfallsdatum.html?utm_source=chatgpt.com "BMLEH - Lebensmittelverschwendung - Mindesthaltbarkeits- und Verbrauchsdatum"
[24]: https://www.mdpi.com/2071-1050/17/14/6392?utm_source=chatgpt.com "The Effects of Interventions Using Support Tools to Reduce Household Food Waste: A Study Using a Cloud-Based Automatic Weighing System"
[25]: https://play.google.com/store/apps/details?id=com.supercook.app&utm_source=chatgpt.com "SuperCook - Recipe Generator - Apps on Google Play"
[26]: https://www.kitchenpalapp.com/?utm_source=chatgpt.com "KitchenPal — Pantry Tracker, Meal Planner & Shopping List App"
[27]: https://www.nowasteapp.com/?utm_source=chatgpt.com "NoWaste | Food inventory management with AI"
[28]: https://pantrycheck.com/kb/overview/?utm_source=chatgpt.com "Overview – Pantry Check"
[29]: https://support.samsungfood.com/hc/en-us/articles/30025317487508-Getting-Started-with-Food-List?utm_source=chatgpt.com "Getting Started with Food List – Samsung Food Help"
