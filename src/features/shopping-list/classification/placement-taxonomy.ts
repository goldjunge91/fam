/**
 * Kanonische, React-freie Einkaufsbereichs-Taxonomie.
 *
 * Diese Datei ist die einzige Quelle für V2-Zonen, Produktfamilien/-formen,
 * Farben, Ränge, Lagerorte und die Lesekompatibilität zu den alten IDs.
 * `category_id` bleibt im Datenmodell der technische Spaltenname; neue
 * Schreibvorgänge verwenden ausschließlich `PlacementZoneId`.
 */

export const PLACEMENT_TAXONOMY_VERSION = 'placement-taxonomy-v2' as const;
export const PLACEMENT_CLASSIFIER_VERSION = 'placement-v2.0.0' as const;

export type StorageKind = 'fridge' | 'freezer' | 'pantry';

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
  {
    id: 'fresh_produce',
    label: 'Obst & Gemüse',
    color: '#748C5B',
    rank: 10,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'bakery',
    label: 'Brot & Backwaren',
    color: '#C6A24A',
    rank: 20,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'chilled_dairy_eggs',
    label: 'Milchprodukte & Eier',
    color: '#5C7396',
    rank: 30,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'ambient_milk_drinks',
    label: 'Haltbare Milch, Pflanzendrinks & Kochsahne',
    color: '#7B86A5',
    rank: 40,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'chilled_plant_based',
    label: 'Vegane Kühlprodukte',
    color: '#6B8756',
    rank: 50,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'meat_poultry',
    label: 'Fleisch & Geflügel',
    color: '#A6483D',
    rank: 60,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'fish_seafood',
    label: 'Fisch & Meeresfrüchte',
    color: '#457287',
    rank: 70,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'deli',
    label: 'Käse, Aufschnitt & Feinkost',
    color: '#964B4B',
    rank: 80,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'pasta_tomato',
    label: 'Nudeln & Tomatenprodukte',
    color: '#B5623F',
    rank: 90,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'rice_world_foods',
    label: 'Reis, Getreide & Hülsenfrüchte',
    color: '#8B6B4A',
    rank: 100,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'breakfast',
    label: 'Frühstück & Brotaufstriche',
    color: '#C08A4E',
    rank: 110,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'baking',
    label: 'Backen & Grundzutaten',
    color: '#B89462',
    rank: 120,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'oils_spices',
    label: 'Öle, Essig & Gewürze',
    color: '#B57B48',
    rank: 130,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'condiments',
    label: 'Ketchup, Senf & Würzsaucen',
    color: '#A95745',
    rank: 140,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'canned_jars',
    label: 'Konserven & Gläser',
    color: '#9B604A',
    rank: 150,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'ready_meals',
    label: 'Fertiggerichte & Suppen',
    color: '#9B7864',
    rank: 160,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'snacks',
    label: 'Snacks & Nüsse',
    color: '#8B6F72',
    rank: 170,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'sweets',
    label: 'Süßwaren',
    color: '#A16A82',
    rank: 180,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'cold_drinks',
    label: 'Wasser, Saft & Softdrinks',
    color: '#4F8580',
    rank: 190,
    storageKind: 'fridge',
    keywords: [],
  },
  {
    id: 'hot_drinks',
    label: 'Kaffee, Tee & Kakao',
    color: '#6A564A',
    rank: 200,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'alcohol',
    label: 'Alkohol',
    color: '#7B5D6E',
    rank: 210,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'frozen',
    label: 'Tiefkühl',
    color: '#6C7F99',
    rank: 220,
    storageKind: 'freezer',
    keywords: [],
  },
  { id: 'baby', label: 'Baby', color: '#8C6C82', rank: 230, storageKind: 'pantry', keywords: [] },
  {
    id: 'pets',
    label: 'Tierbedarf',
    color: '#736B5E',
    rank: 240,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'household',
    label: 'Haushalt & Reinigung',
    color: '#5A6F7C',
    rank: 250,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'personal_care',
    label: 'Drogerie & Körperpflege',
    color: '#705773',
    rank: 260,
    storageKind: 'pantry',
    keywords: [],
  },
  {
    id: 'other',
    label: 'Sonstiges',
    color: '#786F79',
    rank: 270,
    storageKind: 'pantry',
    keywords: [],
  },
] as const;

export type ProductFamilyId = (typeof PRODUCT_FAMILY_GROUPS)[number]['families'][number][0];
export type ProductFormId = (typeof PRODUCT_FORM_DEFINITIONS)[number]['id'];
export type PlacementZoneId = (typeof PLACEMENT_ZONE_DEFINITIONS)[number]['id'];
export type PlacementZoneDefinition = (typeof PLACEMENT_ZONE_DEFINITIONS)[number];

/** App-Domänenansicht mit dem im Einkaufslisten-Code etablierten `sortOrder`. */
export const PLACEMENT_ZONES = PLACEMENT_ZONE_DEFINITIONS.map((zone) => ({
  ...zone,
  sortOrder: zone.rank,
})) as readonly (PlacementZoneDefinition & { sortOrder: number })[];
export type PlacementZone = (typeof PLACEMENT_ZONES)[number];

export const PRODUCT_FAMILY_IDS = PRODUCT_FAMILY_GROUPS.flatMap((group) =>
  group.families.map(([id]) => id),
);
export const PRODUCT_FORM_IDS = PRODUCT_FORM_DEFINITIONS.map(({ id }) => id);
export const PLACEMENT_ZONE_IDS = PLACEMENT_ZONE_DEFINITIONS.map(({ id }) => id);

export type LegacyShoppingCategoryId =
  | 'produce'
  | 'bakery'
  | 'convenience'
  | 'breakfast'
  | 'hot_beverages'
  | 'pantry_staples'
  | 'cooking_baking'
  | 'canned_sauces'
  | 'snacks'
  | 'beverages'
  | 'drugstore'
  | 'baby_kids'
  | 'household'
  | 'pet_supplies'
  | 'meat_poultry'
  | 'fish_seafood'
  | 'deli_cold_cuts'
  | 'plant_based'
  | 'dairy_eggs'
  | 'frozen'
  | 'checkout'
  | 'deli_meat'
  | 'pantry_canned'
  | 'pantry_dry'
  | 'dairy';

/** Kompatibilitätsname für die bisherige technische `category_id`-Domäne. */
export type LegacyPlacementZoneId = LegacyShoppingCategoryId;
/** Werte, die beim Lesen aus alten Snapshots oder aus V2 vorkommen können. */
export type StoredPlacementZoneId = PlacementZoneId | LegacyPlacementZoneId;

export const LEGACY_CATEGORY_TO_ZONE: Readonly<Record<LegacyShoppingCategoryId, PlacementZoneId>> =
  {
    produce: 'fresh_produce',
    bakery: 'bakery',
    convenience: 'deli',
    breakfast: 'breakfast',
    hot_beverages: 'hot_drinks',
    pantry_staples: 'rice_world_foods',
    cooking_baking: 'oils_spices',
    canned_sauces: 'canned_jars',
    snacks: 'snacks',
    beverages: 'cold_drinks',
    drugstore: 'personal_care',
    baby_kids: 'baby',
    household: 'household',
    pet_supplies: 'pets',
    meat_poultry: 'meat_poultry',
    fish_seafood: 'fish_seafood',
    deli_cold_cuts: 'deli',
    plant_based: 'chilled_plant_based',
    dairy_eggs: 'chilled_dairy_eggs',
    frozen: 'frozen',
    checkout: 'other',
    deli_meat: 'deli',
    pantry_canned: 'canned_jars',
    pantry_dry: 'rice_world_foods',
    dairy: 'chilled_dairy_eggs',
  };

export const LEGACY_CATEGORY_ALIASES: Readonly<Record<string, PlacementZoneId>> = {
  ...LEGACY_CATEGORY_TO_ZONE,
};
export const LEGACY_PLACEMENT_ZONE_MAP = LEGACY_CATEGORY_ALIASES;

const familyLabels = new Map<ProductFamilyId, string>();
for (const group of PRODUCT_FAMILY_GROUPS) {
  for (const [id, label] of group.families) familyLabels.set(id, label);
}
const formLabels = new Map<ProductFormId, string>(
  PRODUCT_FORM_DEFINITIONS.map(({ id, label }) => [id, label]),
);
const zoneLabels = new Map<PlacementZoneId, string>(
  PLACEMENT_ZONE_DEFINITIONS.map(({ id, label }) => [id, label]),
);

export function isPlacementZoneId(value: string): value is PlacementZoneId {
  return (PLACEMENT_ZONE_IDS as readonly string[]).includes(value);
}

export function normalizePlacementZoneId(value: string | null | undefined): PlacementZoneId {
  if (value && isPlacementZoneId(value)) return value;
  return LEGACY_CATEGORY_ALIASES[value ?? ''] ?? 'other';
}

/** Read-side Variante: fehlende und unbekannte Werte bleiben ohne erfundenen Fallback. */
export function normalizePlacementZoneIdNullable(
  value: string | null | undefined,
): PlacementZoneId | null {
  if (!value) return null;
  if (isPlacementZoneId(value)) return value;
  return LEGACY_CATEGORY_ALIASES[value] ?? null;
}

export function placementZoneForId(value: string | null | undefined): PlacementZone | null {
  const id = normalizePlacementZoneIdNullable(value);
  return id ? (PLACEMENT_ZONES.find((zone) => zone.id === id) ?? null) : null;
}

export function placementZoneForLabel(label: string | null | undefined): PlacementZone | null {
  return label ? (PLACEMENT_ZONES.find((zone) => zone.label === label) ?? null) : null;
}

/** Normalisiert Markt-Reihenfolgen, entfernt Duplikate und hängt fehlende V2-Zonen an. */
export function normalizePlacementOrder(
  values: readonly string[] | null | undefined,
): PlacementZoneId[] {
  if (!values || values.length === 0) return [];
  const seen = new Set<PlacementZoneId>();
  const result: PlacementZoneId[] = [];
  for (const value of values) {
    const id = normalizePlacementZoneIdNullable(value);
    if (id && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  for (const zone of PLACEMENT_ZONES) {
    if (!seen.has(zone.id)) result.push(zone.id);
  }
  return result;
}

export function productFamilyLabel(id: ProductFamilyId): string {
  return familyLabels.get(id) ?? id;
}

export function productFormLabel(id: ProductFormId): string {
  return formLabels.get(id) ?? id;
}

export function placementZoneLabel(id: PlacementZoneId): string {
  return zoneLabels.get(id) ?? id;
}

export function placementZoneDefinition(id: PlacementZoneId): PlacementZoneDefinition {
  return (
    PLACEMENT_ZONE_DEFINITIONS.find((zone) => zone.id === id) ??
    PLACEMENT_ZONE_DEFINITIONS[PLACEMENT_ZONE_DEFINITIONS.length - 1]
  );
}

/** Ordnet eine Familie und ihre Verkaufsform einem Einkaufsbereich zu. */
export function resolvePlacementZone(
  family: ProductFamilyId,
  form: ProductFormId,
): PlacementZoneId {
  if (form === 'frozen') return 'frozen';
  if (family === 'tomato_products' || family === 'pasta_sauce' || family === 'pasta')
    return 'pasta_tomato';
  const cannedFamilies: readonly ProductFamilyId[] = [
    'fruit',
    'vegetables',
    'legumes',
    'fish_seafood',
    'canned_food',
  ];
  if (form === 'canned_jarred' && cannedFamilies.includes(family)) return 'canned_jars';

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
