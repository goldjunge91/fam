import { createHash } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { extractWaivyRecipeImages } from './extract-waivy-recipe-images';

export type WaivyIngredient = {
  id: string;
  name: string;
  category: string;
  unit: string;
};

export type WaivyRecipeIngredient = {
  ingredientId: string;
  quantity: number;
  optional?: boolean;
  note?: string;
};

export type WaivySubstitution = {
  forIngredientId: string;
  swap: string;
  savings?: string;
};

export type WaivyRecipe = {
  id: string;
  name: string;
  description?: string;
  mealType?: string;
  servings?: number;
  ingredients: WaivyRecipeIngredient[];
  steps: string[];
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  difficulty?: string;
  equipment?: string[];
  dietTags?: string[];
  cuisine?: string;
  tags?: string[];
  storageInstructions?: string;
  reheatingInstructions?: string;
  cheapTips?: string[];
  substitutions?: WaivySubstitution[];
  crispinessLevel?: string;
  airFryerTimeMinutes?: number;
  airFryerTemperatureF?: number;
  variantGroup?: string;
  variantType?: string;
  dormFriendly?: boolean | null;
  mealPrepFriendly?: boolean | null;
  whyCheap?: string;
  healthierTips?: string[];
  batchPrepTips?: string[];
  optionalAddIns?: string[];
};

export type WaivyRecipeImage = {
  recipeId: string;
  src: string;
  alt?: string;
  sourceName?: string;
  sourceUrl?: string;
  license?: string;
  attributionRequired?: boolean;
  attributionText?: string;
  verifiedMatch?: boolean;
};

export type CatalogStatus = 'draft' | 'published' | 'archived';
export type CatalogUnit = 'g' | 'kg' | 'ml' | 'l' | 'piece' | 'package' | 'portion';

export type CatalogRecipeRow = {
  id: string;
  external_id: string;
  slug: string;
  title: string;
  instructions: string | null;
  prep_time_minutes: number | null;
  cook_time_minutes: number | null;
  storage_instructions: string | null;
  reheating_instructions: string | null;
  cheap_tips: string[];
  substitutions: WaivySubstitution[];
  crispiness_level: string | null;
  air_fryer_time_minutes: number | null;
  air_fryer_temperature_f: number | null;
  variant_group: string | null;
  variant_type: string | null;
  dorm_friendly: boolean | null;
  meal_prep_friendly: boolean | null;
  why_cheap: string | null;
  healthier_tips: string[];
  batch_prep_tips: string[];
  optional_add_ins: string[];
  difficulty: 'easy' | 'medium' | 'hard' | null;
  dish_types: string[];
  dietary_tags: string[];
  hashtags: string[];
  default_servings: number;
  status: CatalogStatus;
  sort_order: number;
  source_url: string;
};

export type CatalogComponentRow = {
  id: string;
  recipe_id: string;
  name: string;
  serving_grams: number;
  position: number;
};

export type CatalogItemRow = {
  id: string;
  component_id: string;
  recipe_id: string;
  product_id: null;
  sub_component_id: null;
  ingredient_name: string;
  grams: number;
  quantity: number;
  unit: CatalogUnit;
  position: number;
  source_ingredient_id: string;
  source_unit: string;
  source_quantity: number;
  optional: boolean;
  source_note: string | null;
};

export type CatalogStepRow = {
  id: string;
  recipe_id: string;
  position: number;
  text: string;
  timer_minutes: null;
};

export type CatalogImageRow = {
  id: string;
  recipe_id: string;
  storage_path: null;
  source_url: string | null;
  source_page_url: string | null;
  source_name: string | null;
  license: string | null;
  attribution_required: boolean;
  attribution_text: string | null;
  verified_match: boolean;
  alt_text: string | null;
  position: number;
};

export type ConversionWarning = {
  code: 'approximate_unit_conversion' | 'unknown_source_unit' | 'zero_quantity_ingredient';
  source_unit: string;
  count: number;
  examples: string[];
};

export type CatalogBatchItem = {
  key: string;
  ingredientName: string;
  grams: number;
  quantity: number;
  unit: CatalogUnit;
  position: number;
  optional: boolean;
  source_note: string | null;
};

export type CatalogBatchComponent = {
  key: string;
  name: string;
  servingGrams: number;
  position: number;
  items: CatalogBatchItem[];
};

export type CatalogBatchStep = {
  position: number;
  text: string;
  timerMinutes: null;
  ingredientKeys: string[];
  images: string[];
};

export type CatalogBatchImage = {
  storagePath: string | null;
  localPath: string | null;
  sourceUrl: string | null;
  sourcePageUrl: string | null;
  sourceName: string | null;
  license: string | null;
  attributionRequired: boolean;
  attributionText: string | null;
  verifiedMatch: boolean;
  altText: string | null;
  position: number;
};

export type CatalogBatchRecipe = {
  externalId: string;
  slug: string;
  title: string;
  instructions: string | null;
  prepTimeMinutes: number | null;
  cookTimeMinutes: number | null;
  storageInstructions: string | null;
  reheatingInstructions: string | null;
  cheapTips: string[];
  substitutions: WaivySubstitution[];
  crispinessLevel: string | null;
  airFryerTimeMinutes: number | null;
  airFryerTemperatureF: number | null;
  variantGroup: string | null;
  variantType: string | null;
  dormFriendly: boolean | null;
  mealPrepFriendly: boolean | null;
  whyCheap: string | null;
  healthierTips: string[];
  batchPrepTips: string[];
  optionalAddIns: string[];
  difficulty: CatalogRecipeRow['difficulty'];
  dishTypes: string[];
  dietaryTags: string[];
  hashtags: string[];
  defaultServings: number;
  status: CatalogStatus;
  sortOrder: number;
  sourceUrl: string;
  components: CatalogBatchComponent[];
  steps: CatalogBatchStep[];
  images: CatalogBatchImage[];
};

export type CatalogImportBundle = {
  format: 'fam.catalog_recipe_batch_import.v2';
  schemaVersion: 2;
  source: {
    repository: 'https://github.com/justinsuo/waivy';
    dataset: 'CATALOG_RECIPES';
  };
  recipes: CatalogBatchRecipe[];
  warnings: ConversionWarning[];
};

const UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const ALLOWED_DISH_TYPES = new Set([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'appetizer',
  'brunch',
]);
const ALLOWED_DIETARY_TAGS = new Set([
  'vegetarian',
  'vegan',
  'high_fat',
  'low_fat',
  'lactose_free',
  'sugar_free',
  'gluten_free',
]);
const DIETARY_TAG_MAP: Record<string, string> = {
  'gluten-free': 'gluten_free',
  'dairy-free': 'lactose_free',
};
const MEAL_TYPE_MAP: Record<string, string> = {
  'meal-prep': 'dinner',
  drink: 'snack',
};

/** Generates a repeatable UUID v5-shaped identifier without adding a dependency. */
export function stableUuid(value: string): string {
  const digest = createHash('sha1').update(`${UUID_NAMESPACE}:${value}`).digest();
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = digest.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return value && Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function positiveIntegerOrNull(value: number | undefined): number | null {
  return value && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function nullableText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function mapDifficulty(value: string | undefined): CatalogRecipeRow['difficulty'] {
  return value === 'easy' || value === 'medium' || value === 'hard' ? value : null;
}

function mapDishTypes(mealType: string | undefined): string[] {
  if (!mealType) return [];
  const mapped = MEAL_TYPE_MAP[mealType] ?? mealType;
  return ALLOWED_DISH_TYPES.has(mapped) ? [mapped] : [];
}

function mapDietaryTags(dietTags: readonly string[]): string[] {
  return unique(
    dietTags
      .map((tag) => DIETARY_TAG_MAP[tag] ?? tag)
      .filter((tag) => ALLOWED_DIETARY_TAGS.has(tag)),
  );
}

function mapHashtags(recipe: WaivyRecipe): string[] {
  const hashtags: string[] = [];
  if (recipe.mealType && !ALLOWED_DISH_TYPES.has(recipe.mealType)) {
    hashtags.push(slugify(recipe.mealType));
  }
  for (const tag of recipe.dietTags ?? []) {
    const mapped = DIETARY_TAG_MAP[tag] ?? tag;
    if (!ALLOWED_DIETARY_TAGS.has(mapped) || mapped !== tag) hashtags.push(slugify(tag));
  }
  if (recipe.cuisine) hashtags.push(slugify(recipe.cuisine));
  for (const tag of recipe.tags ?? []) hashtags.push(slugify(tag));
  return unique(hashtags);
}

type Measure = {
  quantity: number;
  unit: CatalogUnit;
  grams: number;
  approximate: boolean;
};

const COUNT_GRAMS: Record<string, number> = {
  avocado: 150,
  banana: 118,
  beet: 100,
  bulb: 234,
  bun: 60,
  carrot: 61,
  cake: 10,
  chili: 10,
  clove: 3,
  cookie: 15,
  cucumber: 300,
  dog: 50,
  each: 100,
  ear: 90,
  egg: 50,
  head: 500,
  leaf: 1,
  lemon: 84,
  lime: 67,
  mango: 200,
  muffin: 57,
  onion: 150,
  orange: 131,
  parsnip: 160,
  pepper: 120,
  piece: 100,
  pita: 60,
  potato: 170,
  roll: 60,
  shallot: 25,
  slice: 25,
  sprig: 2,
  stalk: 15,
  tomato: 120,
  tomatillo: 35,
  tortilla: 40,
  turnip: 120,
  zucchini: 196,
};

const PACKAGE_UNITS = new Set([
  '6 oz container',
  '8 oz',
  '12 oz block',
  '4 oz log',
  'bag',
  'bar',
  'bottle',
  'can',
  'jar',
  'link',
  'pack',
  'packet',
  'roll',
  'scoop',
  'spray',
]);

function packageGrams(unit: string): number | null {
  const ounces = unit.match(/^(\d+(?:\.\d+)?)\s*oz(?:\s|$)/)?.[1];
  if (ounces) return Number(ounces) * 28.35;
  return (
    {
      bag: 500,
      bar: 40,
      bottle: 250,
      can: 400,
      jar: 500,
      link: 75,
      pack: 100,
      packet: 30,
      roll: 60,
      scoop: 30,
      spray: 1,
    }[unit] ?? null
  );
}

function convertMeasure(sourceUnit: string, sourceQuantity: number): Measure {
  const unit = sourceUnit.trim().toLowerCase();
  if (unit === 'g')
    return { quantity: sourceQuantity, unit: 'g', grams: sourceQuantity, approximate: false };
  if (unit === 'kg') {
    const grams = sourceQuantity * 1_000;
    return { quantity: grams, unit: 'g', grams, approximate: false };
  }
  if (unit === 'ml') {
    return { quantity: sourceQuantity, unit: 'ml', grams: sourceQuantity, approximate: true };
  }
  if (unit === 'l') {
    const quantity = sourceQuantity * 1_000;
    return { quantity, unit: 'ml', grams: quantity, approximate: true };
  }
  if (unit === 'oz') {
    const grams = sourceQuantity * 28.35;
    return { quantity: grams, unit: 'g', grams, approximate: false };
  }

  const volumeGrams: Record<string, number> = {
    tbsp: 15,
    tsp: 5,
    cup: 240,
    '1/4 cup': 60,
    '1/2 cup': 120,
    'cup-dry': 180,
  };
  const volume = volumeGrams[unit];
  if (volume) {
    const grams = sourceQuantity * volume;
    return { quantity: grams, unit: 'g', grams, approximate: true };
  }
  if (unit === 'serving') {
    return {
      quantity: sourceQuantity,
      unit: 'portion',
      grams: sourceQuantity * 100,
      approximate: true,
    };
  }
  if (PACKAGE_UNITS.has(unit)) {
    const gramsPerPackage = packageGrams(unit) ?? 100;
    return {
      quantity: sourceQuantity,
      unit: 'package',
      grams: sourceQuantity * gramsPerPackage,
      approximate: true,
    };
  }
  if (COUNT_GRAMS[unit]) {
    return {
      quantity: sourceQuantity,
      unit: 'piece',
      grams: sourceQuantity * COUNT_GRAMS[unit],
      approximate: true,
    };
  }
  return {
    quantity: sourceQuantity,
    unit: 'piece',
    grams: sourceQuantity * 100,
    approximate: true,
  };
}

function warningForMeasure(sourceUnit: string, measure: Measure): ConversionWarning['code'] | null {
  if (!measure.approximate) return null;
  const normalized = sourceUnit.trim().toLowerCase();
  const knownUnits = new Set([
    'ml',
    'l',
    'tbsp',
    'tsp',
    'cup',
    '1/4 cup',
    '1/2 cup',
    'cup-dry',
    'serving',
    ...PACKAGE_UNITS,
    ...Object.keys(COUNT_GRAMS),
  ]);
  return knownUnits.has(normalized) || /^\d+(?:\.\d+)?\s*oz(?:\s|$)/.test(normalized)
    ? 'approximate_unit_conversion'
    : 'unknown_source_unit';
}

export type ConvertedRecipe = {
  recipe: CatalogRecipeRow;
  components: CatalogComponentRow[];
  items: CatalogItemRow[];
  steps: CatalogStepRow[];
  images: CatalogImageRow[];
  localImagePath: string | null;
  warnings: Array<{ code: ConversionWarning['code']; source_unit: string }>;
};

function convertWaivyImage(
  image: WaivyRecipeImage | undefined,
  recipeId: string,
  externalId: string,
): CatalogImageRow {
  return {
    id: stableUuid(`image:${externalId}:0`),
    recipe_id: recipeId,
    storage_path: null,
    source_url: image?.src?.trim() || null,
    source_page_url: image?.sourceUrl?.trim() || null,
    source_name: image?.sourceName?.trim() || null,
    license: image?.license?.trim() || null,
    attribution_required: image?.attributionRequired === true,
    attribution_text: image?.attributionText?.trim() || null,
    verified_match: image?.verifiedMatch === true,
    alt_text: image?.alt?.trim() || null,
    position: 0,
  };
}

export function convertWaivyRecipe(
  recipe: WaivyRecipe,
  ingredientCatalog: readonly WaivyIngredient[],
  sortOrder: number,
  status: CatalogStatus = 'published',
  image?: WaivyRecipeImage,
  localImagePath?: string,
): ConvertedRecipe {
  const ingredientsById = new Map(
    ingredientCatalog.map((ingredient) => [ingredient.id, ingredient]),
  );
  const externalId = `waivy:${recipe.id}`;
  const recipeId = stableUuid(`recipe:${externalId}`);
  const componentId = stableUuid(`component:${externalId}:ingredients`);
  const convertedItems: CatalogItemRow[] = [];
  const warnings: ConvertedRecipe['warnings'] = [];

  for (const [position, sourceItem] of recipe.ingredients.entries()) {
    const ingredient = ingredientsById.get(sourceItem.ingredientId);
    if (!ingredient) {
      throw new Error(`Waivy-Zutat ${sourceItem.ingredientId} fehlt im Zutatenkatalog.`);
    }
    if (sourceItem.quantity === 0) {
      warnings.push({ code: 'zero_quantity_ingredient', source_unit: ingredient.unit });
      continue;
    }
    const measure = convertMeasure(ingredient.unit, sourceItem.quantity);
    const warningCode = warningForMeasure(ingredient.unit, measure);
    if (warningCode) warnings.push({ code: warningCode, source_unit: ingredient.unit });
    convertedItems.push({
      id: stableUuid(`item:${externalId}:${position}:${sourceItem.ingredientId}`),
      component_id: componentId,
      recipe_id: recipeId,
      product_id: null,
      sub_component_id: null,
      ingredient_name: ingredient.name,
      grams: Math.max(0.01, Math.round(measure.grams * 100) / 100),
      quantity: Math.max(0.01, Math.round(measure.quantity * 100) / 100),
      unit: measure.unit,
      position: convertedItems.length,
      source_ingredient_id: sourceItem.ingredientId,
      source_unit: ingredient.unit,
      source_quantity: sourceItem.quantity,
      optional: sourceItem.optional === true,
      source_note: sourceItem.note?.trim() || null,
    });
  }

  const servingGrams = convertedItems.reduce((sum, item) => sum + item.grams, 0);
  const defaultServings = positiveInteger(recipe.servings, 1);
  const slug = slugify(recipe.id) || slugify(recipe.name) || `recipe-${sortOrder + 1}`;
  const recipeRow: CatalogRecipeRow = {
    id: recipeId,
    external_id: externalId,
    slug,
    title: recipe.name.trim(),
    instructions: nullableText(recipe.description),
    prep_time_minutes: positiveIntegerOrNull(recipe.prepTimeMinutes),
    cook_time_minutes: positiveIntegerOrNull(recipe.cookTimeMinutes ?? recipe.totalTimeMinutes),
    storage_instructions: nullableText(recipe.storageInstructions),
    reheating_instructions: nullableText(recipe.reheatingInstructions),
    cheap_tips: unique(recipe.cheapTips ?? []),
    substitutions: recipe.substitutions ?? [],
    crispiness_level: nullableText(recipe.crispinessLevel),
    air_fryer_time_minutes: positiveIntegerOrNull(recipe.airFryerTimeMinutes),
    air_fryer_temperature_f: positiveIntegerOrNull(recipe.airFryerTemperatureF),
    variant_group: nullableText(recipe.variantGroup),
    variant_type: nullableText(recipe.variantType),
    dorm_friendly: recipe.dormFriendly ?? null,
    meal_prep_friendly: recipe.mealPrepFriendly ?? null,
    why_cheap: nullableText(recipe.whyCheap),
    healthier_tips: unique(recipe.healthierTips ?? []),
    batch_prep_tips: unique(recipe.batchPrepTips ?? []),
    optional_add_ins: unique(recipe.optionalAddIns ?? []),
    difficulty: mapDifficulty(recipe.difficulty),
    dish_types: mapDishTypes(recipe.mealType),
    dietary_tags: mapDietaryTags(recipe.dietTags ?? []),
    hashtags: mapHashtags(recipe),
    default_servings: defaultServings,
    status,
    sort_order: sortOrder,
    source_url: `https://justinsuo.github.io/waivy/recipes/${slug}/`,
  };

  const steps = recipe.steps
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map(
      (text, position): CatalogStepRow => ({
        id: stableUuid(`step:${externalId}:${position}`),
        recipe_id: recipeId,
        position,
        text,
        timer_minutes: null,
      }),
    );

  return {
    recipe: recipeRow,
    components: [
      {
        id: componentId,
        recipe_id: recipeId,
        name: 'Zutaten',
        serving_grams: Math.max(0.01, Math.round((servingGrams / defaultServings) * 100) / 100),
        position: 0,
      },
    ],
    items: convertedItems,
    steps,
    images: image || localImagePath ? [convertWaivyImage(image, recipeId, externalId)] : [],
    localImagePath: localImagePath?.trim() || null,
    warnings,
  };
}

function localImageStoragePath(recipe: CatalogRecipeRow, localImagePath: string): string {
  return `waivy/${recipe.slug}${extname(localImagePath).toLowerCase() || '.jpg'}`;
}

function toCatalogBatchRecipe(converted: ConvertedRecipe): CatalogBatchRecipe {
  const { recipe, components, items, steps, images } = converted;

  return {
    externalId: recipe.external_id,
    slug: recipe.slug,
    title: recipe.title,
    instructions: recipe.instructions,
    prepTimeMinutes: recipe.prep_time_minutes,
    cookTimeMinutes: recipe.cook_time_minutes,
    storageInstructions: recipe.storage_instructions,
    reheatingInstructions: recipe.reheating_instructions,
    cheapTips: recipe.cheap_tips,
    substitutions: recipe.substitutions,
    crispinessLevel: recipe.crispiness_level,
    airFryerTimeMinutes: recipe.air_fryer_time_minutes,
    airFryerTemperatureF: recipe.air_fryer_temperature_f,
    variantGroup: recipe.variant_group,
    variantType: recipe.variant_type,
    dormFriendly: recipe.dorm_friendly,
    mealPrepFriendly: recipe.meal_prep_friendly,
    whyCheap: recipe.why_cheap,
    healthierTips: recipe.healthier_tips,
    batchPrepTips: recipe.batch_prep_tips,
    optionalAddIns: recipe.optional_add_ins,
    difficulty: recipe.difficulty,
    dishTypes: recipe.dish_types,
    dietaryTags: recipe.dietary_tags,
    hashtags: recipe.hashtags,
    defaultServings: recipe.default_servings,
    status: recipe.status,
    sortOrder: recipe.sort_order,
    sourceUrl: recipe.source_url,
    components: components.map((component) => ({
      key: component.id,
      name: component.name,
      servingGrams: component.serving_grams,
      position: component.position,
      items: items
        .filter((item) => item.component_id === component.id)
        .map((item) => ({
          key: item.id,
          ingredientName: item.ingredient_name,
          grams: item.grams,
          quantity: item.quantity,
          unit: item.unit,
          position: item.position,
          optional: item.optional,
          source_note: item.source_note,
        })),
    })),
    steps: steps.map((step) => ({
      position: step.position,
      text: step.text,
      timerMinutes: step.timer_minutes,
      ingredientKeys: [],
      images: [],
    })),
    images: images.map((image) => ({
      storagePath: converted.localImagePath
        ? localImageStoragePath(recipe, converted.localImagePath)
        : image.storage_path,
      localPath: converted.localImagePath,
      sourceUrl: image.source_url,
      sourcePageUrl: image.source_page_url,
      sourceName: image.source_name,
      license: image.license,
      attributionRequired: image.attribution_required,
      attributionText: image.attribution_text,
      verifiedMatch: image.verified_match,
      altText: image.alt_text,
      position: image.position,
    })),
  };
}

export function convertWaivyRecipes(
  recipes: readonly WaivyRecipe[],
  ingredientCatalog: readonly WaivyIngredient[],
  status: CatalogStatus = 'published',
  images: readonly WaivyRecipeImage[] = [],
  localImagePaths: ReadonlyMap<string, string> = new Map(),
): CatalogImportBundle {
  const imagesByRecipeId = new Map<string, WaivyRecipeImage>();
  for (const image of images) {
    if (imagesByRecipeId.has(image.recipeId)) {
      throw new Error(`Mehr als ein Waivy-Bild für ${image.recipeId} ist nicht unterstützt.`);
    }
    imagesByRecipeId.set(image.recipeId, image);
  }
  const converted = recipes.map((recipe, index) =>
    convertWaivyRecipe(
      recipe,
      ingredientCatalog,
      index,
      status,
      imagesByRecipeId.get(recipe.id),
      localImagePaths.get(recipe.id),
    ),
  );
  const warningMap = new Map<string, ConversionWarning>();
  for (const [index, result] of converted.entries()) {
    for (const warning of result.warnings) {
      const key = `${warning.code}:${warning.source_unit}`;
      const current = warningMap.get(key) ?? {
        code: warning.code,
        source_unit: warning.source_unit,
        count: 0,
        examples: [],
      };
      current.count += 1;
      if (current.examples.length < 5 && !current.examples.includes(recipes[index].id)) {
        current.examples.push(recipes[index].id);
      }
      warningMap.set(key, current);
    }
  }
  return {
    format: 'fam.catalog_recipe_batch_import.v2',
    schemaVersion: 2,
    source: { repository: 'https://github.com/justinsuo/waivy', dataset: 'CATALOG_RECIPES' },
    recipes: converted.map(toCatalogBatchRecipe),
    warnings: [...warningMap.values()].sort((left, right) => left.code.localeCompare(right.code)),
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} muss ein nicht-leerer String sein.`);
  }
  return value.trim();
}

function requiredQuantity(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} muss eine nicht-negative Zahl sein.`);
  }
  return value;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function substitutionArray(value: unknown, label: string): WaivySubstitution[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} muss ein Array sein.`);
  return value.map((entry, index) => {
    const substitution = asRecord(entry);
    if (!substitution) throw new Error(`${label}[${index}] ist kein Objekt.`);
    return {
      forIngredientId: requiredString(
        substitution.forIngredientId,
        `${label}[${index}].forIngredientId`,
      ),
      swap: requiredString(substitution.swap, `${label}[${index}].swap`),
      ...(typeof substitution.savings === 'string' && substitution.savings.trim()
        ? { savings: substitution.savings.trim() }
        : {}),
    };
  });
}

function parseRecipe(value: unknown, index: number): WaivyRecipe {
  const record = asRecord(value);
  if (!record) throw new Error(`Rezept an Position ${index} ist kein Objekt.`);
  const rawIngredients = record.ingredients;
  if (!Array.isArray(rawIngredients)) throw new Error(`Rezept ${index} hat keine Zutatenliste.`);
  const ingredients = rawIngredients.map((entry, ingredientIndex) => {
    const ingredient = asRecord(entry);
    if (!ingredient) throw new Error(`Zutat ${index}/${ingredientIndex} ist kein Objekt.`);
    const parsed: WaivyRecipeIngredient = {
      ingredientId: requiredString(
        ingredient.ingredientId,
        `ingredientId ${index}/${ingredientIndex}`,
      ),
      quantity: requiredQuantity(ingredient.quantity, `quantity ${index}/${ingredientIndex}`),
    };
    if (ingredient.optional === true) parsed.optional = true;
    if (typeof ingredient.note === 'string' && ingredient.note.trim())
      parsed.note = ingredient.note.trim();
    return parsed;
  });
  return {
    id: requiredString(record.id, `id ${index}`),
    name: requiredString(record.name, `name ${index}`),
    description: typeof record.description === 'string' ? record.description : undefined,
    mealType: typeof record.mealType === 'string' ? record.mealType : undefined,
    servings: typeof record.servings === 'number' ? record.servings : undefined,
    ingredients,
    steps: stringArray(record.steps),
    prepTimeMinutes:
      typeof record.prepTimeMinutes === 'number' ? record.prepTimeMinutes : undefined,
    cookTimeMinutes:
      typeof record.cookTimeMinutes === 'number' ? record.cookTimeMinutes : undefined,
    totalTimeMinutes:
      typeof record.totalTimeMinutes === 'number' ? record.totalTimeMinutes : undefined,
    difficulty: typeof record.difficulty === 'string' ? record.difficulty : undefined,
    equipment: stringArray(record.equipment),
    dietTags: stringArray(record.dietTags),
    cuisine: typeof record.cuisine === 'string' ? record.cuisine : undefined,
    tags: stringArray(record.tags),
    storageInstructions:
      typeof record.storageInstructions === 'string' ? record.storageInstructions : undefined,
    reheatingInstructions:
      typeof record.reheatingInstructions === 'string' ? record.reheatingInstructions : undefined,
    cheapTips: stringArray(record.cheapTips),
    substitutions: substitutionArray(record.substitutions, `substitutions ${index}`),
    crispinessLevel:
      typeof record.crispinessLevel === 'string' ? record.crispinessLevel : undefined,
    airFryerTimeMinutes:
      typeof record.airFryerTimeMinutes === 'number' ? record.airFryerTimeMinutes : undefined,
    airFryerTemperatureF:
      typeof record.airFryerTemperatureF === 'number' ? record.airFryerTemperatureF : undefined,
    variantGroup: typeof record.variantGroup === 'string' ? record.variantGroup : undefined,
    variantType: typeof record.variantType === 'string' ? record.variantType : undefined,
    dormFriendly: typeof record.dormFriendly === 'boolean' ? record.dormFriendly : null,
    mealPrepFriendly: typeof record.mealPrepFriendly === 'boolean' ? record.mealPrepFriendly : null,
    whyCheap: typeof record.whyCheap === 'string' ? record.whyCheap : undefined,
    healthierTips: stringArray(record.healthierTips),
    batchPrepTips: stringArray(record.batchPrepTips),
    optionalAddIns: stringArray(record.optionalAddIns),
  };
}

function parseRecipeDocument(value: unknown): WaivyRecipe[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.recipes)) {
    throw new Error('Die Eingabedatei muss ein Objekt mit einem recipes-Array sein.');
  }
  return record.recipes.map((recipe, index) => parseRecipe(recipe, index));
}

function parseIngredientDocument(value: unknown): WaivyIngredient[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.ingredients)) {
    throw new Error('Die Zutaten-Datei muss ein Objekt mit einem ingredients-Array sein.');
  }
  return record.ingredients.map((entry, index) => {
    const ingredient = asRecord(entry);
    if (!ingredient) throw new Error(`Zutat an Position ${index} ist kein Objekt.`);
    return {
      id: requiredString(ingredient.id, `ingredient id ${index}`),
      name: requiredString(ingredient.name, `ingredient name ${index}`),
      category: requiredString(ingredient.category, `ingredient category ${index}`),
      unit: requiredString(ingredient.unit, `ingredient unit ${index}`),
    };
  });
}

function parseImageDocument(value: unknown): WaivyRecipeImage[] {
  const record = asRecord(value);
  if (!record || !Array.isArray(record.images)) {
    throw new Error('Die Bild-Datei muss ein Objekt mit einem images-Array sein.');
  }
  return record.images.map((entry, index) => {
    const image = asRecord(entry);
    if (!image) throw new Error(`Bild an Position ${index} ist kein Objekt.`);
    return {
      recipeId: requiredString(image.recipeId, `image recipeId ${index}`),
      src: requiredString(image.src, `image src ${index}`),
      alt: typeof image.alt === 'string' ? image.alt : undefined,
      sourceName: typeof image.sourceName === 'string' ? image.sourceName : undefined,
      sourceUrl: typeof image.sourceUrl === 'string' ? image.sourceUrl : undefined,
      license: typeof image.license === 'string' ? image.license : undefined,
      attributionRequired:
        typeof image.attributionRequired === 'boolean' ? image.attributionRequired : undefined,
      attributionText:
        typeof image.attributionText === 'string' ? image.attributionText : undefined,
      verifiedMatch: typeof image.verifiedMatch === 'boolean' ? image.verifiedMatch : undefined,
    };
  });
}

function argumentValue(args: readonly string[], name: string, fallback: string): string {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function readLocalImagePaths(directory: string): Promise<Map<string, string>> {
  let entries: Dirent[];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      return new Map();
    }
    throw error;
  }

  const localImages = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const extension = extname(entry.name).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension)) continue;
    const recipeId = entry.name.slice(0, -extension.length);
    if (localImages.has(recipeId)) {
      throw new Error(`Mehrere lokale Bilder für Waivy-Rezept ${recipeId}.`);
    }
    const absolutePath = resolve(directory, entry.name);
    localImages.set(recipeId, relative(process.cwd(), absolutePath).split(sep).join('/'));
  }
  return localImages;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const inputPath = resolve(
    argumentValue(args, '--input', 'docs/recipe-extraction/waivy-catalog-recipes.json'),
  );
  const ingredientPath = resolve(
    argumentValue(args, '--ingredients', 'docs/recipe-extraction/waivy-ingredients.json'),
  );
  const imagePath = resolve(
    argumentValue(args, '--images', 'docs/recipe-extraction/waivy-recipe-images.json'),
  );
  const localImagesPath = resolve(
    argumentValue(args, '--local-images', 'assets/rezepte/waivy-recipe-photos'),
  );
  const waivyRootArgument = args.includes('--waivy-root')
    ? resolve(argumentValue(args, '--waivy-root', ''))
    : null;
  const outputPath = resolve(
    argumentValue(args, '--output', 'docs/recipe-extraction/waivy-fam-catalog-import.json'),
  );
  const requestedStatus = argumentValue(args, '--status', 'published');
  if (
    requestedStatus !== 'draft' &&
    requestedStatus !== 'published' &&
    requestedStatus !== 'archived'
  ) {
    throw new Error('--status muss draft, published oder archived sein.');
  }

  const [recipeText, ingredientText] = await Promise.all([
    readFile(inputPath, 'utf8'),
    readFile(ingredientPath, 'utf8'),
  ]);
  const recipes = parseRecipeDocument(JSON.parse(recipeText) as unknown);
  const localImagePaths = await readLocalImagePaths(localImagesPath);
  const images = waivyRootArgument
    ? extractWaivyRecipeImages(waivyRootArgument, new Set(recipes.map((recipe) => recipe.id)))
        .images
    : parseImageDocument(JSON.parse(await readFile(imagePath, 'utf8')) as unknown);
  const bundle = convertWaivyRecipes(
    recipes,
    parseIngredientDocument(JSON.parse(ingredientText) as unknown),
    requestedStatus,
    images,
    localImagePaths,
  );
  await writeFile(outputPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  const counts = bundle.recipes.reduce(
    (totals, recipe) => ({
      items:
        totals.items +
        recipe.components.reduce(
          (componentTotal, component) => componentTotal + component.items.length,
          0,
        ),
      steps: totals.steps + recipe.steps.length,
      images: totals.images + recipe.images.length,
    }),
    { items: 0, steps: 0, images: 0 },
  );
  console.log(
    `Konvertiert: ${bundle.recipes.length} Rezepte, ${counts.items} Zutaten, ${counts.steps} Schritte, ${counts.images} Bilder.`,
  );
  const importedRecipeIds = new Set(recipes.map((recipe) => recipe.id));
  const unmatchedLocalImages = [...localImagePaths.keys()].filter(
    (recipeId) => !importedRecipeIds.has(recipeId),
  );
  console.log(`Lokale Bilder zugeordnet: ${localImagePaths.size - unmatchedLocalImages.length}.`);
  if (unmatchedLocalImages.length) {
    console.warn(
      `Lokale Bilder ohne Rezept im gewählten Datensatz: ${unmatchedLocalImages.join(', ')}`,
    );
  }
  console.log(`Warnungsgruppen: ${bundle.warnings.length}. Ausgabe: ${outputPath}`);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
