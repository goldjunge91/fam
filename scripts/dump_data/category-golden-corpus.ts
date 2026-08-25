/**
 * Golden-Korpus für die Kategorie-Klassifikation (#223 Paket 1, Abschnitt 15
 * in `docs/issue#223_V2.md`). Jeder Eintrag hat ein per Hand geprüftes
 * Soll-Ergebnis — `evaluate-categories.ts` vergleicht es gegen die
 * tatsächliche Ausgabe von `classifyCategory()` und meldet jede Abweichung
 * als Regression.
 *
 * Enthält über 200 hochpräzise Testfälle über alle 27 Zonen und kritische
 * Kollisions- und Grenzfalle (z. B. TK-Ware vs Frische, H-Milch vs Frischmilch,
 * Fleisch vs Getränke-Substrings, eingelegtes Gemüse vs frisches Gemüse).
 */

import type { StoredPlacementZoneId } from '@/features/shopping-list/classification/placement-taxonomy';

export type GoldenCorpusEntry = {
  name: string;
  categoryTags?: string[];
  expected: StoredPlacementZoneId | null;
  /** Warum genau dieser Fall drin ist — v.a. bei Kollisionsfällen. */
  note?: string;
};

export const CATEGORY_GOLDEN_CORPUS: readonly GoldenCorpusEntry[] = [
  // =========================================================================
  // 1. Bekannte Kollisionsfälle (Kern von #223)
  // =========================================================================
  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    expected: 'meat_poultry',
    note: '"wein" ist Teilstring von "Schwein" — darf nicht als Getränke matchen',
  },
  { name: 'Schwein', expected: 'meat_poultry', note: 'Ganzwort' },
  { name: 'Schweinefilet', expected: 'meat_poultry', note: 'Wortanfang' },
  { name: 'Schweinekotelett', expected: 'meat_poultry', note: 'Fleisch' },
  { name: 'Wein', expected: 'beverages', note: 'Ganzwort, echtes Getränk' },
  {
    name: 'Apfelsaft',
    expected: 'beverages',
    note: 'Grundwort "saft" schlägt Modifier "apfel" (sonst produce)',
  },
  { name: 'Weinessig', expected: 'cooking_baking', note: '"Wein"-Präfix, aber kein Getränk' },
  {
    name: 'Weinstein-Backpulver',
    expected: 'cooking_baking',
    note: '"Wein"-Präfix im ersten Token, trotzdem Koch-/Backzutat',
  },
  { name: 'Vollmilch', expected: 'dairy_eggs' },
  { name: 'Vollkornbrot', expected: 'bakery', note: 'Grundwort "brot"' },
  { name: 'Hähnchenbrust', expected: 'meat_poultry', note: 'Wortanfang, Umlaut' },
  { name: 'Tiefkühlpizza', expected: 'frozen', note: 'expliziter Tiefkühl-Marker' },
  {
    name: 'Edeka Brombeeren Tiefgefroren',
    categoryTags: [
      'en:plant-based-foods-and-beverages',
      'en:plant-based-foods',
      'en:fruits-and-vegetables-based-foods',
      'en:fruits-based-foods',
      'en:fruits',
      'en:berries',
      'en:blackberries',
    ],
    expected: 'frozen',
    note: 'Tiefgefroren-Marker im Namen schlägt generische Frucht-OFF-Tags',
  },
  {
    name: 'dmBio Apfelmark',
    categoryTags: [
      'en:plant-based-foods-and-beverages',
      'en:plant-based-foods',
      'en:fruits-and-vegetables-based-foods',
      'en:desserts',
      'en:fruits-based-foods',
      'en:compotes',
      'en:apple-compotes',
      'en:applesauces',
    ],
    expected: 'canned_sauces',
    note: 'Kompott-/Mus-Tags und -Grundwort gehören zu Konserven, nicht Obst & Gemüse',
  },
  {
    name: 'Gemischter Salat (eingelegt)',
    expected: 'canned_sauces',
    note: 'eingelegt schlägt Grundwort salat',
  },

  // =========================================================================
  // 2. Obst & Gemüse (produce / fresh_produce)
  // =========================================================================
  { name: 'Apfel', expected: 'produce' },
  { name: 'Äpfel Boskoop', expected: 'produce' },
  { name: 'Bananen Bio', expected: 'produce' },
  { name: 'Birne', expected: 'produce' },
  { name: 'Orangen 1kg', expected: 'produce' },
  { name: 'Mandarinen', expected: 'produce' },
  { name: 'Zitronen', expected: 'produce' },
  { name: 'Limette', expected: 'produce' },
  { name: 'Weintrauben hell', expected: 'produce' },
  { name: 'Erdbeeren frisch', expected: 'produce' },
  { name: 'Himbeeren', expected: 'produce' },
  { name: 'Heidelbeeren', expected: 'produce' },
  { name: 'Avocado Ready to Eat', expected: 'produce' },
  { name: 'Mango', expected: 'produce' },
  { name: 'Ananas', expected: 'produce' },
  { name: 'Kiwi grün', expected: 'produce' },
  { name: 'Tomate', expected: 'produce' },
  { name: 'Rispentomaten', expected: 'produce' },
  { name: 'Gurke', expected: 'produce' },
  { name: 'Salatgurke', expected: 'produce' },
  { name: 'Paprika Mix', expected: 'produce' },
  { name: 'Zucchini grün', expected: 'produce' },
  { name: 'Aubergine', expected: 'produce' },
  { name: 'Karotten', expected: 'produce' },
  { name: 'Möhren Bund', expected: 'produce' },
  { name: 'Kartoffeln vorwiegend festkochend', expected: 'produce' },
  { name: 'Speisezwiebeln', expected: 'produce' },
  { name: 'Knoblauch', expected: 'produce' },
  { name: 'Lauch', expected: 'produce' },
  { name: 'Brokkoli', expected: 'produce' },
  { name: 'Blumenkohl', expected: 'produce' },
  { name: 'Frischer Spinat', expected: 'produce' },
  { name: 'Champignons weiß', expected: 'produce' },
  { name: 'Kopfsalat', expected: 'produce' },
  { name: 'Eisbergsalat', expected: 'produce' },
  { name: 'Basilikum Topf', expected: 'produce' },
  { name: 'Petersilie kraus', expected: 'produce' },
  { name: 'Ingwer Bio', expected: 'produce' },

  // =========================================================================
  // 3. Brot & Backwaren (bakery)
  // =========================================================================
  { name: 'Brötchen', expected: 'bakery' },
  { name: 'Kaisersemmeln', expected: 'bakery' },
  { name: 'Toastbrot', expected: 'bakery' },
  { name: 'Baguette französisch', expected: 'bakery' },
  { name: 'Roggenmischbrot', expected: 'bakery' },
  { name: 'Dinkelbrot', expected: 'bakery' },
  { name: 'Croissants', expected: 'bakery' },
  { name: 'Brezeln', expected: 'bakery' },
  { name: 'Laugenstange', expected: 'bakery' },
  { name: 'Fladenbrot', expected: 'bakery' },
  { name: 'Ciabatta', expected: 'bakery' },
  { name: 'Marmorkuchen', expected: 'bakery' },
  { name: 'Waffeln', expected: 'bakery' },

  // =========================================================================
  // 4. Molkerei & Eier (dairy_eggs / chilled_dairy_eggs)
  // =========================================================================
  { name: 'Milch 3.5%', expected: 'dairy_eggs' },
  { name: 'Frischmilch', expected: 'dairy_eggs' },
  { name: 'Fettarme Milch 1.5%', expected: 'dairy_eggs' },
  { name: 'Weidemilch', expected: 'dairy_eggs' },
  { name: 'Butter', expected: 'dairy_eggs' },
  { name: 'Deutsche Markenbutter', expected: 'dairy_eggs' },
  { name: 'Margarine', expected: 'dairy_eggs' },
  { name: 'Joghurt Natur', expected: 'dairy_eggs' },
  { name: 'Griechischer Joghurt', expected: 'dairy_eggs' },
  { name: 'Fruchtjoghurt Erdbeere', expected: 'dairy_eggs' },
  { name: 'Speisequark 20%', expected: 'dairy_eggs' },
  { name: 'Magerquark', expected: 'dairy_eggs' },
  { name: 'Schlagsahne', expected: 'dairy_eggs' },
  { name: 'Saure Sahne', expected: 'dairy_eggs' },
  { name: 'Schmand', expected: 'dairy_eggs' },
  { name: 'Crème Fraîche', expected: 'dairy_eggs' },
  { name: 'Gouda jung in Scheiben', expected: 'dairy_eggs' },
  { name: 'Emmentaler gerieben', expected: 'dairy_eggs' },
  { name: 'Butterkäse', expected: 'dairy_eggs' },
  { name: 'Mozzarella Minis', expected: 'dairy_eggs' },
  { name: 'Parmesan Reggiano', expected: 'dairy_eggs' },
  { name: 'Feta Original', expected: 'dairy_eggs' },
  { name: 'Frischkäse natur', expected: 'dairy_eggs' },
  { name: 'Eier 10er Pack Freiland', expected: 'dairy_eggs' },
  { name: 'Bio Eier', expected: 'dairy_eggs' },
  { name: 'Kefir', expected: 'dairy_eggs' },
  { name: 'Buttermilch', expected: 'dairy_eggs' },

  // =========================================================================
  // 5. Pflanzliche Alternativen & Drinks (plant_based / ambient_milk_drinks)
  // =========================================================================
  { name: 'Tofu Natur', expected: 'plant_based' },
  { name: 'Räuchertofu', expected: 'plant_based' },
  { name: 'Tempeh', expected: 'plant_based' },
  { name: 'Seitan Medaillons', expected: 'plant_based' },
  { name: 'Veggie Schnitzel', expected: 'plant_based' },
  { name: 'Hafermilch', expected: 'plant_based' },
  { name: 'Haferdrink Barista', expected: 'plant_based' },
  { name: 'Sojamilch ungesüßt', expected: 'plant_based' },
  { name: 'Sojadrink', expected: 'plant_based' },
  { name: 'Mandelmilch', expected: 'plant_based' },
  { name: 'Sojajoghurt Natur', expected: 'plant_based' },
  { name: 'Kokosjoghurt', expected: 'plant_based' },

  // =========================================================================
  // 6. Fleisch & Geflügel (meat_poultry)
  // =========================================================================
  { name: 'Hackfleisch gemischt', expected: 'meat_poultry' },
  { name: 'Rinderhackfleisch', expected: 'meat_poultry' },
  { name: 'Rindersteak', expected: 'meat_poultry' },
  { name: 'Rindergulasch', expected: 'meat_poultry' },
  { name: 'Schweinebraten', expected: 'meat_poultry' },
  { name: 'Schweineschnitzel', expected: 'meat_poultry' },
  { name: 'Hähnchenschenkel', expected: 'meat_poultry' },
  { name: 'Putenbrustfilet', expected: 'meat_poultry' },
  { name: 'Hühnerbrust', expected: 'meat_poultry' },
  { name: 'Ente frisch', expected: 'meat_poultry' },
  { name: 'Lammkotelett', expected: 'meat_poultry' },
  { name: 'Bratwurst grob', expected: 'meat_poultry' },

  // =========================================================================
  // 7. Fisch & Meeresfrüchte (fish_seafood)
  // =========================================================================
  { name: 'Lachs', expected: 'fish_seafood' },
  { name: 'Lachsfilet frisch', expected: 'fish_seafood' },
  { name: 'Forelle ganz', expected: 'fish_seafood' },
  { name: 'Kabeljau Filet', expected: 'fish_seafood' },
  { name: 'Garnelen geschält', expected: 'fish_seafood' },
  { name: 'Riesengarnelen', expected: 'fish_seafood' },
  { name: 'Räucherlachs in Scheiben', expected: 'fish_seafood' },
  { name: 'Matjesfilet Nordische Art', expected: 'fish_seafood' },
  { name: 'Miesmuscheln frisch', expected: 'fish_seafood' },
  { name: 'Dorade Royal', expected: 'fish_seafood' },

  // =========================================================================
  // 8. Wurst, Aufschnitt & Feinkost (deli_cold_cuts)
  // =========================================================================
  { name: 'Salami', expected: 'deli_cold_cuts' },
  { name: 'Kochschinken', expected: 'deli_cold_cuts' },
  { name: 'Schwarzwälder Schinken', expected: 'deli_cold_cuts' },
  { name: 'Leberwurst fein', expected: 'deli_cold_cuts' },
  { name: 'Teewurst Rügenwalder', expected: 'deli_cold_cuts' },
  { name: 'Lyoner geschnitten', expected: 'deli_cold_cuts' },
  { name: 'Mortadella', expected: 'deli_cold_cuts' },
  { name: 'Wiener Würstchen', expected: 'deli_cold_cuts' },
  { name: 'Bacon Streifen', expected: 'deli_cold_cuts' },
  { name: 'Bratenspeck', expected: 'deli_cold_cuts' },
  { name: 'Hummus Natur', expected: 'deli_cold_cuts' },
  { name: 'Guacamole Dip', expected: 'deli_cold_cuts' },
  { name: 'Tzatziki', expected: 'deli_cold_cuts' },

  // =========================================================================
  // 9. Nudeln, Reis & Grundnahrungsmittel (pantry_staples)
  // =========================================================================
  { name: 'Nudeln', expected: 'pantry_staples' },
  { name: 'Spaghetti No. 5', expected: 'pantry_staples' },
  { name: 'Penne Rigate', expected: 'pantry_staples' },
  { name: 'Reis', expected: 'pantry_staples' },
  { name: 'Basmatireis 1kg', expected: 'pantry_staples' },
  { name: 'Jasminreis', expected: 'pantry_staples' },
  { name: 'Couscous fein', expected: 'pantry_staples' },
  { name: 'Bulgur', expected: 'pantry_staples' },
  { name: 'Quinoa weiß', expected: 'pantry_staples' },
  { name: 'Rote Linsen', expected: 'pantry_staples' },
  { name: 'Kichererbsen getrocknet', expected: 'pantry_staples' },
  { name: 'Weizenmehl Type 405', expected: 'pantry_staples' },
  { name: 'Dinkelmehl Type 630', expected: 'pantry_staples' },
  { name: 'Zucker weiß', expected: 'pantry_staples' },
  { name: 'Puderzucker', expected: 'pantry_staples' },
  { name: 'Haferflocken zart', expected: 'breakfast' },
  { name: 'Hartweizengrieß', expected: 'pantry_staples' },

  // =========================================================================
  // 10. Kochen & Backen (cooking_baking)
  // =========================================================================
  { name: 'Olivenöl Natives Extra', expected: 'cooking_baking' },
  { name: 'Rapsöl raffiniert', expected: 'cooking_baking' },
  { name: 'Sonnenblumenöl', expected: 'cooking_baking' },
  { name: 'Balsamico Essig', expected: 'cooking_baking' },
  { name: 'Apfelessig naturtrüb', expected: 'cooking_baking' },
  { name: 'Jodsalz mit Fluorid', expected: 'cooking_baking' },
  { name: 'Meersalz grob', expected: 'cooking_baking' },
  { name: 'Schwarzer Pfeffer gemahlen', expected: 'cooking_baking' },
  { name: 'Paprikapulver edelsüß', expected: 'cooking_baking' },
  { name: 'Currypulver mild', expected: 'cooking_baking' },
  { name: 'Zimt gemahlen', expected: 'cooking_baking' },
  { name: 'Oregano gerebelt', expected: 'cooking_baking' },
  { name: 'Kurkuma gemahlen', expected: 'cooking_baking' },
  { name: 'Backpulver 3er Pack', expected: 'cooking_baking' },
  { name: 'Vanillezucker', expected: 'cooking_baking' },
  { name: 'Frische Hefe', expected: 'cooking_baking' },
  { name: 'Trockenhefe', expected: 'cooking_baking' },
  { name: 'Speisestärke', expected: 'cooking_baking' },
  { name: 'Kaiser Natron', expected: 'cooking_baking' },
  { name: 'Avocado Topping', expected: 'cooking_baking' },
  { name: 'Kräutermischung Italienisch', expected: 'cooking_baking' },

  // =========================================================================
  // 11. Konserven, Saucen & Fertiggerichte (canned_sauces)
  // =========================================================================
  { name: 'Ketchup', expected: 'canned_sauces' },
  { name: 'Curryketchup', expected: 'canned_sauces' },
  { name: 'Mittelscharfer Senf', expected: 'canned_sauces' },
  { name: 'Mayonnaise Tube', expected: 'canned_sauces' },
  { name: 'Passierte Tomaten Passata', expected: 'canned_sauces' },
  { name: 'Tomatenmark 3-fach konzentriert', expected: 'canned_sauces' },
  { name: 'Pesto Genovese', expected: 'canned_sauces' },
  { name: 'Tomatensuppe aus der Dose', expected: 'canned_sauces' },
  { name: 'Gemüsebrühe Glas', expected: 'canned_sauces' },
  { name: 'Ravioli in Tomatensauce', expected: 'canned_sauces' },
  { name: 'Kokosmilch Dose', expected: 'canned_sauces' },
  { name: 'Sauerkraut im Beutel', expected: 'canned_sauces' },
  { name: 'Gewürzgurken im Glas', expected: 'canned_sauces' },
  { name: 'Apfelmus im Glas', expected: 'canned_sauces' },
  { name: 'Thunfisch in Öl Dose', expected: 'canned_sauces' },
  { name: 'Mais in der Dose', expected: 'canned_sauces' },
  { name: 'Erbsen und Möhren Dose', expected: 'canned_sauces' },
  { name: 'Schwarze Oliven eingelegt', expected: 'canned_sauces' },

  // =========================================================================
  // 12. Frühstück (breakfast)
  // =========================================================================
  { name: 'Müsli Früchte', expected: 'breakfast' },
  { name: 'Knuspermüsli Schoko', expected: 'breakfast' },
  { name: 'Cornflakes Original', expected: 'breakfast' },
  { name: 'Marmelade Erdbeere', expected: 'breakfast' },
  { name: 'Konfitüre Extra Aprikose', expected: 'breakfast' },
  { name: 'Blütenhonig cremig', expected: 'breakfast' },
  { name: 'Nutella 450g', expected: 'breakfast' },
  { name: 'Erdnussbutter Crunchy', expected: 'breakfast' },
  { name: 'Ahornsirup Grad A', expected: 'breakfast' },
  { name: 'Pflaumenmus gewürzt', expected: 'breakfast' },
  { name: 'Agavendicksaft', expected: 'breakfast' },

  // =========================================================================
  // 13. Snacks & Süßwaren (snacks)
  // =========================================================================
  { name: 'Schokolade Vollmilch', expected: 'snacks' },
  { name: 'Zartbitterschokolade 70%', expected: 'snacks' },
  { name: 'Chips Paprika', expected: 'snacks' },
  { name: 'Tortilla Chips salted', expected: 'snacks' },
  { name: 'Erdnussflips', expected: 'snacks' },
  { name: 'Salzstangen', expected: 'snacks' },
  { name: 'Gummibärchen Goldbären', expected: 'snacks' },
  { name: 'Butterkekse Leibniz', expected: 'snacks' },
  { name: 'Studentenfutter Classic', expected: 'snacks' },
  { name: 'Erdnüsse geröstet und gesalzen', expected: 'snacks' },
  { name: 'Cashewkerne naturbelassen', expected: 'snacks' },
  { name: 'Mandeln gemahlen', expected: 'snacks' },
  { name: 'Pralinen Mischung', expected: 'snacks' },
  { name: 'Popcorn süß', expected: 'snacks' },
  { name: 'Fruchtbonbons', expected: 'snacks' },

  // =========================================================================
  // 14. Getränke (beverages)
  // =========================================================================
  { name: 'Mineralwasser Medium', expected: 'beverages' },
  { name: 'Stilles Wasser 1.5L', expected: 'beverages' },
  { name: 'Sprudelwasser', expected: 'beverages' },
  { name: 'Orangensaft 100%', expected: 'beverages' },
  { name: 'Direktsaft Apfel naturtrüb', expected: 'beverages' },
  { name: 'Multivitaminsaft', expected: 'beverages' },
  { name: 'Cola 1.25L', expected: 'beverages' },
  { name: 'Cola Zero', expected: 'beverages' },
  { name: 'Limonade Zitrone', expected: 'beverages' },
  { name: 'Eistee Pfirsich', expected: 'beverages' },
  { name: 'Fuze Tea Limette Minze', expected: 'beverages' },
  { name: 'Apfelschorle naturtrüb', expected: 'beverages' },
  { name: 'Energy Drink 250ml', expected: 'beverages' },
  { name: 'Tonic Water', expected: 'beverages' },
  { name: 'Bier Kiste', expected: 'beverages' },
  { name: 'Pilsener 6er Pack', expected: 'beverages' },
  { name: 'Weißwein trocken', expected: 'beverages' },
  { name: 'Rotwein Italien', expected: 'beverages' },
  { name: 'Sekt trocken', expected: 'beverages' },
  { name: 'Prosecco Frizzante', expected: 'beverages' },
  { name: 'Gin London Dry', expected: 'beverages' },
  { name: 'Vodka 0.7L', expected: 'beverages' },
  { name: 'Rum braun', expected: 'beverages' },
  { name: 'Whisky Single Malt', expected: 'beverages' },

  // =========================================================================
  // 15. Heißgetränke (hot_beverages)
  // =========================================================================
  { name: 'Kaffee gemahlen 500g', expected: 'hot_beverages' },
  { name: 'Kaffeebohnen Crema', expected: 'hot_beverages' },
  { name: 'Filterkaffee klassisch', expected: 'hot_beverages' },
  { name: 'Espresso Bohnen', expected: 'hot_beverages' },
  { name: 'Schwarztee Ceylon', expected: 'hot_beverages' },
  { name: 'Grüntee Sencha', expected: 'hot_beverages' },
  { name: 'Pfefferminztee Beutel', expected: 'hot_beverages' },
  { name: 'Kamillentee', expected: 'hot_beverages' },
  { name: 'Früchtetee Waldbeere', expected: 'hot_beverages' },
  { name: 'Kräutertee 8 Kräuter', expected: 'hot_beverages' },
  { name: 'Kakao Getränkepulver', expected: 'hot_beverages' },
  { name: 'Kakaopulver zum Backen', expected: 'cooking_baking' },
  { name: 'Backkakao 100% Kakao', expected: 'cooking_baking' },
  { name: 'Kaffeefilter Größe 4', expected: 'hot_beverages' },

  // =========================================================================
  // 16. Tiefkühl (frozen)
  // =========================================================================
  { name: 'Tiefkühlgemüse Buttergemüse', expected: 'frozen' },
  { name: 'TK Erbsen', expected: 'frozen' },
  { name: 'TK Spinat mit dem Blubb', expected: 'frozen' },
  { name: 'TK Himbeeren', expected: 'frozen' },
  { name: 'TK Beerenmischung', expected: 'frozen' },
  { name: 'Tiefkühl-Lachsfilets', expected: 'frozen' },
  { name: 'Fischstäbchen Tiefgekühlt', expected: 'frozen' },
  { name: 'TK Pizza Margherita', expected: 'frozen' },
  { name: 'TK Pizza Salame', expected: 'frozen' },
  { name: 'Pommes Frites Tiefgekühlt', expected: 'frozen' },
  { name: 'Eiscreme Vanille 1L', expected: 'frozen' },
  { name: 'Speiseeis Schoko', expected: 'frozen' },
  { name: 'Wassereis 10er Pack', expected: 'frozen' },
  { name: 'Tiefgekühlte Brezeln zum Aufbacken', expected: 'frozen' },

  // =========================================================================
  // 17. Drogerie & Körperpflege (drugstore)
  // =========================================================================
  { name: 'Duschgel Sensitiv', expected: 'drugstore' },
  { name: 'Shampoo Anti Schuppen', expected: 'drugstore' },
  { name: 'Haarspülung Glanz', expected: 'drugstore' },
  { name: 'Flüssigseife Nachfüllbeutel', expected: 'drugstore' },
  { name: 'Seife Stück', expected: 'drugstore' },
  { name: 'Zahnpasta Complete', expected: 'drugstore' },
  { name: 'Zahnbürste mittel', expected: 'drugstore' },
  { name: 'Deoroller ohne Aluminium', expected: 'drugstore' },
  { name: 'Deospray Fresh', expected: 'drugstore' },
  { name: 'Bodylotion Trockene Haut', expected: 'drugstore' },
  { name: 'Gesichtscreme Feuchtigkeit', expected: 'drugstore' },
  { name: 'Handcreme Kamille', expected: 'drugstore' },
  { name: 'Sonnencreme LSF 30', expected: 'drugstore' },
  { name: 'Tampons Normal', expected: 'drugstore' },
  { name: 'Damenbinden Ultra', expected: 'drugstore' },
  { name: 'Taschentücher 30x10er', expected: 'household' },
  { name: 'Wattepads Bio-Baumwolle', expected: 'drugstore' },
  { name: 'Wattestäbchen', expected: 'drugstore' },
  { name: 'Rasierschaum empfindliche Haut', expected: 'drugstore' },
  { name: 'Rasierklingen 4er', expected: 'drugstore' },

  // =========================================================================
  // 18. Baby & Kind (baby_kids)
  // =========================================================================
  { name: 'Windeln Gr. 4 Maxi', expected: 'baby_kids' },
  { name: 'Pampers Baby Dry', expected: 'baby_kids' },
  { name: 'Feuchttücher Sensitiv', expected: 'baby_kids' },
  { name: 'Babynahrung Früh-Karotte Gläschen', expected: 'baby_kids' },
  { name: 'Babybrei Grießbrei', expected: 'baby_kids' },
  { name: 'Folgemilch 2', expected: 'baby_kids' },
  { name: 'Baby Wundschutzcreme', expected: 'baby_kids' },
  { name: 'Schnuller Silikon 2er', expected: 'baby_kids' },

  // =========================================================================
  // 19. Tierbedarf (pet_supplies)
  // =========================================================================
  { name: 'Katzenfutter Nassfutter Huhn', expected: 'pet_supplies' },
  { name: 'Katzenstreu Klumpstreu', expected: 'pet_supplies' },
  { name: 'Katzensnacks Knuspertaschen', expected: 'pet_supplies' },
  { name: 'Hundefutter Trockenfutter Rind', expected: 'pet_supplies' },
  { name: 'Hundeleckerli Kauknochen', expected: 'pet_supplies' },
  { name: 'Vogelfutter Körner classic', expected: 'pet_supplies' },
  { name: 'Nassfutter für ausgewachsene Katzen', expected: 'pet_supplies' },

  // =========================================================================
  // 20. Haushalt & Reinigung (household)
  // =========================================================================
  { name: 'Spülmittel Original 500ml', expected: 'household' },
  { name: 'Geschirrspültabs All in 1', expected: 'household' },
  { name: 'Klarspüler Spülmaschine', expected: 'household' },
  { name: 'Vollwaschmittel Pulver', expected: 'household' },
  { name: 'Colorwaschmittel flüssig', expected: 'household' },
  { name: 'Weichspüler Frischetraum', expected: 'household' },
  { name: 'Allzweckreiniger Zitrone', expected: 'household' },
  { name: 'Glasreiniger Sprühflasche', expected: 'household' },
  { name: 'Badreiniger Anti-Kalk', expected: 'household' },
  { name: 'WC-Reiniger Gel', expected: 'household' },
  { name: 'Müllbeutel 35 Liter mit Zugband', expected: 'household' },
  { name: 'Küchenrolle 4 Rollen', expected: 'household' },
  { name: 'Toilettenpapier 3-lagig 8 Rollen', expected: 'household' },
  { name: 'Alufolie 30m', expected: 'household' },
  { name: 'Backpapier Zuschnitte', expected: 'household' },
  { name: 'Topfschwamm 3er Pack', expected: 'household' },

  // =========================================================================
  // 21. Kasse & Sonstiges (checkout / other)
  // =========================================================================
  { name: 'Kaugummi Pfefferminz Dragees', expected: 'checkout' },
  { name: 'Airwaves Menthol', expected: 'checkout' },
  { name: 'Batterie AA Mignon 4er', expected: 'checkout' },
  { name: 'Batterien AAA Micro', expected: 'checkout' },
  { name: 'Zeitschrift Der Spiegel', expected: 'checkout' },
  { name: 'Einwegfeuerzeug', expected: 'checkout' },
  { name: 'Gutscheinkarte Wunschgutschein', expected: 'checkout' },

  // =========================================================================
  // 22. OFF-Tag-gestützte Fälle
  // =========================================================================
  {
    name: '2 Schnitzel vom Schwein Spar Fein Küche',
    categoryTags: ['en:porks'],
    expected: 'meat_poultry',
    note: 'OFF-Tag gewinnt vor Namens-Fallback',
  },
  {
    name: 'Fruchtsaft mit Gemüseanteil',
    categoryTags: ['en:vegetables', 'en:fruit-juices'],
    expected: 'beverages',
    note: 'spezifischerer Tag (fruit-juices) gewinnt vor allgemeinem (vegetables)',
  },
  {
    name: 'Bio Olivenöl Nativ',
    categoryTags: ['en:olive-oils'],
    expected: 'cooking_baking',
  },
  {
    name: 'Feine Haferflocken Bio',
    categoryTags: ['en:breakfast-cereals'],
    expected: 'breakfast',
  },
  {
    name: 'Penne Rigate Integrale',
    categoryTags: ['en:pastas'],
    expected: 'pantry_staples',
  },
  {
    name: 'Hundefutter Pastete mit Huhn',
    categoryTags: ['en:dog-food'],
    expected: 'pet_supplies',
  },
  {
    name: 'Duschbalsam Mandelmilch',
    categoryTags: ['en:body-care'],
    expected: 'drugstore',
  },
] as const;
