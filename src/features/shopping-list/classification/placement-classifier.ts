import { normalizeShoppingName } from './normalize-shopping-name';
import {
  normalizePlacementZoneId,
  PLACEMENT_CLASSIFIER_VERSION,
  type PlacementZoneId,
  type ProductFamilyId,
  type ProductFormId,
  resolvePlacementZone,
} from './placement-taxonomy';
import { classifyCategory, explainCategory } from './shopping-category-classifier';
import type {
  CategoryClassifierInput,
  PlacementClassification,
  PlacementClassificationInput,
  PlacementEvidence,
  PlacementTrace,
} from './types';

type ProductDescriptor = {
  family: ProductFamilyId;
  form: ProductFormId;
  evidence: PlacementEvidence;
};

type ZoneDescriptor = Omit<ProductDescriptor, 'evidence'>;

const DEFAULT_BY_ZONE: Readonly<Record<PlacementZoneId, ZoneDescriptor>> = {
  fresh_produce: { family: 'fruit', form: 'fresh' },
  bakery: { family: 'bread_baked_goods', form: 'fresh' },
  chilled_dairy_eggs: { family: 'milk', form: 'chilled' },
  ambient_milk_drinks: { family: 'milk', form: 'ambient' },
  chilled_plant_based: { family: 'tofu_meat_alternative', form: 'chilled' },
  meat_poultry: { family: 'meat', form: 'chilled' },
  fish_seafood: { family: 'fish_seafood', form: 'chilled' },
  deli: { family: 'deli_cold_cuts', form: 'chilled' },
  pasta_tomato: { family: 'pasta', form: 'dry' },
  rice_world_foods: { family: 'rice', form: 'dry' },
  breakfast: { family: 'breakfast_cereal', form: 'dry' },
  baking: { family: 'flour_baking', form: 'dry' },
  oils_spices: { family: 'oil_vinegar', form: 'ambient' },
  condiments: { family: 'condiments', form: 'ambient' },
  canned_jars: { family: 'canned_food', form: 'canned_jarred' },
  ready_meals: { family: 'soup_ready_meal', form: 'prepared' },
  snacks: { family: 'savory_snacks', form: 'ambient' },
  sweets: { family: 'sweets', form: 'ambient' },
  cold_drinks: { family: 'water_soft_drinks', form: 'ambient' },
  hot_drinks: { family: 'coffee', form: 'dry' },
  alcohol: { family: 'alcoholic_beverages', form: 'ambient' },
  frozen: { family: 'other_food', form: 'frozen' },
  baby: { family: 'baby_food', form: 'ambient' },
  pets: { family: 'pet_food', form: 'ambient' },
  household: { family: 'household_cleaning', form: 'ambient' },
  personal_care: { family: 'personal_care', form: 'ambient' },
  other: { family: 'other_food', form: 'ambient' },
};

type OffDescriptorRule = ProductDescriptor & { tags: readonly string[] };

/** Spezifische OFF-Tags verfeinern die V2-Familie und Verkaufsform für alle 27 Zonen. */
const OFF_DESCRIPTOR_RULES: readonly OffDescriptorRule[] = [
  // 1. fresh_produce (Obst, Gemüse, Kräuter, Kartoffeln/Zwiebeln)
  {
    tags: [
      'en:fresh-fruits',
      'en:raw-fruits',
      'en:apples',
      'en:bananas',
      'en:berries',
      'en:citrus',
    ],
    family: 'fruit',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:fresh-fruits' },
  },
  {
    tags: [
      'en:fresh-vegetables',
      'en:raw-vegetables',
      'en:tomatoes',
      'en:cucumbers',
      'en:carrots',
      'en:fresh-salads',
      'en:fresh-mushrooms',
    ],
    family: 'vegetables',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:fresh-vegetables' },
  },
  {
    tags: ['en:fresh-herbs'],
    family: 'herbs',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:fresh-herbs' },
  },
  {
    tags: ['en:potatoes', 'en:onions', 'en:garlic'],
    family: 'potatoes_onions',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:potatoes' },
  },

  // 2. bakery (Brot & Backwaren)
  {
    tags: [
      'en:breads',
      'en:viennoiseries',
      'en:baguettes',
      'en:buns',
      'en:sliced-breads',
      'en:rusks',
      'en:toast',
      'en:croissants',
      'en:cakes',
      'en:pastries',
      'en:pies',
      'en:tarts',
    ],
    family: 'bread_baked_goods',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:breads' },
  },

  // 3. chilled_dairy_eggs (Frische Molkerei & Eier)
  {
    tags: ['en:fresh-milks', 'en:pasteurized-milks'],
    family: 'milk',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:fresh-milks' },
  },
  {
    tags: ['en:yogurts', 'en:plain-yogurts', 'en:fruit-yogurts'],
    family: 'yogurt',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:yogurts' },
  },
  {
    tags: ['en:cheeses', 'en:fresh-cheeses', 'en:curd-cheeses', 'en:cottage-cheeses'],
    family: 'cheese',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:cheeses' },
  },
  {
    tags: ['en:butters', 'en:margarines', 'en:dairy-spreads'],
    family: 'butter_margarine',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:butters' },
  },
  {
    tags: ['en:creams', 'en:sour-creams'],
    family: 'cream',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:creams' },
  },
  {
    tags: ['en:eggs'],
    family: 'eggs',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:eggs' },
  },
  {
    tags: ['en:puddings', 'en:desserts-dairy'],
    family: 'chilled_dessert',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:puddings' },
  },

  // 4. ambient_milk_drinks (Haltbare Milch & Pflanzendrinks)
  {
    tags: [
      'en:uht-milks',
      'en:long-life-milks',
      'en:milks',
      'en:evaporated-milks',
      'en:condensed-milks',
      'en:powdered-milks',
    ],
    family: 'milk',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:milks' },
  },
  {
    tags: [
      'en:plant-milks',
      'en:almond-milks',
      'en:soy-milks',
      'en:oat-milks',
      'en:rice-milks',
      'en:coconut-milks-drinks',
    ],
    family: 'plant_drink',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:plant-milks' },
  },

  // 5. chilled_plant_based (Vegane Kühlprodukte)
  {
    tags: [
      'en:meat-substitutes',
      'en:tofu',
      'en:tempeh',
      'en:seitan',
      'en:plant-based-steaks',
      'en:plant-based-burgers',
      'en:plant-based-sausages',
      'en:vegan-cheeses',
    ],
    family: 'tofu_meat_alternative',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:tofu' },
  },

  // 6. meat_poultry (Frischfleisch & Geflügel)
  {
    tags: ['en:poultry', 'en:chickens', 'en:turkeys'],
    family: 'poultry',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:poultry' },
  },
  {
    tags: ['en:porks', 'en:beef', 'en:meats', 'en:veal', 'en:lamb', 'en:minced-meat', 'en:steaks'],
    family: 'meat',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:porks' },
  },

  // 7. fish_seafood (Fisch & Meeresfrüchte frisch)
  {
    tags: [
      'en:fishes',
      'en:fresh-fishes',
      'en:salmons',
      'en:trouts',
      'en:seafood',
      'en:crustaceans',
      'en:shrimps',
      'en:molluscs',
    ],
    family: 'fish_seafood',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:fishes' },
  },

  // 8. deli (Wurst, Aufschnitt & Feinkost)
  {
    tags: [
      'en:hams',
      'en:sausages',
      'en:cold-cuts',
      'en:charcuterie',
      'en:salamis',
      'en:prosciutto',
      'en:pates',
    ],
    family: 'deli_cold_cuts',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:hams' },
  },

  // 9. pasta_tomato (Nudeln, Tomatenprodukte, Pastasauce)
  {
    tags: [
      'en:pastas',
      'en:dry-pastas',
      'en:fresh-pastas',
      'en:egg-pastas',
      'en:spaghetti',
      'en:noodles',
    ],
    family: 'pasta',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:pastas' },
  },
  {
    tags: ['en:tomato-sauces', 'en:passata', 'en:tomato-pastes'],
    family: 'tomato_products',
    form: 'canned_jarred',
    evidence: { kind: 'off_tag', value: 'en:tomato-sauces' },
  },
  {
    tags: ['en:pesto', 'en:pasta-sauces'],
    family: 'pasta_sauce',
    form: 'canned_jarred',
    evidence: { kind: 'off_tag', value: 'en:pesto' },
  },

  // 10. rice_world_foods (Reis, Getreide, Hülsenfrüchte)
  {
    tags: ['en:rices', 'en:basmati-rices', 'en:jasmine-rices'],
    family: 'rice',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:rices' },
  },
  {
    tags: ['en:grains', 'en:couscous', 'en:quinoa', 'en:bulgur'],
    family: 'grains',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:grains' },
  },
  {
    tags: ['en:lentils', 'en:dried-beans', 'en:chickpeas'],
    family: 'legumes',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:lentils' },
  },

  // 11. breakfast (Müsli & süße Aufstriche)
  {
    tags: ['en:breakfast-cereals', 'en:mueslis', 'en:flakes', 'en:rolled-oats', 'en:granola'],
    family: 'breakfast_cereal',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:breakfast-cereals' },
  },
  {
    tags: [
      'en:jams',
      'en:marmalades',
      'en:honeys',
      'en:nut-butters',
      'en:peanut-butters',
      'en:chocolate-spreads',
      'en:sweet-spreads',
    ],
    family: 'spreads',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:jams' },
  },

  // 12. baking (Mehl, Zucker, Backzutaten)
  {
    tags: ['en:flours', 'en:wheat-flours', 'en:yeasts', 'en:baking-powders', 'en:starches'],
    family: 'flour_baking',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:flours' },
  },
  {
    tags: ['en:sugars', 'en:sweeteners'],
    family: 'sugar_sweeteners',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:sugars' },
  },

  // 13. oils_spices (Öle, Essig, Gewürze)
  {
    tags: [
      'en:vegetable-oils',
      'en:olive-oils',
      'en:sunflower-oils',
      'en:rapeseed-oils',
      'en:vinegars',
      'en:balsamic-vinegars',
    ],
    family: 'oil_vinegar',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:vegetable-oils' },
  },
  {
    tags: ['en:spices', 'en:peppers', 'en:salts'],
    family: 'spices_seasoning',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:spices' },
  },

  // 14. condiments (Würzsoßen, Ketchup, Senf, Mayonnaise)
  {
    tags: ['en:ketchups', 'en:mustards', 'en:mayonnaises', 'en:salad-dressings'],
    family: 'condiments',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:ketchups' },
  },

  // 15. canned_jars (Konserven & Gläser)
  {
    tags: [
      'en:canned-foods',
      'en:canned-vegetables',
      'en:canned-fruits',
      'en:canned-fishes',
      'en:canned-tunas',
      'en:pickles',
      'en:pickled-cucumbers',
      'en:olives',
      'en:compotes',
      'en:applesauces',
    ],
    family: 'canned_food',
    form: 'canned_jarred',
    evidence: { kind: 'off_tag', value: 'en:canned-foods' },
  },

  // 16. ready_meals (Fertiggerichte & Suppen)
  {
    tags: ['en:soups', 'en:canned-soups', 'en:meals', 'en:ready-meals', 'en:instant-noodles'],
    family: 'soup_ready_meal',
    form: 'prepared',
    evidence: { kind: 'off_tag', value: 'en:soups' },
  },

  // 17. snacks (Herzhafte Snacks & Nüsse)
  {
    tags: [
      'en:salty-snacks',
      'en:chips',
      'en:crisps',
      'en:tortilla-chips',
      'en:pretzels',
      'en:crackers',
      'en:popcorn',
      'en:salted-nuts',
      'en:roasted-nuts',
      'en:dried-fruits',
    ],
    family: 'savory_snacks',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:salty-snacks' },
  },

  // 18. sweets (Süßwaren & Schokolade)
  {
    tags: [
      'en:chocolates',
      'en:dark-chocolates',
      'en:milk-chocolates',
      'en:candies',
      'en:gummies',
      'en:cookies',
      'en:biscuits',
      'en:wafers',
      'en:chewing-gums',
    ],
    family: 'sweets',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:chocolates' },
  },

  // 19. cold_drinks (Wasser, Erfrischungsgetränke, Saft)
  {
    tags: [
      'en:waters',
      'en:mineral-waters',
      'en:spring-waters',
      'en:carbonated-waters',
      'en:sodas',
      'en:colas',
      'en:lemonades',
      'en:iced-teas',
      'en:energy-drinks',
    ],
    family: 'water_soft_drinks',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:waters' },
  },
  {
    tags: ['en:fruit-juices', 'en:apple-juices', 'en:orange-juices', 'en:smoothies'],
    family: 'juice',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:fruit-juices' },
  },

  // 20. hot_drinks (Kaffee & Tee)
  {
    tags: [
      'en:coffees',
      'en:ground-coffees',
      'en:coffee-beans',
      'en:instant-coffees',
      'en:coffee-capsules',
    ],
    family: 'coffee',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:coffees' },
  },
  {
    tags: [
      'en:teas',
      'en:black-teas',
      'en:green-teas',
      'en:herbal-teas',
      'en:fruit-teas',
      'en:cocoas-and-chocolates-powders',
    ],
    family: 'tea',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:teas' },
  },

  // 21. alcohol (Bier, Wein, Spirituosen)
  {
    tags: [
      'en:beers',
      'en:wines',
      'en:alcoholic-beverages',
      'en:sparkling-wines',
      'en:champagnes',
      'en:spirits',
      'en:liquors',
      'en:gins',
      'en:rums',
      'en:vodkas',
      'en:whiskies',
      'en:ciders',
    ],
    family: 'alcoholic_beverages',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:alcoholic-beverages' },
  },

  // 22. frozen (Tiefkühl)
  {
    tags: [
      'en:frozen-foods',
      'en:frozen-fruits',
      'en:frozen-vegetables',
      'en:frozen-ready-meals',
      'en:frozen-pizzas',
      'en:ice-creams',
      'en:sorbets',
      'en:frozen-fishes',
      'en:frozen-meats',
      'en:frozen-french-fries',
    ],
    family: 'other_food',
    form: 'frozen',
    evidence: { kind: 'off_tag', value: 'en:frozen-foods' },
  },

  // 23. baby (Babynahrung & Pflege)
  {
    tags: [
      'en:baby-foods',
      'en:baby-milks',
      'en:infant-formulas',
      'en:baby-cereals',
      'en:baby-purees',
    ],
    family: 'baby_food',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:baby-foods' },
  },

  // 24. pets (Tierbedarf)
  {
    tags: ['en:pet-food', 'en:cat-food', 'en:dog-food', 'en:bird-food', 'en:cat-litter'],
    family: 'pet_food',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:pet-food' },
  },

  // 25. household (Reinigung & Haushalt)
  {
    tags: [
      'en:cleaning-products',
      'en:dishwashing-detergents',
      'en:laundry-detergents',
      'en:fabric-softeners',
      'en:trash-bags',
      'en:toilet-papers',
      'en:paper-towels',
      'en:aluminum-foils',
    ],
    family: 'household_cleaning',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:cleaning-products' },
  },

  // 26. personal_care (Körperpflege & Drogerie)
  {
    tags: [
      'en:hygiene',
      'en:body-care',
      'en:shampoos',
      'en:shower-gels',
      'en:soaps',
      'en:toothpastes',
      'en:toothbrushes',
      'en:deodorants',
      'en:creams-and-lotions',
      'en:sun-creams',
      'en:shaving-creams',
    ],
    family: 'personal_care',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:hygiene' },
  },
];

type NameDescriptorRule = ProductDescriptor & { values: readonly string[] };

const NAME_DESCRIPTOR_RULES: readonly NameDescriptorRule[] = [
  // 1. Fertiggerichte & Suppen (Komposita-Determinatoren wie suppe schlagen z.B. Tomate)
  {
    values: [
      'tomatensuppe',
      'gemüsesuppe',
      'suppe',
      'brühe',
      'gemüsebrühe',
      'fertiggericht',
      'ravioli',
      'lasagne',
      'terrine',
      'eintopf',
      'currygericht',
      'gulaschsuppe',
      'nudeltopf',
    ],
    family: 'soup_ready_meal',
    form: 'prepared',
    evidence: { kind: 'name_rule', value: 'ready_meal' },
  },

  // 2. Konserven & Gläser
  {
    values: [
      'dose',
      'dosen',
      'konserve',
      'konserven',
      'sauerkraut',
      'rotkohl',
      'erbsen',
      'mais',
      'thunfischdose',
      'artischocken',
      'oliven',
      'kapern',
      'apfelmus',
      'apfelmark',
      'schattenmorellen',
      'gewürzgurke',
      'gewürzgurken',
      'essiggurken',
      'cornichons',
      'eingelegt',
    ],
    family: 'canned_food',
    form: 'canned_jarred',
    evidence: { kind: 'name_rule', value: 'canned' },
  },

  // 2. Obst & Früchte
  {
    values: [
      'apfel',
      'äpfel',
      'banane',
      'bananen',
      'birne',
      'birnen',
      'orange',
      'orangen',
      'mango',
      'avocado',
      'traube',
      'trauben',
      'beere',
      'beeren',
      'erdbeere',
      'erdbeeren',
      'himbeere',
      'himbeeren',
      'blaubeere',
      'blaubeeren',
      'heidelbeere',
      'heidelbeeren',
      'kirsche',
      'kirschen',
      'pflaume',
      'pflaumen',
      'pfirsich',
      'nektarine',
      'ananas',
      'melone',
      'wassermelone',
      'honigmelone',
      'zitrone',
      'zitronen',
      'limette',
      'limetten',
      'kiwi',
      'obst',
    ],
    family: 'fruit',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'fruit' },
  },

  // 3. Gemüse & Salat
  {
    values: [
      'tomate',
      'tomaten',
      'gurke',
      'gurken',
      'paprika',
      'karotte',
      'karotten',
      'möhre',
      'möhren',
      'zucchini',
      'aubergine',
      'salat',
      'kopfsalat',
      'eisbergsalat',
      'feldsalat',
      'rucola',
      'spinat',
      'blumenkohl',
      'brokkoli',
      'kohl',
      'rotkohl',
      'weißkohl',
      'wirsing',
      'rosenkohl',
      'champignon',
      'champignons',
      'pilz',
      'pilze',
      'lauch',
      'porree',
      'sellerie',
      'radieschen',
      'kürbis',
      'ingwer',
      'spargel',
      'gemüse',
    ],
    family: 'vegetables',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'vegetables' },
  },

  // 4. Kartoffeln & Zwiebeln
  {
    values: [
      'kartoffel',
      'kartoffeln',
      'zwiebel',
      'zwiebeln',
      'knoblauch',
      'schalotten',
      'süßkartoffel',
    ],
    family: 'potatoes_onions',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'potatoes_onions' },
  },

  // 5. Frische Kräuter
  {
    values: [
      'basilikum',
      'petersilie',
      'schnittlauch',
      'rosmarin',
      'thymian',
      'dill',
      'oregano',
      'koriander',
      'minze',
      'kräuter',
    ],
    family: 'herbs',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'herbs' },
  },

  // 6. Brot & Backwaren
  {
    values: [
      'brot',
      'brötchen',
      'baguette',
      'croissant',
      'toast',
      'toastbrot',
      'vollkornbrot',
      'roggenbrot',
      'mischbrot',
      'fladenbrot',
      'ciabatta',
      'brezel',
      'laugengebäck',
      'kuchen',
      'muffin',
      'torte',
      'waffel',
      'semmel',
      'bagel',
      'gebäck',
    ],
    family: 'bread_baked_goods',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'brot' },
  },

  // 7. Haltbare Pflanzendrinks
  {
    values: [
      'hafermilch',
      'sojamilch',
      'mandelmilch',
      'haferdrink',
      'sojadrink',
      'mandeldrink',
      'kokosdrink',
      'erbsendrink',
      'reismilch',
      'reisdrink',
    ],
    family: 'plant_drink',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'plant_drink' },
  },

  // 8. Haltbare Milch
  {
    values: ['h-milch', 'kondensmilch', 'milchpulver', 'dauermilch'],
    family: 'milk',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'ambient_milk' },
  },

  // 9. Frische Milch & Milchmischgetränke
  {
    values: [
      'frischmilch',
      'vollmilch',
      'weidemilch',
      'fettarme milch',
      'heumilch',
      'rohmilch',
      'milch',
    ],
    family: 'milk',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'chilled_milk' },
  },

  // 10. Joghurt, Quark & Kefir
  {
    values: [
      'joghurt',
      'quark',
      'magerquark',
      'speisequark',
      'fruchtjoghurt',
      'skyr',
      'kefir',
      'buttermilch',
    ],
    family: 'yogurt',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'yogurt' },
  },

  // 11. Sahne, Schmand & Crème Fraîche
  {
    values: [
      'schlagsahne',
      'sahne',
      'saure sahne',
      'schmand',
      'crème fraîche',
      'creme fraiche',
      'kochcreme',
      'kaffeesahne',
    ],
    family: 'cream',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'cream' },
  },

  // 12. Käse
  {
    values: [
      'käse',
      'gouda',
      'butterkäse',
      'emmentaler',
      'cheddar',
      'mozzarella',
      'parmesan',
      'grana padano',
      'feta',
      'schafskäse',
      'ziegenkäse',
      'frischkäse',
      'camembert',
      'brie',
      'halloumi',
      'ricotta',
      'mascarpone',
    ],
    family: 'cheese',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'cheese' },
  },

  // 13. Butter & Margarine
  {
    values: ['butter', 'margarine', 'süßrahmbutter', 'sauerrahmbutter', 'kräuterbutter'],
    family: 'butter_margarine',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'butter' },
  },

  // 14. Eier
  {
    values: ['eier', 'ei', 'freilandeier', 'bio-eier', 'hühnereier', 'bodenhaltung'],
    family: 'eggs',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'eggs' },
  },

  // 15. Vegane Kühlprodukte (Tofu, Tempeh, Fleischalternativen)
  {
    values: [
      'tofu',
      'räuchertofu',
      'tempeh',
      'seitan',
      'veggie-schnitzel',
      'veganes hack',
      'fleischersatz',
      'soja-geschnetzeltes',
      'veggie',
    ],
    family: 'tofu_meat_alternative',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'tofu' },
  },

  // 16. Geflügelfleisch
  {
    values: [
      'hähnchen',
      'hähnchenbrust',
      'hähnchenschenkel',
      'hühnchen',
      'huhn',
      'pute',
      'putenbrust',
      'ente',
      'gans',
      'geflügel',
    ],
    family: 'poultry',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'poultry' },
  },

  // 17. Fleisch
  {
    values: [
      'hackfleisch',
      'rinderhack',
      'gemischtes hack',
      'rindfleisch',
      'schweinefleisch',
      'schnitzel',
      'steak',
      'rindersteak',
      'gulasch',
      'schweinekotelett',
      'kotelett',
      'bratwurst',
      'fleisch',
      'roastbeef',
      'kalbfleisch',
      'lamm',
      'schwein',
    ],
    family: 'meat',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'meat' },
  },

  // 18. Fisch & Meeresfrüchte
  {
    values: [
      'lachs',
      'lachsfilet',
      'forelle',
      'kabeljau',
      'scholle',
      'garnelen',
      'crevetten',
      'shrimps',
      'fisch',
      'meeresfrüchte',
      'thunfisch',
      'dorade',
      'matjes',
      'hering',
      'tintenfisch',
      'muscheln',
    ],
    family: 'fish_seafood',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'fish' },
  },

  // 19. Wurst, Aufschnitt & Feinkost
  {
    values: [
      'wurst',
      'schinken',
      'kochschinken',
      'rohschinken',
      'salami',
      'aufschnitt',
      'leberwurst',
      'teewurst',
      'lyoner',
      'mortadella',
      'wiener',
      'wiener würstchen',
      'fleischwurst',
      'hummus',
      'guacamole',
      'krautsalat',
      'tzatziki',
      'antipasti',
      'feinkost',
    ],
    family: 'deli_cold_cuts',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'deli' },
  },

  // 20. Nudeln & Teigwaren
  {
    values: [
      'nudeln',
      'pasta',
      'spaghetti',
      'penne',
      'fusilli',
      'farfalle',
      'rigatoni',
      'tagliatelle',
      'lasagneplatten',
      'bandnudeln',
      'tortellini',
      'gnocchi',
      'macaroni',
      'spätzle',
    ],
    family: 'pasta',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'pasta' },
  },

  // 21. Tomatenprodukte & Pastasaucen
  {
    values: ['passata', 'tomatenmark', 'pizzatomaten', 'gehackte tomaten', 'schältomaten'],
    family: 'tomato_products',
    form: 'canned_jarred',
    evidence: { kind: 'name_rule', value: 'tomato_products' },
  },
  {
    values: ['pesto', 'bolognese', 'arrabbiata', 'napoli', 'pastasauce', 'tomatensauce'],
    family: 'pasta_sauce',
    form: 'canned_jarred',
    evidence: { kind: 'name_rule', value: 'pasta_sauce' },
  },

  // 22. Reis
  {
    values: [
      'reis',
      'basmati',
      'basmatireis',
      'jasminreis',
      'milchreis',
      'risottoreis',
      'langkornreis',
      'wildreis',
    ],
    family: 'rice',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'rice' },
  },

  // 23. Getreide & Pseudogetreide
  {
    values: [
      'couscous',
      'bulgur',
      'quinoa',
      'polenta',
      'dinkelgraupen',
      'graupen',
      'hirse',
      'grieß',
    ],
    family: 'grains',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'grains' },
  },

  // 24. Trockene Hülsenfrüchte
  {
    values: ['linsen', 'kichererbsen', 'kidneybohnen', 'bohnen', 'rote linsen', 'tellerlinsen'],
    family: 'legumes',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'legumes' },
  },

  // 25. Frühstückscerealien & Flocken
  {
    values: ['müsli', 'haferflocken', 'cornflakes', 'granola', 'crunchy', 'porridge', 'cerealien'],
    family: 'breakfast_cereal',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'breakfast_cereal' },
  },

  // 26. Süße Brotaufstriche & Honig
  {
    values: [
      'marmelade',
      'konfitüre',
      'honig',
      'nutella',
      'erdnussbutter',
      'haselnusscreme',
      'schokocreme',
      'pflaumenmus',
      'gelee',
      'rübenkraut',
      'agavendicksaft',
      'ahornsirup',
      'aufstrich',
    ],
    family: 'spreads',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'spreads' },
  },

  // 27. Mehl & Backzutaten
  {
    values: [
      'mehl',
      'weizenmehl',
      'dinkelmehl',
      'roggenmehl',
      'backpulver',
      'hefe',
      'trockenhefe',
      'vanillezucker',
      'puderzucker',
      'speisestärke',
      'kuvertüre',
      'streusel',
      'backaroma',
      'natron',
      'backmischung',
      'gelatine',
    ],
    family: 'flour_baking',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'baking' },
  },

  // 28. Zucker & Süßungsmittel
  {
    values: ['zucker', 'rohrzucker', 'brauner zucker', 'süßstoff', 'erythrit', 'xylit'],
    family: 'sugar_sweeteners',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'sugar' },
  },

  // 29. Öle & Essig
  {
    values: [
      'öl',
      'olivenöl',
      'rapsöl',
      'sonnenblumenöl',
      'leinöl',
      'sesamöl',
      'kokosöl',
      'speiseöl',
      'essig',
      'balsamico',
      'apfelessig',
      'weinessig',
    ],
    family: 'oil_vinegar',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'oils_spices' },
  },

  // 30. Gewürze & Salz
  {
    values: [
      'salz',
      'meersalz',
      'pfeffer',
      'paprikapulver',
      'zimt',
      'kurkuma',
      'curry',
      'muskat',
      'kümmel',
      'chili',
      'lorbeer',
      'knoblauchpulver',
      'oregano',
      'thymian',
      'gewürz',
      'brühwürfel',
    ],
    family: 'spices_seasoning',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'spices' },
  },

  // 31. Saucen & Würzmittel (Condiments)
  {
    values: [
      'ketchup',
      'curryketchup',
      'senf',
      'dijonsenf',
      'mayo',
      'mayonnaise',
      'remoulade',
      'tabasco',
      'bbq-sauce',
      'salatdressing',
      'dressing',
      'worcestersauce',
      'sojasauce',
    ],
    family: 'condiments',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'condiments' },
  },

  // 32. Konserven & Gläser
  {
    values: [
      'dose',
      'dosen',
      'konserve',
      'konserven',
      'sauerkraut',
      'rotkohl',
      'erbsen',
      'mais',
      'thunfischdose',
      'artischocken',
      'oliven',
      'kapern',
      'apfelmus',
      'apfelmark',
      'schattenmorellen',
      'gewürzgurke',
      'gewürzgurken',
      'essiggurken',
      'cornichons',
      'eingelegt',
    ],
    family: 'canned_food',
    form: 'canned_jarred',
    evidence: { kind: 'name_rule', value: 'canned' },
  },

  // 33. Kaffee
  {
    values: [
      'kaffee',
      'kaffeebohnen',
      'filterkaffee',
      'espresso',
      'cappuccino',
      'kaffeepads',
      'kaffeekapseln',
      'löslicher kaffee',
    ],
    family: 'coffee',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'coffee' },
  },

  // 34. Tee & Kakao
  {
    values: [
      'tee',
      'schwarztee',
      'grüntee',
      'kamillentee',
      'pfefferminztee',
      'früchtetee',
      'kräutertee',
      'rooibos',
      'earl grey',
      'mate',
      'kakao',
      'kakaopulver',
    ],
    family: 'tea',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'tea' },
  },

  // 35. Wasser & Erfrischungsgetränke
  {
    values: [
      'wasser',
      'mineralwasser',
      'sprudel',
      'stilles wasser',
      'cola',
      'cola zero',
      'fanta',
      'sprite',
      'spezi',
      'limonade',
      'eistee',
      'energy drink',
      'tonic water',
      'bitter lemon',
    ],
    family: 'water_soft_drinks',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'drinks' },
  },

  // 36. Saft & Smoothies
  {
    values: [
      'saft',
      'apfelsaft',
      'orangensaft',
      'multivitaminsaft',
      'traubensaft',
      'kirschsaft',
      'smoothie',
    ],
    family: 'juice',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'juice' },
  },

  // 37. Alkoholische Getränke
  {
    values: [
      'bier',
      'pils',
      'weizenbier',
      'radler',
      'wein',
      'rotwein',
      'weißwein',
      'roséwein',
      'sekt',
      'prosecco',
      'champagner',
      'gin',
      'vodka',
      'rum',
      'whisky',
      'aperol',
      'likör',
      'korn',
      'ouzo',
      'tequila',
      'cider',
    ],
    family: 'alcoholic_beverages',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'alcohol' },
  },

  // 38. Herzhafte Snacks
  {
    values: [
      'chips',
      'kartoffelchips',
      'erdnussflips',
      'flips',
      'salzstangen',
      'brezeln',
      'cracker',
      'tortillas',
      'popcorn',
      'snack',
    ],
    family: 'savory_snacks',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'snacks' },
  },

  // 39. Nüsse & Trockenfrüchte
  {
    values: [
      'erdnüsse',
      'mandeln',
      'cashews',
      'walnüsse',
      'haselnüsse',
      'pistazien',
      'studentenfutter',
      'rosinen',
      'datteln',
      'feigen',
      'getrocknete früchte',
      'nüsse',
    ],
    family: 'nuts_dried_fruit',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'nuts' },
  },

  // 40. Süßwaren & Schokolade
  {
    values: [
      'schokolade',
      'vollmilchschokolade',
      'zartbitterschokolade',
      'pralinen',
      'gummibärchen',
      'fruchtgummi',
      'bonbons',
      'bonbon',
      'lakritz',
      'kekse',
      'cookies',
      'waffeln',
      'lebkuchen',
      'marzipan',
      'kaugummi',
      'süßigkeiten',
      'süßware',
    ],
    family: 'sweets',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'sweets' },
  },

  // 41. Babynahrung & Babybedarf
  {
    values: [
      'windeln',
      'babygläschen',
      'babybrei',
      'folgemilch',
      'pre-milch',
      'babyshampoo',
      'babyfeuchttücher',
      'babynahrung',
    ],
    family: 'baby_food',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'baby' },
  },

  // 42. Tierbedarf
  {
    values: [
      'katzenfutter',
      'hundefutter',
      'katzenstreu',
      'vogelfutter',
      'hundesnacks',
      'katzensnacks',
      'tiernahrung',
      'nassfutter',
      'trockenfutter',
      'tierfutter',
    ],
    family: 'pet_food',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'pets' },
  },

  // 43. Haushalt & Reinigung
  {
    values: [
      'spülmittel',
      'geschirrspültabs',
      'klarspüler',
      'spülsalz',
      'waschmittel',
      'weichspüler',
      'allzweckreiniger',
      'badreiniger',
      'glasreiniger',
      'wc-reiniger',
      'müllbeutel',
      'küchenrolle',
      'toilettenpapier',
      'alufolie',
      'backpapier',
      'schwamm',
      'putzlappen',
      'küchentücher',
      'putzmittel',
    ],
    family: 'household_cleaning',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'household' },
  },

  // 44. Drogerie & Körperpflege
  {
    values: [
      'shampoo',
      'haargel',
      'haarspülung',
      'duschgel',
      'seife',
      'flüssigseife',
      'zahnpasta',
      'zahnbürste',
      'mundspülung',
      'zahnseide',
      'deodorant',
      'deo',
      'bodylotion',
      'gesichtscreme',
      'handcreme',
      'sonnencreme',
      'tampons',
      'binden',
      'slipeinlagen',
      'taschentücher',
      'feuchttücher',
      'wattestäbchen',
      'wattepads',
      'rasierschaum',
      'rasierklingen',
      'lippenbalsam',
    ],
    family: 'personal_care',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'personal_care' },
  },
];

function descriptorFromOffTags(categoryTags: readonly string[]): ProductDescriptor | null {
  for (const rule of OFF_DESCRIPTOR_RULES) {
    const matchedTag = rule.tags.find((tag) => categoryTags.includes(tag));
    if (matchedTag) return { ...rule, evidence: { ...rule.evidence, value: matchedTag } };
  }
  return null;
}

function descriptorFromName(name: string): ProductDescriptor | null {
  const tokens = normalizeShoppingName(name);
  const isFrozen = tokens.some(
    (token) =>
      token === 'tk' ||
      token === 'tiefgekühlt' ||
      token === 'tiefgefroren' ||
      token === 'gefroren' ||
      token === 'eiscreme' ||
      token === 'speiseeis' ||
      token.startsWith('tiefkühl') ||
      token.startsWith('tiefgefrier') ||
      token.startsWith('tiefgefroren'),
  );

  // 1. Zuerst exakte Treffer (z.B. 'olivenöl' schlägt 'oliven' Präfix)
  for (const rule of NAME_DESCRIPTOR_RULES) {
    const matchedValue = rule.values.find((value) => tokens.some((token) => token === value));
    if (matchedValue) {
      return {
        ...rule,
        form: isFrozen ? 'frozen' : rule.form,
        evidence: { ...rule.evidence, value: matchedValue },
      };
    }
  }

  // 2. Danach Präfix-Treffer für zusammengesetzte Wörter
  for (const rule of NAME_DESCRIPTOR_RULES) {
    const matchedValue = rule.values.find((value) =>
      tokens.some((token) => value.length > 2 && token.startsWith(value)),
    );
    if (matchedValue) {
      return {
        ...rule,
        form: isFrozen ? 'frozen' : rule.form,
        evidence: { ...rule.evidence, value: matchedValue },
      };
    }
  }

  if (isFrozen) {
    return {
      family: 'other_food',
      form: 'frozen',
      evidence: { kind: 'name_rule', value: 'frozen' },
    };
  }

  return null;
}

function confidenceFor(
  source: PlacementTrace['resolutionSource'],
  categoryTrace: PlacementTrace['categoryTrace'],
): number {
  const winner = categoryTrace.winner;
  const weight = categoryTrace.candidates.find(
    (candidate) =>
      candidate.categoryId === winner.categoryId &&
      candidate.kind === (winner.source === 'off_taxonomy' ? 'off_tag' : 'name_rule'),
  )?.weight;
  if (source === 'off_taxonomy')
    return weight === undefined ? 0.9 : Math.min(0.99, 0.7 + weight / 350);
  if (source === 'name_fallback')
    return weight === undefined ? 0.72 : Math.min(0.92, 0.58 + weight / 300);
  return 0.35;
}

function classifyPlacementInternal(input: PlacementClassificationInput): PlacementClassification {
  const categoryTrace = explainCategory(input);
  const legacyCategoryId = categoryTrace.winner.categoryId;
  const explicitDescriptor =
    input.productFamilyId && input.productFormId
      ? {
          family: input.productFamilyId,
          form: input.productFormId,
          evidence: { kind: 'legacy_mapping', value: 'explicit product descriptor' } as const,
        }
      : null;
  const descriptor =
    explicitDescriptor ??
    descriptorFromOffTags(input.categoryTags ?? []) ??
    descriptorFromName(input.name);
  const fallbackZone = normalizePlacementZoneId(legacyCategoryId);
  const fallbackDescriptor = DEFAULT_BY_ZONE[fallbackZone];
  const chosen = descriptor ?? {
    ...fallbackDescriptor,
    evidence: {
      kind: legacyCategoryId ? 'legacy_mapping' : 'default',
      value: legacyCategoryId ?? 'other',
    },
  };
  const placementZoneId = resolvePlacementZone(chosen.family, chosen.form);
  const resolutionSource =
    categoryTrace.winner.source === 'off_taxonomy'
      ? 'off_taxonomy'
      : categoryTrace.winner.source === 'name_fallback'
        ? 'name_fallback'
        : 'legacy_mapping';
  const confidence = confidenceFor(resolutionSource, categoryTrace);
  const trace: PlacementTrace = {
    classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
    input: categoryTrace.input,
    categoryTrace,
    legacyCategoryId,
    resolutionSource,
    productFamilyId: chosen.family,
    productFormId: chosen.form,
    placementZoneId,
    confidence,
    evidence: chosen.evidence,
  };

  return {
    productFamilyId: chosen.family,
    productFormId: chosen.form,
    placementZoneId,
    classifierVersion: PLACEMENT_CLASSIFIER_VERSION,
    confidence,
    trace,
  };
}

/** Liefert immer eine gültige V2-Zone und die dazugehörige Familie/Form. */
export function classifyPlacement(input: PlacementClassificationInput): PlacementClassification {
  return classifyPlacementInternal(input);
}

/** Expliziter Alias für Aufrufer, die den Trace als primäres Ergebnis benötigen. */
export function explainPlacement(input: PlacementClassificationInput): PlacementTrace {
  return classifyPlacementInternal(input).trace;
}

/** V2-Adapter für bestehende Aufrufer, die bisher nur eine Zone benötigen. */
export function classifyPlacementZone(input: CategoryClassifierInput): PlacementZoneId {
  return classifyPlacement(input).placementZoneId;
}

/** Re-export der alten, zone-basierten Pipeline für Debugger und Migrationen. */
export { classifyCategory, explainCategory };
