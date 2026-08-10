Standard-Laufstrecke im Supermarkt (für Einkaufslisten-Sortierung)
Eine praxisnahe Kategorie-Reihenfolge zur Sortierung von Einkaufslisten, basierend auf der typischen Wegführung in deutschen Supermärkten (REWE, Edeka, ALDI, Lidl):

1. Obst & Gemüse (Eingang / Frischebereich)

2. Backwaren & Brot (SB-Backstation / Bäcker)

3. Kühlregal - Frische (Wurst, Käse, Feinkost)

4. Feinkost & Konserven (Saucen, Dosen, Fertiggerichte)

5. Grundnahrungsmittel (Nudeln, Reis, Mehl, Zucker, Öl, Gewürze)

6. Müsli & Frühstück (Haferflocken, Aufstriche, Kaffee, Tee)

7. Süßwaren & Knabberzeug (Snacks, Schokolade, Chips)

8. Getränke (Wasser, Säfte, Bier, Softdrinks)

9. Kühlregal - Molkerei (Milch, Butter, Joghurt, Quark)

10. Tiefkühlware (TK) (TK-Pizza, TK-Gemüse, Eis)

11. Drogerie & Haushalt (Reinigungsmittel, Hygiene, Tiernahrung)

12. Kassenzone (Quengelware, Kaugummi, Zeitschriften)

---

Logische Sortier-Matrix (Datenstruktur)
Empfohlenes Ranking für Algorithmen (`sort_order` von 10 bis 120 in Zehnerschritten):
Empfohlenes Ranking für Algorithmen (sort_order von 10 bis 120 in Zehnerschritten):

  - Priority 10: Obst & Gemüse (PRODUCE) -> Äpfel, Bananen, Tomaten, Salat, Kartoffeln
  - Priority 20: Brot & Backwaren (BAKERY) -> Aufbackbrötchen, Vollkornbrot, Croissants
  - Priority 30: Wurst & Fleisch Kühl (DELI_MEAT) -> Hackfleisch, Hähnchenbrust, Salami
  - Priority 40: Konserven & Saucen (PANTRY_CANNED) -> Passierte Tomaten, Bohnen, Pesto
  - Priority 50: Grundnahrungsmittel (PANTRY_DRY) -> Nudeln, Reis, Mehl, Öl, Essig, Gewürze
  - Priority 60: Müsli & Aufstriche (BREAKFAST) -> Haferflocken, Marmelade, Nutella, Kaffee
  - Priority 70: Snacks & Süßes (SNACKS) -> Schokolade, Chips, Nüsse, Kekse
  - Priority 80: Getränke (BEVERAGES) -> Mineralwasser, Apfelsaft, Bier
  - Priority 90: Molkereiprodukte (DAIRY) -> Milch, Butter, Joghurt, Käse, Sahne
  - Priority 100: Tiefkühlkost (FROZEN) -> TK-Pizza, TK-Erbsen, Eiscreme
  - Priority 110: Drogerie & Haushalt (DRUGSTORE) -> Toilettenpapier, Spülmittel, Shampoo
  - Priority 120: Kasse / Impulsware (CHECKOUT) -> Kaugummi, Batterien