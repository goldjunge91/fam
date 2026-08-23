# Standard-Laufstrecke im Supermarkt (für Einkaufslisten-Sortierung)

Eine praxisnahe Kategorie-Reihenfolge zur Sortierung von Einkaufslisten, basierend auf Verkaufspsychologie, Handelsarchitektur und empirischen Kundenlaufstudien in typischen Supermärkten (DACH-Raum: REWE, Edeka, Kaufland, ALDI, Lidl).

---

## Wissenschaftlicher Hintergrund & Studien

### 1. Wharton-Studie zu Kundenlaufpfaden (Larson, Bradlow & Fader / Sorensen Associates)
- **Studie:** *„An Exploratory Look at Supermarket Shopping Paths“* (2005) & *„Testing Behavioral Hypotheses on In-Store Shopper Traveling Paths“* (Hui, Bradlow, Fader 2009).
- **Methode:** RFID-Tracking von Einkaufswagen über zehntausende Einkäufe.
- **Ergebnis:** Widerlegung des Mythos vom systematischen „Schlangenlinien-Ablaufen“ aller Gänge. Kunden bewegen sich primär entlang des **Außenrings (Perimeter)** und machen nur gezielte, kurze Stichfahrten („Up-and-in excursions“) in die Mittelgänge für geplante Artikel.
- **Umsatzverteilung:** Auf dem Außenring verbringen Kunden ca. 64 % der Zeit; in den Mittelgängen („Center Store“) ca. 36 %, wobei dort über 50 % der geplanten Packungs-/Trockenwarenumsätze erzielt werden.

### 2. Verkaufspsychologie & Orientierung (Paco Underhill, Herb Sorensen)
- **"Decompression Zone" (Eingangszone):** Die ersten 3 bis 5 Meter nach Betreten dienen dem mentalen Übergang. Kunden orientieren sich und nehmen noch wenig Ware wahr.
- **Rechtsdrall & Gegen-den-Uhrzeigersinn:** ~90 % der Kunden wenden sich nach dem Betreten unbewusst nach rechts. Supermärkte leiten den Kundenstrom daher fast standardmäßig gegen den Uhrzeigersinn um die Außenwand.
- **Sensorisches Priming:** Obst, Gemüse und Blumen am Eingang signalisieren Frische, Natürlichkeit und Qualität, heben die Stimmung und steigern die Kaufbereitschaft für den restlichen Einkauf.

### 3. Handelsforschung DACH-Raum (EHI Retail Institute & GfK)
- **Anker- und Magnetprodukte:** Grundnahrungsmittel des täglichen Bedarfs (Milch, Butter, Eier, Fleisch) werden an der hintersten Wand oder im hinteren Marktdrittel platziert, um Kunden durch das gesamte Sortiment zu leiten.
- **Kühlketten- und Packergonomie:** Tiefkühlware steht unmittelbar vor den Kassen am Ende des Rundgangs, um das Auftauen auf dem Heimweg zu minimieren und empfindliche Frischeware nicht im Wagen zu zerdrücken.
- **Checkout / Impulszone:** Wartezeiten an der Kasse werden für margenstarke Spontankäufe (Kaugummi, Snacks, Batterien, Kleinwaren) genutzt.

---

## Zonenarchitektur im Markt

```
EINGANG / DECOMPRESSION
  │
  ▼
[1. Frische & Priming] ────────► Obst & Gemüse, Kräuter, Blumen, Backshop / SB-Bäcker
  │
  ▼
[2. Convenience & Feinkost] ───► Salate to-go, frische Dips, Sushi, Feinkost
  │
  ▼
[3. Mittelteil: Trockensortiment] (Center Store – geplante Stichfahrten)
  │  ├─ Frühstück (Kaffee, Tee, Müsli, Aufstriche)
  │  ├─ Grundnahrungsmittel (Nudeln, Reis, Getreide, Hülsenfrüchte)
  │  ├─ Kochen & Backen (Öle, Essig, Gewürze, Backzutaten, Saucen)
  │  ├─ Konserven & Fertiggerichte
  │  ├─ Süßwaren & Knabberartikel
  │  └─ Getränke (Wasser, Saft, Softdrinks, Bier, Wein)
  │
  ▼
[4. Mittelteil: Non-Food & Drogerie]
  │  ├─ Drogerie & Körperpflege
  │  ├─ Baby & Kind
  │  ├─ Haushalt & Reinigung
  │  └─ Tierbedarf
  │
  ▼
[5. Frische-Rückwand / Magnetzone]
  │  ├─ Fleisch & Geflügel
  │  ├─ Fisch & Meeresfrüchte
  │  ├─ Wurst & Aufschnitt
  │  ├─ Veggie & Pflanzlich (Kühlbereich)
  │  └─ Molkerei, Käse & Eier (Milch, Butter, Joghurt)
  │
  ▼
[6. Vorkassenzone: Tiefkühlung] ──► TK-Pizza, TK-Gemüse, Eiscreme
  │
  ▼
[7. Kasse / Ausgang] ────────────► Kaugummi, Batterien, Zeitschriften
```

---

## Logische Sortier-Matrix (Datenstruktur)

Empfohlenes Ranking für Algorithmen (`sort_order` von 10 bis 210 in 10er-Schritten):

| Rang (`sort_order`) | Kategorie-ID | Anzeigename | Typische Artikel / Keywords | Standard-Lagerort (`storageKind`) |
| :--- | :--- | :--- | :--- | :--- |
| **10** | `produce` | **Obst & Gemüse** | Äpfel, Bananen, Tomaten, Salat, Gurken, Zwiebeln, Kartoffeln, Beeren, Kräuter | `fridge` |
| **20** | `bakery` | **Brot & Backwaren** | Frisches Brot, Brötchen, Toast, Croissants, Baguette, Kuchen, Gebäck | `pantry` |
| **30** | `convenience` | **Frische To-Go & Feinkost** | Fertigsalate, Sandwiches, frische Dips, Sushi, frische Pasta, Hummus | `fridge` |
| **40** | `breakfast` | **Frühstück & Cerealien** | Müsli, Haferflocken, Cornflakes, Marmelade, Honig, Nuss-Nougat-Creme | `pantry` |
| **50** | `hot_beverages` | **Kaffee, Tee & Kakao** | Kaffeebohnen, gemahlener Kaffee, Filtertüten, Teebeutel, Kakaopulver | `pantry` |
| **60** | `pantry_staples` | **Nudeln, Reis & Getreide** | Spaghetti, Nudeln, Reis, Mehl, Zucker, Linsen, Kichererbsen, Couscous | `pantry` |
| **70** | `cooking_baking` | **Öle, Essig & Gewürze** | Olivenöl, Rapsöl, Balsamico, Pfeffer, Salz, Backpulver, Hefe, Gewürze | `pantry` |
| **80** | `canned_sauces` | **Konserven & Fertiggerichte** | Passierte Tomaten, Pesto, Ketchup, Senf, Dosensuppen, Ravioli, Brühe | `pantry` |
| **90** | `snacks` | **Süßwaren & Snacks** | Schokolade, Gummibärchen, Kekse, Kartoffelchips, Salzstangen, Nüsse | `pantry` |
| **100** | `beverages` | **Getränke** | Mineralwasser, Säfte, Limonaden, Cola, Bier, Wein, Sekt, Spirituosen | `fridge` |
| **110** | `drugstore` | **Drogerie & Körperpflege** | Shampoo, Duschgel, Zahnpasta, Seife, Deo, Creme, Rasierer, Pflaster | `pantry` |
| **120** | `baby_kids` | **Baby & Kind** | Windeln, Feuchttücher, Babynahrung, Gläschen, Folgemilch | `pantry` |
| **130** | `household` | **Haushalt & Reinigung** | Toilettenpapier, Küchenrolle, Spülmittel, Waschmittel, Müllbeutel, Putzmittel | `pantry` |
| **140** | `pet_supplies` | **Tierbedarf** | Katzenfutter, Hundefutter, Streu, Tierleckerlis | `pantry` |
| **150** | `meat_poultry` | **Fleisch & Geflügel** | Hackfleisch, Hähnchenbrust, Rindfleisch, Schweinefleisch, Bratwurst | `fridge` |
| **160** | `fish_seafood` | **Fisch & Meeresfrüchte** | Lachs, Forelle, Garnelen, Thunfisch, Fischstäbchen (frisch) | `fridge` |
| **170** | `deli_cold_cuts` | **Wurst & Aufschnitt** | Salami, Kochschinken, Bacon, Wiener Würstchen, Leberkäse, Mortadella | `fridge` |
| **180** | `plant_based` | **Veggie & Pflanzlich** | Tofu, veganer Käse, Hafermilch (Kühl), Soja-Joghurt, Veggie-Aufschnitt | `fridge` |
| **190** | `dairy_eggs` | **Molkerei, Käse & Eier** | Milch, Butter, Quark, Joghurt, Käse, Sahne, Mozzarella, Eier | `fridge` |
| **200** | `frozen` | **Tiefkühlkost** | TK-Pizza, TK-Gemüse, TK-Beeren, Pommes, Eiscreme, TK-Fisch | `freezer` |
| **210** | `checkout` | **Kasse & Impulsware** | Kaugummi, Batterien, Zeitschriften, Feuerzeug | `pantry` |