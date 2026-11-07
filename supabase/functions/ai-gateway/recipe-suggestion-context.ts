import { recipeHasAllergenConflict } from './ingredient-knowledge.ts';
import {
  type CandidateRecipeSource,
  comparableMeasurement,
  type MeasurementDimension,
  type RecipeSuggestionContext,
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
    source?: CandidateRecipeSource;
    estimatedMinutes: number | null;
    servings: number | null;
    dietaryTags: readonly string[];
    allergens: readonly string[] | null;
    steps: readonly string[];
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
  selectedInventoryItemIds?: readonly string[];
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

function validDateOnly(value: string | null): string | null {
  if (value === null) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return null;

  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function effectiveExpiry(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
): string | null {
  return validDateOnly(lot.useBy) ?? validDateOnly(lot.bestBefore);
}

function hasInvalidDate(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
): boolean {
  return (
    (lot.useBy !== null && validDateOnly(lot.useBy) === null) ||
    (lot.bestBefore !== null && validDateOnly(lot.bestBefore) === null)
  );
}

function daysUntil(date: string, today: Date): number {
  const target = Date.parse(`${date}T00:00:00Z`);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - start) / 86_400_000);
}

function isUsableLot(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
  today: Date,
): lot is typeof lot & { quantity: number; unit: string } {
  const expiry = effectiveExpiry(lot);
  return (
    !hasInvalidDate(lot) &&
    lot.normalizedName.trim().length > 0 &&
    lot.quantity !== null &&
    Number.isFinite(lot.quantity) &&
    lot.quantity > 0 &&
    lot.unit !== null &&
    lot.unit.trim().length > 0 &&
    (expiry === null || daysUntil(expiry, today) >= 0)
  );
}

function isEligibleForRecipeSuggestion(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
  today: Date,
): lot is typeof lot & { quantity: number; unit: string } {
  if (!isUsableLot(lot, today)) return false;
  const expiry = effectiveExpiry(lot);
  return expiry !== null && daysUntil(expiry, today) <= 7;
}

function lotPriority(
  lot: RecipeSuggestionGatewayInput['inventory']['lots'][number],
  today: Date,
): number {
  const expiry = effectiveExpiry(lot);
  if (expiry === null) return 1;
  return 101 + Math.max(0, 100 - Math.max(0, daysUntil(expiry, today)) * 10);
}

type QuantityLedger = Map<string, Map<MeasurementDimension, number>>;

function addQuantity(
  ledger: QuantityLedger,
  name: string,
  quantity: number | null,
  unit: string | null,
  scale = 1,
): boolean {
  if (quantity === null || unit === null) return false;
  const comparable = comparableMeasurement(quantity, unit);
  if (comparable === null || !Number.isFinite(scale) || scale <= 0) return false;

  const normalizedName = normalize(name);
  if (normalizedName.length === 0) return false;
  const byDimension = ledger.get(normalizedName) ?? new Map<MeasurementDimension, number>();
  byDimension.set(
    comparable.dimension,
    (byDimension.get(comparable.dimension) ?? 0) + comparable.value * scale,
  );
  ledger.set(normalizedName, byDimension);
  return true;
}

function hasSufficientRecipeQuantities(
  recipe: RecipeSuggestionGatewayInput['recipes'][number],
  servings: number,
  usableLots: ReadonlyArray<
    RecipeSuggestionGatewayInput['inventory']['lots'][number] & {
      quantity: number;
      unit: string;
    }
  >,
  plannedShoppingItems: ReadonlyArray<
    NonNullable<RecipeSuggestionGatewayInput['shoppingItems']>[number]
  >,
  allowMissingIngredients = false,
): boolean {
  if (
    recipe.servings === null ||
    !Number.isInteger(recipe.servings) ||
    recipe.servings <= 0
  ) {
    return false;
  }

  const available: QuantityLedger = new Map();
  usableLots.forEach((lot) => {
    addQuantity(available, lot.normalizedName, lot.quantity, lot.unit);
  });
  plannedShoppingItems.forEach((item) => {
    addQuantity(available, item.name, item.quantity, item.unit);
  });

  const required: QuantityLedger = new Map();
  const scale = servings / recipe.servings;
  if (
    recipe.ingredients.length === 0 ||
    recipe.ingredients.some((ingredient) =>
      !addQuantity(
        required,
        ingredient.normalizedName,
        ingredient.quantity,
        ingredient.unit,
        scale,
      )
    )
  ) {
    return false;
  }

  for (const [name, quantities] of required) {
    const availableQuantities = available.get(name);
    if (availableQuantities === undefined) {
      if (allowMissingIngredients) continue;
      return false;
    }
    for (const [dimension, requiredValue] of quantities) {
      const availableValue = availableQuantities.get(dimension) ?? 0;
      const tolerance = Number.EPSILON * Math.max(requiredValue, availableValue, 1) * 8;
      if (requiredValue - availableValue > tolerance && !allowMissingIngredients) return false;
    }
  }
  return true;
}

function validShoppingItem(
  item: NonNullable<RecipeSuggestionGatewayInput['shoppingItems']>[number],
): boolean {
  return (
    item.name.trim().length > 0 &&
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    item.unit.trim().length > 0
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = normalize(value);
    if (normalized.length === 0 || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

export function buildRecipeSuggestionContext(
  input: RecipeSuggestionGatewayInput,
): RecipeSuggestionContextResult | null {
  if (
    !Number.isInteger(input.servings) ||
    input.servings <= 0 ||
    Number.isNaN(input.today.getTime())
  ) {
    return null;
  }

  const forbiddenNames = new Set((input.forbiddenIngredients ?? []).map(normalize));
  const usableLots = input.inventory.lots.filter((lot) =>
    isEligibleForRecipeSuggestion(lot, input.today)
  );
  const safeLots = usableLots.filter(
    (lot) => !forbiddenNames.has(normalize(lot.normalizedName)),
  );
  if (safeLots.length === 0) return null;

  const selectedInventoryItemIds = new Set(input.selectedInventoryItemIds ?? []);
  const priorityFoods = safeLots
    .map((lot, index) => ({
      lot,
      index,
      priorityScore: lotPriority(lot, input.today) +
        (selectedInventoryItemIds.has(lot.lotId) ? 1_000 : 0),
    }))
    .sort(
      (left, right) =>
        right.priorityScore - left.priorityScore ||
        (effectiveExpiry(left.lot) ?? '9999-12-31').localeCompare(
          effectiveExpiry(right.lot) ?? '9999-12-31',
        ) ||
        left.index - right.index,
    );

  const shoppingItems = input.shoppingItems ?? [];
  const permittedShoppingItems = shoppingItems.filter(
    (item) => validShoppingItem(item) && !forbiddenNames.has(normalize(item.name)),
  );
  const plannedShoppingItems = input.shoppingDecision === 'yes'
    ? permittedShoppingItems.map((item) => ({
      shopping_item_id: item.shoppingItemId,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
    }))
    : [];
  const allowedNames = new Set([
    ...priorityFoods.map(({ lot }) => normalize(lot.normalizedName)),
    ...plannedShoppingItems.map((item) => normalize(item.name)),
  ]);
  const priorityScoreByName = new Map<string, number>();
  for (const { lot, priorityScore } of priorityFoods) {
    const name = normalize(lot.normalizedName);
    priorityScoreByName.set(
      name,
      Math.max(priorityScoreByName.get(name) ?? 0, priorityScore),
    );
  }

  const recipes = input.recipes
    .map((recipe, index) => {
      const source = recipe.source ?? 'catalog';
      const ingredientNames = recipe.ingredients.map((ingredient) =>
        ingredient.normalizedName.trim()
      );
      const priorityCoverage = ingredientNames.reduce(
        (score, name) => score + (priorityScoreByName.get(normalize(name)) ?? 0),
        0,
      );
      const validRecipe = recipe.title.trim().length > 0 &&
        recipe.steps.length > 0 &&
        recipe.steps.every((step) => step.trim().length > 0) &&
        !recipeHasAllergenConflict(recipe.allergens, input.allergies) &&
        !ingredientNames.some((name) => forbiddenNames.has(normalize(name))) &&
        (input.dietaryPattern === null ||
          recipe.dietaryTags.some(
            (tag) => normalize(tag) === normalize(input.dietaryPattern ?? ''),
          )) &&
        (input.maxMinutes === null ||
          (recipe.estimatedMinutes !== null && recipe.estimatedMinutes <= input.maxMinutes)) &&
        ingredientNames.every((name) => name.length > 0) &&
        priorityCoverage > 0;

      const canUseWithShopping = validRecipe && hasSufficientRecipeQuantities(
        recipe,
        input.servings,
        safeLots,
        permittedShoppingItems,
        true,
      );
      const fullyCoveredWithShopping = canUseWithShopping && hasSufficientRecipeQuantities(
        recipe,
        input.servings,
        safeLots,
        permittedShoppingItems,
      );
      return {
        recipe,
        index,
        source,
        ingredientNames,
        priorityCoverage,
        eligible: validRecipe &&
          (input.shoppingDecision === 'yes' ||
            ingredientNames.every((name) => allowedNames.has(normalize(name)))) &&
          hasSufficientRecipeQuantities(
            recipe,
            input.servings,
            safeLots,
            input.shoppingDecision === 'yes' ? permittedShoppingItems : [],
            input.shoppingDecision === 'yes',
          ),
        canUseWithShopping,
        fullyCoveredWithShopping,
      };
    });

  const hasShoppingOpportunity = recipes.some(
    (candidate) => candidate.canUseWithShopping && !candidate.fullyCoveredWithShopping,
  );
  const shoppingQuestion = input.shoppingDecision === null &&
      ((permittedShoppingItems.length > 0 &&
        (input.allergies.length === 0 ||
          recipes.some((candidate) => candidate.canUseWithShopping))) ||
        hasShoppingOpportunity)
    ? SHOPPING_QUESTION
    : null;

  const candidateRecipes = recipes
    .filter((candidate) =>
      input.shoppingDecision === 'yes' ? candidate.canUseWithShopping : candidate.eligible &&
        hasSufficientRecipeQuantities(
          candidate.recipe,
          input.servings,
          safeLots,
          input.shoppingDecision === 'no' ? [] : permittedShoppingItems,
        )
    )
    .sort(
      (left, right) =>
        right.priorityCoverage - left.priorityCoverage ||
        (left.source === right.source ? 0 : left.source === 'catalog' ? -1 : 1) ||
        left.index - right.index,
    )
    .slice(0, 3)
    .map(({ recipe, source, ingredientNames }) => ({
      id: recipe.recipeId,
      source,
      title: recipe.title,
      ingredient_names: ingredientNames,
    }));

  if (
    input.allergies.length > 0 &&
    candidateRecipes.length === 0 &&
    shoppingQuestion === null
  ) return null;

  const safeNames = new Set(safeLots.map((lot) => normalize(lot.normalizedName)));
  const unsafeNames = input.inventory.lots
    .filter((lot) =>
      !isEligibleForRecipeSuggestion(lot, input.today) &&
      !safeNames.has(normalize(lot.normalizedName))
    )
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
      forbidden_ingredients: uniqueStrings([
        ...input.allergies,
        ...(input.forbiddenIngredients ?? []),
        ...unsafeNames,
      ]),
    },
    priority_foods: priorityFoods.map(({ lot, priorityScore }) => ({
      inventory_item_id: lot.lotId,
      name: lot.normalizedName,
      available_quantity: lot.quantity,
      unit: lot.unit,
      priority_score: priorityScore,
    })),
    planned_shopping_items: plannedShoppingItems,
    candidate_recipes: candidateRecipes,
    shopping_question: shoppingQuestion,
    fallback_allowed: candidateRecipes.length === 0,
  };

  return { context, shoppingQuestion };
}
