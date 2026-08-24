# Alpha: Einkaufsbereiche – kanonische Referenz

Taxonomie-Version: `placement-taxonomy-v2`  
Quelle der Wahrheit nach der Umsetzung:
`src/features/shopping-list/classification/placement-taxonomy.ts`

Die IDs sind stabil und werden gespeichert. Labels, Farben und Lagerorte sind
Domänendaten der jeweiligen Taxonomieversion.

| Rang | ID | Label | Farbe | Standard-Lagerort |
| ---: | --- | --- | --- | --- |
| 10 | `fresh_produce` | Obst & Gemüse | `#748C5B` | `fridge` |
| 20 | `bakery` | Brot & Backwaren | `#C6A24A` | `pantry` |
| 30 | `chilled_dairy_eggs` | Milchprodukte & Eier | `#5C7396` | `fridge` |
| 40 | `ambient_milk_drinks` | Haltbare Milch, Pflanzendrinks & Kochsahne | `#7B86A5` | `pantry` |
| 50 | `chilled_plant_based` | Vegane Kühlprodukte | `#6B8756` | `fridge` |
| 60 | `meat_poultry` | Fleisch & Geflügel | `#A6483D` | `fridge` |
| 70 | `fish_seafood` | Fisch & Meeresfrüchte | `#457287` | `fridge` |
| 80 | `deli` | Käse, Aufschnitt & Feinkost | `#964B4B` | `fridge` |
| 90 | `pasta_tomato` | Nudeln & Tomatenprodukte | `#B5623F` | `pantry` |
| 100 | `rice_world_foods` | Reis, Getreide & Hülsenfrüchte | `#8B6B4A` | `pantry` |
| 110 | `breakfast` | Frühstück & Brotaufstriche | `#C08A4E` | `pantry` |
| 120 | `baking` | Backen & Grundzutaten | `#B89462` | `pantry` |
| 130 | `oils_spices` | Öle, Essig & Gewürze | `#B57B48` | `pantry` |
| 140 | `condiments` | Ketchup, Senf & Würzsaucen | `#A95745` | `pantry` |
| 150 | `canned_jars` | Konserven & Gläser | `#9B604A` | `pantry` |
| 160 | `ready_meals` | Fertiggerichte & Suppen | `#9B7864` | `pantry` |
| 170 | `snacks` | Snacks & Nüsse | `#8B6F72` | `pantry` |
| 180 | `sweets` | Süßwaren | `#A16A82` | `pantry` |
| 190 | `cold_drinks` | Wasser, Saft & Softdrinks | `#4F8580` | `fridge` |
| 200 | `hot_drinks` | Kaffee, Tee & Kakao | `#6A564A` | `pantry` |
| 210 | `alcohol` | Alkohol | `#7B5D6E` | `pantry` |
| 220 | `frozen` | Tiefkühl | `#6C7F99` | `freezer` |
| 230 | `baby` | Baby | `#8C6C82` | `pantry` |
| 240 | `pets` | Tierbedarf | `#736B5E` | `pantry` |
| 250 | `household` | Haushalt & Reinigung | `#5A6F7C` | `pantry` |
| 260 | `personal_care` | Drogerie & Körperpflege | `#705773` | `pantry` |
| 270 | `other` | Sonstiges | `#786F79` | `pantry` |

## Legacy-Fallbacks

| Legacy-ID | V2-Zone |
| --- | --- |
| `produce` | `fresh_produce` |
| `bakery` | `bakery` |
| `convenience` | `deli` |
| `breakfast` | `breakfast` |
| `hot_beverages` | `hot_drinks` |
| `pantry_staples` | `rice_world_foods` |
| `cooking_baking` | `oils_spices` |
| `canned_sauces` | `canned_jars` |
| `snacks` | `snacks` |
| `beverages` | `cold_drinks` |
| `drugstore` | `personal_care` |
| `baby_kids` | `baby` |
| `household` | `household` |
| `pet_supplies` | `pets` |
| `meat_poultry` | `meat_poultry` |
| `fish_seafood` | `fish_seafood` |
| `deli_cold_cuts` | `deli` |
| `plant_based` | `chilled_plant_based` |
| `dairy_eggs` | `chilled_dairy_eggs` |
| `frozen` | `frozen` |
| `checkout` | `other` |
| `deli_meat` | `deli` |
| `pantry_canned` | `canned_jars` |
| `pantry_dry` | `rice_world_foods` |
| `dairy` | `chilled_dairy_eggs` |

Bei mehrdeutigen Legacy-IDs entscheidet zuerst die V2-Klassifikation anhand
von Produktdaten, OFF-Tags und Name. Diese Tabelle ist nur der Fallback.
