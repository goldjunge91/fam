import { compareByExpiry, getExpiryInfo } from '@/features/inventory/expiry';
import type { RecipeSuggestionContext } from './recipe-suggestions';

export type RecipeSuggestionShoppingDecision = 'yes' | 'no';

export type RecipeSuggestionInventoryInput = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  priorityScore: number;
  allergens: readonly string[];
  /** The effective date after considering the item's opened state. */
  expiryDate?: Date | string | null;
  openedAt?: Date | string | null;
};

export type RecipeSuggestionShoppingItemInput = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type RecipeSuggestionCandidateInput = {
  id: string;
  source: 'catalog' | 'template';
  title: string;
  ingredientNames: readonly string[];
};

export type RecipeSuggestionContextInput = {
  servings: number;
  allergies: readonly string[];
  preferences: readonly string[];
  allowedStaples: readonly string[];
  forbiddenIngredients?: readonly string[];
  inventory: readonly RecipeSuggestionInventoryInput[];
  shoppingList: readonly RecipeSuggestionShoppingItemInput[];
  candidateRecipes: readonly RecipeSuggestionCandidateInput[];
  today: Date;
};

const SHOPPING_QUESTION = 'Willst du heute noch einkaufen?';

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE');
}

function hasMatchingAllergen(
  item: RecipeSuggestionInventoryInput,
  allergies: readonly string[],
): boolean {
  const allergySet = new Set(allergies.map(normalize));
  return item.allergens.some((allergen) => allergySet.has(normalize(allergen)));
}

function isUsableInventoryItem(
  item: RecipeSuggestionInventoryInput,
  allergies: readonly string[],
  today: Date,
): boolean {
  return (
    Number.isFinite(item.quantity) &&
    item.quantity > 0 &&
    getExpiryInfo(item.expiryDate, today).bucket !== 'expired' &&
    !hasMatchingAllergen(item, allergies)
  );
}

function openedTimestamp(item: RecipeSuggestionInventoryInput): number | null {
  if (item.openedAt === null || item.openedAt === undefined || item.openedAt === '') return null;
  const timestamp = new Date(item.openedAt).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function compareInventoryItems(
  left: RecipeSuggestionInventoryInput,
  right: RecipeSuggestionInventoryInput,
  today: Date,
  leftIndex: number,
  rightIndex: number,
): number {
  const byPriority = right.priorityScore - left.priorityScore;
  if (byPriority !== 0) return byPriority;

  const byExpiry = compareByExpiry(
    getExpiryInfo(left.expiryDate, today),
    getExpiryInfo(right.expiryDate, today),
  );
  if (byExpiry !== 0) return byExpiry;

  const leftOpenedAt = openedTimestamp(left);
  const rightOpenedAt = openedTimestamp(right);
  if (leftOpenedAt === null && rightOpenedAt !== null) return 1;
  if (leftOpenedAt !== null && rightOpenedAt === null) return -1;
  if (leftOpenedAt !== null && rightOpenedAt !== null && leftOpenedAt !== rightOpenedAt) {
    return leftOpenedAt - rightOpenedAt;
  }

  return leftIndex - rightIndex;
}

function shoppingState(
  shoppingList: readonly RecipeSuggestionShoppingItemInput[],
  shoppingDecision: RecipeSuggestionShoppingDecision | undefined,
): Pick<RecipeSuggestionContext, 'shopping_question' | 'planned_shopping_items'> {
  if (shoppingList.length === 0) {
    return { shopping_question: null, planned_shopping_items: [] };
  }

  if (shoppingDecision === undefined) {
    return { shopping_question: SHOPPING_QUESTION, planned_shopping_items: [] };
  }

  if (shoppingDecision === 'no') {
    return { shopping_question: null, planned_shopping_items: [] };
  }

  if (shoppingDecision === 'yes') {
    return {
      shopping_question: null,
      planned_shopping_items: shoppingList.map((item) => ({
        shopping_item_id: item.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      })),
    };
  }

  throw new Error(`Unsupported shopping decision: ${shoppingDecision}`);
}

function recipePriorityScore(
  recipe: RecipeSuggestionCandidateInput,
  priorityScores: ReadonlyMap<string, number>,
): number {
  return recipe.ingredientNames.reduce(
    (score, ingredientName) => score + (priorityScores.get(normalize(ingredientName)) ?? 0),
    0,
  );
}

function selectCandidateRecipes(
  recipes: readonly RecipeSuggestionCandidateInput[],
  priorityFoods: RecipeSuggestionContext['priority_foods'],
  allowedNames: ReadonlySet<string>,
): RecipeSuggestionContext['candidate_recipes'] {
  const priorityScores = new Map<string, number>();
  for (const food of priorityFoods) {
    const name = normalize(food.name);
    priorityScores.set(name, (priorityScores.get(name) ?? 0) + food.priority_score);
  }

  return recipes
    .map((recipe, index) => ({
      recipe,
      index,
      score: recipePriorityScore(recipe, priorityScores),
    }))
    .filter(
      ({ recipe, score }) =>
        score > 0 && recipe.ingredientNames.every((name) => allowedNames.has(normalize(name))),
    )
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, 3)
    .map(({ recipe }) => ({
      id: recipe.id,
      source: recipe.source,
      title: recipe.title,
      ingredient_names: [...recipe.ingredientNames],
    }));
}

export function buildRecipeSuggestionContext(
  input: RecipeSuggestionContextInput,
  shoppingDecision?: RecipeSuggestionShoppingDecision,
): RecipeSuggestionContext {
  if (!Number.isInteger(input.servings) || input.servings < 1) {
    throw new Error('servings must be a positive integer');
  }
  if (Number.isNaN(input.today.getTime())) {
    throw new Error('today must be a valid date');
  }

  const usableInventory = input.inventory.filter((item) =>
    isUsableInventoryItem(item, input.allergies, input.today),
  );
  const unsafeInventoryNames = input.inventory
    .filter((item) => !isUsableInventoryItem(item, input.allergies, input.today))
    .map((item) => item.name);
  const shopping = shoppingState(input.shoppingList, shoppingDecision);
  const allowedNames = new Set([
    ...usableInventory.map((item) => normalize(item.name)),
    ...shopping.planned_shopping_items.map((item) => normalize(item.name)),
    ...input.allowedStaples.map(normalize),
  ]);
  const priorityFoods = usableInventory
    .map((item, index) => ({ item, index }))
    .sort(({ item: left, index: leftIndex }, { item: right, index: rightIndex }) =>
      compareInventoryItems(left, right, input.today, leftIndex, rightIndex),
    )
    .map(({ item }) => ({
      inventory_item_id: item.id,
      name: item.name,
      available_quantity: item.quantity,
      unit: item.unit,
      priority_score: item.priorityScore,
    }));
  const candidateRecipes = selectCandidateRecipes(
    input.candidateRecipes,
    priorityFoods,
    allowedNames,
  );

  return {
    schema_version: 1,
    request: { type: 'recipe_suggestion', servings: input.servings },
    constraints: {
      allergies: [...input.allergies],
      preferences: [...input.preferences],
      allowed_staples: [...input.allowedStaples],
      forbidden_ingredients: [
        ...new Set([...(input.forbiddenIngredients ?? []), ...unsafeInventoryNames]),
      ],
    },
    priority_foods: priorityFoods,
    planned_shopping_items: shopping.planned_shopping_items,
    candidate_recipes: candidateRecipes,
    shopping_question: shopping.shopping_question,
    fallback_allowed: candidateRecipes.length === 0,
  };
}
