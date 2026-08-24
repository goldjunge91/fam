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

/** Spezifische OFF-Tags verfeinern die V2-Familie, ohne die OFF-Priorität zu umgehen. */
const OFF_DESCRIPTOR_RULES: readonly OffDescriptorRule[] = [
  {
    tags: ['en:fresh-fruits', 'en:raw-fruits'],
    family: 'fruit',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:fresh-fruits' },
  },
  {
    tags: ['en:fresh-vegetables', 'en:raw-vegetables'],
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
    tags: ['en:breads', 'en:viennoiseries'],
    family: 'bread_baked_goods',
    form: 'fresh',
    evidence: { kind: 'off_tag', value: 'en:breads' },
  },
  {
    tags: ['en:milks'],
    family: 'milk',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:milks' },
  },
  {
    tags: ['en:yogurts'],
    family: 'yogurt',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:yogurts' },
  },
  {
    tags: ['en:cheeses'],
    family: 'cheese',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:cheeses' },
  },
  {
    tags: ['en:eggs'],
    family: 'eggs',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:eggs' },
  },
  {
    tags: ['en:meat-substitutes', 'en:tofu'],
    family: 'tofu_meat_alternative',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:tofu' },
  },
  {
    tags: ['en:poultry'],
    family: 'poultry',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:poultry' },
  },
  {
    tags: ['en:porks', 'en:beef', 'en:meats'],
    family: 'meat',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:porks' },
  },
  {
    tags: ['en:fishes', 'en:seafood'],
    family: 'fish_seafood',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:fishes' },
  },
  {
    tags: ['en:hams', 'en:sausages', 'en:cold-cuts'],
    family: 'deli_cold_cuts',
    form: 'chilled',
    evidence: { kind: 'off_tag', value: 'en:hams' },
  },
  {
    tags: ['en:pastas'],
    family: 'pasta',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:pastas' },
  },
  {
    tags: ['en:rices'],
    family: 'rice',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:rices' },
  },
  {
    tags: ['en:flours'],
    family: 'flour_baking',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:flours' },
  },
  {
    tags: ['en:vegetable-oils', 'en:olive-oils', 'en:vinegars'],
    family: 'oil_vinegar',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:vegetable-oils' },
  },
  {
    tags: ['en:spices', 'en:salts', 'en:baking-powders'],
    family: 'spices_seasoning',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:spices' },
  },
  {
    tags: ['en:tomato-sauces'],
    family: 'tomato_products',
    form: 'canned_jarred',
    evidence: { kind: 'off_tag', value: 'en:tomato-sauces' },
  },
  {
    tags: ['en:canned-foods', 'en:canned-vegetables', 'en:canned-fruits'],
    family: 'canned_food',
    form: 'canned_jarred',
    evidence: { kind: 'off_tag', value: 'en:canned-foods' },
  },
  {
    tags: ['en:soups'],
    family: 'soup_ready_meal',
    form: 'prepared',
    evidence: { kind: 'off_tag', value: 'en:soups' },
  },
  {
    tags: ['en:breakfast-cereals'],
    family: 'breakfast_cereal',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:breakfast-cereals' },
  },
  {
    tags: ['en:coffees'],
    family: 'coffee',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:coffees' },
  },
  {
    tags: ['en:teas', 'en:herbal-teas'],
    family: 'tea',
    form: 'dry',
    evidence: { kind: 'off_tag', value: 'en:teas' },
  },
  {
    tags: ['en:fruit-juices'],
    family: 'juice',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:fruit-juices' },
  },
  {
    tags: ['en:beers', 'en:wines', 'en:alcoholic-beverages'],
    family: 'alcoholic_beverages',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:alcoholic-beverages' },
  },
  {
    tags: ['en:frozen-foods', 'en:frozen-fruits', 'en:frozen-vegetables', 'en:frozen-ready-meals'],
    family: 'other_food',
    form: 'frozen',
    evidence: { kind: 'off_tag', value: 'en:frozen-foods' },
  },
  {
    tags: ['en:baby-foods'],
    family: 'baby_food',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:baby-foods' },
  },
  {
    tags: ['en:pet-food', 'en:cat-food', 'en:dog-food'],
    family: 'pet_food',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:pet-food' },
  },
  {
    tags: ['en:cleaning-products'],
    family: 'household_cleaning',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:cleaning-products' },
  },
  {
    tags: ['en:hygiene', 'en:body-care'],
    family: 'personal_care',
    form: 'ambient',
    evidence: { kind: 'off_tag', value: 'en:hygiene' },
  },
];

type NameDescriptorRule = ProductDescriptor & { values: readonly string[] };

const NAME_DESCRIPTOR_RULES: readonly NameDescriptorRule[] = [
  // Deterministische Grundwörter in Komposita schlagen generische Modifier
  // wie "Tomate" in "Tomatensuppe".
  {
    values: ['tomatensuppe', 'gemüsesuppe', 'suppe', 'brühe', 'fertiggericht', 'ravioli'],
    family: 'soup_ready_meal',
    form: 'prepared',
    evidence: { kind: 'name_rule', value: 'ready_meal' },
  },
  {
    values: ['apfel', 'banane', 'birne', 'orange', 'mango', 'avocado'],
    family: 'fruit',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'fruit' },
  },
  {
    values: ['tomate', 'gurke', 'paprika', 'karotte', 'kartoffel', 'zwiebel', 'gemüse'],
    family: 'vegetables',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'vegetables' },
  },
  {
    values: ['brot', 'brötchen', 'baguette', 'croissant'],
    family: 'bread_baked_goods',
    form: 'fresh',
    evidence: { kind: 'name_rule', value: 'brot' },
  },
  {
    values: ['hafermilch', 'sojamilch', 'mandelmilch', 'haferdrink', 'sojadrink'],
    family: 'plant_drink',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'plant_drink' },
  },
  {
    values: ['joghurt', 'quark', 'sahne', 'käse', 'butter', 'eier', 'ei'],
    family: 'yogurt',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'chilled_dairy' },
  },
  {
    values: ['tofu', 'tempeh', 'seitan', 'veggie'],
    family: 'tofu_meat_alternative',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'tofu' },
  },
  {
    values: ['hähnchen', 'huhn', 'pute', 'ente', 'gans'],
    family: 'poultry',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'poultry' },
  },
  {
    values: ['hackfleisch', 'rindfleisch', 'schweinefleisch', 'schnitzel', 'steak', 'fleisch'],
    family: 'meat',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'meat' },
  },
  {
    values: ['lachs', 'forelle', 'garnelen', 'fisch', 'meeresfrüchte'],
    family: 'fish_seafood',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'fish' },
  },
  {
    values: ['wurst', 'schinken', 'salami', 'aufschnitt'],
    family: 'deli_cold_cuts',
    form: 'chilled',
    evidence: { kind: 'name_rule', value: 'deli' },
  },
  {
    values: ['nudeln', 'pasta', 'spaghetti', 'penne'],
    family: 'pasta',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'pasta' },
  },
  {
    values: ['reis', 'basmatireis'],
    family: 'rice',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'rice' },
  },
  {
    values: ['müsli', 'haferflocken', 'cornflakes'],
    family: 'breakfast_cereal',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'breakfast' },
  },
  {
    values: ['mehl', 'backpulver', 'hefe'],
    family: 'flour_baking',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'baking' },
  },
  {
    values: ['öl', 'olivenöl', 'essig', 'salz', 'pfeffer', 'gewürz'],
    family: 'oil_vinegar',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'oils_spices' },
  },
  {
    values: ['ketchup', 'senf', 'mayonnaise'],
    family: 'condiments',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'condiments' },
  },
  {
    values: ['dose', 'konserve', 'passata', 'tomatenmark', 'sauerkraut'],
    family: 'canned_food',
    form: 'canned_jarred',
    evidence: { kind: 'name_rule', value: 'canned' },
  },
  {
    values: ['suppe', 'brühe', 'fertiggericht', 'ravioli'],
    family: 'soup_ready_meal',
    form: 'prepared',
    evidence: { kind: 'name_rule', value: 'ready_meal' },
  },
  {
    values: ['kaffee', 'tee', 'kakao'],
    family: 'coffee',
    form: 'dry',
    evidence: { kind: 'name_rule', value: 'hot_drinks' },
  },
  {
    values: ['bier', 'wein', 'sekt', 'gin', 'rum', 'vodka', 'whisky'],
    family: 'alcoholic_beverages',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'alcohol' },
  },
  {
    values: ['wasser', 'saft', 'cola', 'limonade'],
    family: 'water_soft_drinks',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'drinks' },
  },
  {
    values: ['schokolade', 'chips', 'nüsse', 'cracker', 'snack'],
    family: 'savory_snacks',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'snacks' },
  },
  {
    values: ['bonbon', 'süßigkeiten', 'pralinen', 'süßware'],
    family: 'sweets',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'sweets' },
  },
  {
    values: ['windeln', 'babynahrung', 'babybrei'],
    family: 'baby_food',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'baby' },
  },
  {
    values: ['katzenfutter', 'hundefutter', 'tierfutter'],
    family: 'pet_food',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'pets' },
  },
  {
    values: ['spülmittel', 'waschmittel', 'putzmittel', 'müllbeutel'],
    family: 'household_cleaning',
    form: 'ambient',
    evidence: { kind: 'name_rule', value: 'household' },
  },
  {
    values: ['shampoo', 'duschgel', 'zahnpasta', 'seife'],
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
  for (const rule of NAME_DESCRIPTOR_RULES) {
    const matchedValue = rule.values.find((value) =>
      tokens.some((token) => token === value || (value.length > 2 && token.startsWith(value))),
    );
    if (matchedValue) return { ...rule, evidence: { ...rule.evidence, value: matchedValue } };
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
