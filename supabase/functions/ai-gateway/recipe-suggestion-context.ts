import type {
  RecipeSuggestionContext,
  RecipeSuggestionSource,
} from './recipe-suggestion-contract.ts';

export type RecipeSuggestionGatewayInput = {
  inventory: {
    lots: ReadonlyArray<{
      lotId: string;
      normalizedName: string;
      quantity: number | null;
      unit: string | null;
      bestBefore: string | null;
      useBy: string | null;
    }>;
  };
  recipes: ReadonlyArray<{
    recipeId: string;
    title: string;
    source?: 'catalog' | 'template';
    estimatedMinutes: number | null;
    servings: number | null;
    dietaryTags: readonly string[];
    allergens: readonly string[] | null;
    ingredients: ReadonlyArray<{
      normalizedName: string;
      quantity: number | null;
      unit: string | null;
    }>;
  }>;
  shoppingItems?: ReadonlyArray<{
    shoppingItemId: string;
    name: string;
    quantity: number;
    unit: string;
  }>;
  servings: number;
  maxMinutes: number | null;
  dietaryPattern: string | null;
  allergies: readonly string[];
  preferences?: readonly string[];
  forbiddenIngredients?: readonly string[];
  shoppingDecision: 'yes' | 'no' | null;
  today: Date;
};

export type RecipeSuggestionContextResult = {
  context: RecipeSuggestionContext;
  shoppingQuestion: string | null;
};

const SHOPPING_QUESTION = 'Willst du heute noch einkaufen?';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

function dateOnly(value: string | null): string | null {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function todayOnly(today: Date): string {
  return today.toISOString().slice(0, 10);
}

function daysUntil(date: string, today: Date): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const start = Date.parse(`${todayOnly(today)}T00:00:00Z`);
  return Math.round((target - start) / 86_400_000);
}

function isUsableLot(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
  today: Date,
): boolean {
  const expiry = dateOnly(lot.useBy ?? lot.bestBefore);
  return (
    lot.normalizedName.trim().length > 0 &&
    lot.quantity !== null &&
    Number.isFinite(lot.quantity) &&
    lot.quantity > 0 &&
    (expiry === null || daysUntil(expiry, today) >= 0)
  );
}

function lotPriority(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
  today: Date,
): number {
  const expiry = dateOnly(lot.useBy ?? lot.bestBefore);
  if (expiry === null) return 1;

  const days = Math.max(0, daysUntil(expiry, today));
  return 101 + Math.max(0, 100 - days * 10);
}

function sourceRank(source: RecipeSuggestionSource): number {
  return source === 'catalog' ? 0 : 1;
}

type MeasurementDimension = 'mass' | 'volume' | 'count' | 'package' | 'portion';
type ComparableQuantity = { dimension: MeasurementDimension; value: number };

const MEASUREMENT_DEFINITIONS: ReadonlyMap<
  string,
  { dimension: MeasurementDimension; factor: number }
> = new Map([
  ['g', { dimension: 'mass', factor: 1 }],
  ['kg', { dimension: 'mass', factor: 1_000 }],
  ['ml', { dimension: 'volume', factor: 1 }],
  ['l', { dimension: 'volume', factor: 1_000 }],
  ['piece', { dimension: 'count', factor: 1 }],
  ['package', { dimension: 'package', factor: 1 }],
  ['portion', { dimension: 'portion', factor: 1 }],
]);

function comparableQuantity(quantity: number | null, unit: string | null): ComparableQuantity | null {
  if (quantity === null || !Number.isFinite(quantity) || quantity <= 0 || unit === null) {
    return null;
  }
  const definition = MEASUREMENT_DEFINITIONS.get(normalize(unit));
  if (definition === undefined) return null;
  const value = quantity * definition.factor;
  return Number.isFinite(value) ? { dimension: definition.dimension, value } : null;
}

type QuantityLedger = Map<string, Map<MeasurementDimension, number>>;

function addComparableToQuantityLedger(
  ledger: QuantityLedger,
  name: string,
  quantity: ComparableQuantity,
): void {
  const byDimension = ledger.get(normalize(name)) ?? new Map<MeasurementDimension, number>();
  byDimension.set(
    quantity.dimension,
    (byDimension.get(quantity.dimension) ?? 0) + quantity.value,
  );
  ledger.set(normalize(name), byDimension);
}

function addToQuantityLedger(
  ledger: QuantityLedger,
  name: string,
  quantity: number | null,
  unit: string | null,
): void {
  const comparable = comparableQuantity(quantity, unit ?? 'piece');
  if (comparable === null) return;
  addComparableToQuantityLedger(ledger, name, comparable);
}

function hasSufficientRecipeQuantities(
  recipe: RecipeSuggestionGatewayInput['recipes'][number],
  servings: number,
  usableLots: ReadonlyArray<RecipeSuggestionGatewayInput['inventory']['lots'][number]>,
  plannedShoppingItems: ReadonlyArray<NonNullable<RecipeSuggestionGatewayInput['shoppingItems']>[number]>,
): boolean {
  if (recipe.servings === null || !Number.isInteger(recipe.servings) || recipe.servings <= 0) {
    return false;
  }

  const available: QuantityLedger = new Map();
  usableLots.forEach((lot) => addToQuantityLedger(available, lot.normalizedName, lot.quantity, lot.unit));
  plannedShoppingItems.forEach((item) => addToQuantityLedger(available, item.name, item.quantity, item.unit));

  const required: QuantityLedger = new Map();
  const servingScale = servings / recipe.servings;
  for (const ingredient of recipe.ingredients) {
    const name = ingredient.normalizedName.trim();
    if (name.length === 0) return false;
    const quantity = comparableQuantity(ingredient.quantity, ingredient.unit);
    if (quantity === null) return false;
    addComparableToQuantityLedger(required, name, {
      dimension: quantity.dimension,
      value: quantity.value * servingScale,
    });
  }

  for (const [name, byDimension] of required) {
    const availableByDimension = available.get(name);
    if (availableByDimension === undefined) return false;
    for (const [dimension, requiredValue] of byDimension) {
      const availableValue = availableByDimension.get(dimension) ?? 0;
      const tolerance = Number.EPSILON * Math.max(requiredValue, availableValue) * 4;
      if (requiredValue - availableValue > tolerance) return false;
    }
  }
  return true;
}

export function buildRecipeSuggestionContext(
  input: RecipeSuggestionGatewayInput,
): RecipeSuggestionContextResult | null {
  const usableLots = input.inventory.lots
    .map((lot, index) => ({ lot, index }))
    .filter(({ lot }) => isUsableLot(lot, input.today));
  if (usableLots.length === 0) return null;

  const allergyNames = new Set(input.allergies.map(normalize));
  const safeLots = usableLots.filter(({ lot }) => !allergyNames.has(normalize(lot.normalizedName)));
  if (safeLots.length === 0) return null;

  const priorityFoods = safeLots
    .map(({ lot, index }) => ({
      lot,
      index,
      priorityScore: lotPriority(lot, input.today),
    }))
    .sort((left, right) =>
      right.priorityScore - left.priorityScore ||
      (left.lot.useBy ?? left.lot.bestBefore ?? '9999-12-31').localeCompare(
        right.lot.useBy ?? right.lot.bestBefore ?? '9999-12-31',
      ) ||
      left.index - right.index,
    );

  const shoppingItems = input.shoppingItems ?? [];
  const plannedShoppingItems = input.shoppingDecision === 'yes'
    ? shoppingItems.map((item) => ({
        shopping_item_id: item.shoppingItemId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }))
    : [];
  const shoppingQuestion = shoppingItems.length > 0 && input.shoppingDecision === null
    ? SHOPPING_QUESTION
    : null;

  const allowedNames = new Set([
    ...priorityFoods.map(({ lot }) => normalize(lot.normalizedName)),
    ...plannedShoppingItems.map((item) => normalize(item.name)),
  ]);
  const priorityScoreByName = new Map(
    priorityFoods.map(({ lot, priorityScore }) => [normalize(lot.normalizedName), priorityScore]),
  );
  const forbiddenIngredients = new Set([
    ...input.allergies.map(normalize),
    ...(input.forbiddenIngredients ?? []).map(normalize),
  ]);

  const candidateRecipes = input.recipes
    .map((recipe, index) => {
      const source = recipe.source ?? 'catalog';
      const ingredientNames = recipe.ingredients
        .map((ingredient) => ingredient.normalizedName.trim())
        .filter((name) => name.length > 0);
      const hasUnknownAllergen = recipe.allergens === null && input.allergies.length > 0;
      const hasForbiddenIngredient = ingredientNames.some((name) => forbiddenIngredients.has(normalize(name)));
      const dietaryMatch = input.dietaryPattern === null || recipe.dietaryTags.some(
        (tag) => normalize(tag) === normalize(input.dietaryPattern!),
      );
      const timeMatch = input.maxMinutes === null ||
        (recipe.estimatedMinutes !== null && recipe.estimatedMinutes <= input.maxMinutes);
      const servingsMatch = input.servings > 0 && recipe.servings !== null;
      const ingredientsAvailable = ingredientNames.length > 0 && ingredientNames.every(
        (name) => allowedNames.has(normalize(name)),
      ) && hasSufficientRecipeQuantities(
        recipe,
        input.servings,
        safeLots.map(({ lot }) => lot),
        input.shoppingDecision === 'yes' ? shoppingItems : [],
      );
      const priorityCoverage = ingredientNames.reduce(
        (score, name) => score + (priorityScoreByName.get(normalize(name)) ?? 0),
        0,
      );

      return {
        recipe,
        index,
        source,
        ingredientNames,
        priorityCoverage,
        eligible: !hasUnknownAllergen &&
          !hasForbiddenIngredient &&
          dietaryMatch &&
          timeMatch &&
          servingsMatch &&
          ingredientsAvailable &&
          priorityCoverage > 0,
      };
    })
    .filter((candidate) => candidate.eligible)
    .sort((left, right) =>
      right.priorityCoverage - left.priorityCoverage ||
      sourceRank(left.source) - sourceRank(right.source) ||
      left.index - right.index,
    )
    .slice(0, 3)
    .map((candidate) => ({
      id: candidate.recipe.recipeId,
      source: candidate.source,
      title: candidate.recipe.title,
      ingredient_names: candidate.ingredientNames,
    }));

  const unsafeNames = input.inventory.lots
    .filter((lot) => !isUsableLot(lot, input.today))
    .map((lot) => lot.normalizedName);
  const context: RecipeSuggestionContext = {
    schema_version: 1,
    request: { type: 'recipe_suggestion', servings: input.servings },
    constraints: {
      allergies: [...input.allergies],
      preferences: [
        ...(input.preferences ?? []),
        ...(input.dietaryPattern === null ? [] : [input.dietaryPattern]),
      ],
      allowed_staples: [],
      forbidden_ingredients: [
        ...new Set([
          ...input.allergies,
          ...(input.forbiddenIngredients ?? []),
          ...unsafeNames,
        ]),
      ],
    },
    priority_foods: priorityFoods.map(({ lot, priorityScore }) => ({
      inventory_item_id: lot.lotId,
      name: lot.normalizedName,
      available_quantity: lot.quantity!,
      unit: lot.unit ?? 'piece',
      priority_score: priorityScore,
    })),
    planned_shopping_items: plannedShoppingItems,
    candidate_recipes: candidateRecipes,
    shopping_question: shoppingQuestion,
    fallback_allowed: candidateRecipes.length === 0,
  };

  return { context, shoppingQuestion };
}
