export const TAXONOMY_VERSION = 'product-placement-v1' as const;

export const PRODUCT_FAMILY_GROUPS = [
  {
    label: 'Obst, Gemüse & Backwaren',
    families: [
      ['fruit', 'Obst'],
      ['vegetables', 'Gemüse'],
      ['herbs', 'Kräuter'],
      ['potatoes_onions', 'Kartoffeln & Zwiebeln'],
      ['bread_baked_goods', 'Brot & Backwaren'],
    ],
  },
  {
    label: 'Molkerei & Alternativen',
    families: [
      ['milk', 'Milch'],
      ['plant_drink', 'Pflanzendrink'],
      ['cream', 'Sahne & Kochcreme'],
      ['yogurt', 'Joghurt'],
      ['cheese', 'Käse'],
      ['butter_margarine', 'Butter & Margarine'],
      ['eggs', 'Eier'],
      ['chilled_dessert', 'Gekühltes Dessert'],
      ['tofu_meat_alternative', 'Tofu & Fleischalternative'],
    ],
  },
  {
    label: 'Fleisch & Fisch',
    families: [
      ['meat', 'Fleisch'],
      ['poultry', 'Geflügel'],
      ['fish_seafood', 'Fisch & Meeresfrüchte'],
      ['deli_cold_cuts', 'Wurst & Aufschnitt'],
    ],
  },
  {
    label: 'Grundnahrung & Kochen',
    families: [
      ['pasta', 'Nudeln'],
      ['rice', 'Reis'],
      ['grains', 'Getreide & Couscous'],
      ['legumes', 'Hülsenfrüchte'],
      ['flour_baking', 'Mehl & Backzutaten'],
      ['oil_vinegar', 'Öl & Essig'],
      ['spices_seasoning', 'Gewürze'],
      ['sugar_sweeteners', 'Zucker & Süßungsmittel'],
      ['tomato_products', 'Tomatenprodukte'],
      ['pasta_sauce', 'Pastasauce'],
      ['condiments', 'Ketchup, Senf & Würzsoßen'],
      ['canned_food', 'Konserven'],
      ['soup_ready_meal', 'Suppen & Fertiggerichte'],
      ['spreads', 'Aufstriche'],
    ],
  },
  {
    label: 'Frühstück, Snacks & Getränke',
    families: [
      ['breakfast_cereal', 'Müsli & Cornflakes'],
      ['savory_snacks', 'Herzhafte Snacks'],
      ['sweets', 'Süßwaren'],
      ['nuts_dried_fruit', 'Nüsse & Trockenfrüchte'],
      ['water_soft_drinks', 'Wasser & Erfrischungsgetränke'],
      ['juice', 'Saft'],
      ['alcoholic_beverages', 'Alkoholische Getränke'],
      ['coffee', 'Kaffee'],
      ['tea', 'Tee'],
    ],
  },
  {
    label: 'Haushalt & Sonstiges',
    families: [
      ['baby_food', 'Babynahrung'],
      ['pet_food', 'Tiernahrung'],
      ['household_cleaning', 'Haushalt & Reinigung'],
      ['personal_care', 'Drogerie & Körperpflege'],
      ['other_food', 'Anderes Lebensmittel'],
    ],
  },
] as const;

export const PRODUCT_FORM_DEFINITIONS = [
  { id: 'fresh', label: 'Frisch' },
  { id: 'chilled', label: 'Gekühlt' },
  { id: 'ambient', label: 'Haltbar / ungekühlt' },
  { id: 'frozen', label: 'Tiefgekühlt' },
  { id: 'canned_jarred', label: 'Konserve / Glas' },
  { id: 'dry', label: 'Trockenware' },
  { id: 'prepared', label: 'Verzehrfertig' },
] as const;

export const PLACEMENT_ZONE_DEFINITIONS = [
  { id: 'fresh_produce', label: 'Obst & Gemüse' },
  { id: 'bakery', label: 'Backwaren' },
  { id: 'chilled_dairy_eggs', label: 'Molkerei & Eier' },
  { id: 'ambient_milk_drinks', label: 'Haltbare Milch & Drinks' },
  { id: 'chilled_plant_based', label: 'Gekühlte pflanzliche Produkte' },
  { id: 'meat_poultry', label: 'Fleisch & Geflügel' },
  { id: 'fish_seafood', label: 'Fisch & Meeresfrüchte' },
  { id: 'deli', label: 'Wurst & Aufschnitt' },
  { id: 'pasta_tomato', label: 'Nudeln & Tomatenprodukte' },
  { id: 'rice_world_foods', label: 'Reis & internationale Lebensmittel' },
  { id: 'breakfast', label: 'Frühstück' },
  { id: 'baking', label: 'Backzutaten' },
  { id: 'oils_spices', label: 'Öl, Essig & Gewürze' },
  { id: 'condiments', label: 'Würzmittel' },
  { id: 'canned_jars', label: 'Konserven & Gläser' },
  { id: 'ready_meals', label: 'Suppen & Fertiggerichte' },
  { id: 'snacks', label: 'Snacks & Nüsse' },
  { id: 'sweets', label: 'Süßwaren' },
  { id: 'cold_drinks', label: 'Kalte Getränke' },
  { id: 'hot_drinks', label: 'Kaffee & Tee' },
  { id: 'alcohol', label: 'Alkoholische Getränke' },
  { id: 'frozen', label: 'Tiefkühl' },
  { id: 'baby', label: 'Baby & Kinder' },
  { id: 'pets', label: 'Tierbedarf' },
  { id: 'household', label: 'Haushalt & Reinigung' },
  { id: 'personal_care', label: 'Drogerie & Körperpflege' },
  { id: 'other', label: 'Sonstiges' },
] as const;

export type ProductFamilyId = (typeof PRODUCT_FAMILY_GROUPS)[number]['families'][number][0];
export type ProductFormId = (typeof PRODUCT_FORM_DEFINITIONS)[number]['id'];
export type PlacementZoneId = (typeof PLACEMENT_ZONE_DEFINITIONS)[number]['id'];

export const PRODUCT_FAMILY_IDS = PRODUCT_FAMILY_GROUPS.flatMap((group) => group.families.map(([id]) => id));
export const PRODUCT_FORM_IDS = PRODUCT_FORM_DEFINITIONS.map(({ id }) => id);
export const PLACEMENT_ZONE_IDS = PLACEMENT_ZONE_DEFINITIONS.map(({ id }) => id);

const familyLabels = new Map<ProductFamilyId, string>();
for (const group of PRODUCT_FAMILY_GROUPS) {
  for (const [id, label] of group.families) familyLabels.set(id, label);
}
const formLabels = new Map<ProductFormId, string>(PRODUCT_FORM_DEFINITIONS.map(({ id, label }) => [id, label]));
const zoneLabels = new Map<PlacementZoneId, string>(PLACEMENT_ZONE_DEFINITIONS.map(({ id, label }) => [id, label]));

export function productFamilyLabel(id: ProductFamilyId): string {
  return familyLabels.get(id) ?? id;
}

export function productFormLabel(id: ProductFormId): string {
  return formLabels.get(id) ?? id;
}

export function placementZoneLabel(id: PlacementZoneId): string {
  return zoneLabels.get(id) ?? id;
}

export function resolvePlacementZone(family: ProductFamilyId, form: ProductFormId): PlacementZoneId {
  if (form === 'frozen') return 'frozen';
  if (family === 'tomato_products' || family === 'pasta_sauce' || family === 'pasta') return 'pasta_tomato';
  const cannedFamilies: readonly ProductFamilyId[] = ['fruit', 'vegetables', 'legumes', 'fish_seafood', 'canned_food'];
  if (form === 'canned_jarred' && cannedFamilies.includes(family)) {
    return 'canned_jars';
  }

  switch (family) {
    case 'fruit':
    case 'vegetables':
    case 'herbs':
    case 'potatoes_onions':
      return 'fresh_produce';
    case 'bread_baked_goods':
      return 'bakery';
    case 'milk':
    case 'plant_drink':
    case 'cream':
      return form === 'chilled' ? 'chilled_dairy_eggs' : 'ambient_milk_drinks';
    case 'yogurt':
    case 'cheese':
    case 'butter_margarine':
    case 'eggs':
    case 'chilled_dessert':
      return 'chilled_dairy_eggs';
    case 'tofu_meat_alternative':
      return 'chilled_plant_based';
    case 'meat':
    case 'poultry':
      return 'meat_poultry';
    case 'fish_seafood':
      return 'fish_seafood';
    case 'deli_cold_cuts':
      return 'deli';
    case 'rice':
    case 'grains':
    case 'legumes':
      return 'rice_world_foods';
    case 'breakfast_cereal':
      return 'breakfast';
    case 'flour_baking':
    case 'sugar_sweeteners':
      return 'baking';
    case 'oil_vinegar':
    case 'spices_seasoning':
      return 'oils_spices';
    case 'condiments':
      return 'condiments';
    case 'canned_food':
      return 'canned_jars';
    case 'soup_ready_meal':
      return 'ready_meals';
    case 'spreads':
      return form === 'chilled' ? 'chilled_plant_based' : 'breakfast';
    case 'savory_snacks':
    case 'nuts_dried_fruit':
      return 'snacks';
    case 'sweets':
      return 'sweets';
    case 'water_soft_drinks':
    case 'juice':
      return 'cold_drinks';
    case 'alcoholic_beverages':
      return 'alcohol';
    case 'coffee':
    case 'tea':
      return 'hot_drinks';
    case 'baby_food':
      return 'baby';
    case 'pet_food':
      return 'pets';
    case 'household_cleaning':
      return 'household';
    case 'personal_care':
      return 'personal_care';
    case 'other_food':
      return 'other';
  }
}
