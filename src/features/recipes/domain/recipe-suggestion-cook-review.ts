import type { RecipeSuggestionDisplayMeal, RecipeSuggestionReview } from './recipe-suggestion-review';

export type RecipeSuggestionCookReviewEntry = {
  inventoryItemId: string;
  quantity: number;
  unit: string;
  included: boolean;
};

export type RecipeSuggestionCookReview = {
  status: 'pending_confirmation' | 'confirmed';
  meal: RecipeSuggestionDisplayMeal;
  entries: RecipeSuggestionCookReviewEntry[];
};

export type RecipeSuggestionInventorySnapshot = {
  id: string;
  householdId: string;
  quantity: number;
  unit: string;
};

export type RecipeSuggestionConsumptionPlanItem = {
  id: string;
  household_id: string;
  delta: number;
  operation: 'consume';
};

export type RecipeSuggestionCookReviewIssueCode =
  | 'not_confirmed'
  | 'inventory_item_missing'
  | 'invalid_quantity'
  | 'incompatible_unit'
  | 'quantity_exceeds_available';

export type RecipeSuggestionCookReviewIssue = {
  code: RecipeSuggestionCookReviewIssueCode;
  inventoryItemId?: string;
};

export type RecipeSuggestionConsumptionPlanResult =
  | { ok: true; value: RecipeSuggestionConsumptionPlanItem[] }
  | { ok: false; issues: RecipeSuggestionCookReviewIssue[] };

type UnitDefinition = {
  dimension: 'mass' | 'volume' | 'count' | 'package' | 'portion';
  factor: number;
};

const UNIT_DEFINITIONS: ReadonlyMap<string, UnitDefinition> = new Map([
  ['g', { dimension: 'mass', factor: 1 }],
  ['kg', { dimension: 'mass', factor: 1_000 }],
  ['ml', { dimension: 'volume', factor: 1 }],
  ['l', { dimension: 'volume', factor: 1_000 }],
  ['piece', { dimension: 'count', factor: 1 }],
  ['package', { dimension: 'package', factor: 1 }],
  ['portion', { dimension: 'portion', factor: 1 }],
]);

function normalizeUnit(unit: string): string {
  return unit.trim().toLocaleLowerCase('de-DE');
}

function convertQuantity(quantity: number, fromUnit: string, toUnit: string): number | null {
  const from = UNIT_DEFINITIONS.get(normalizeUnit(fromUnit));
  const to = UNIT_DEFINITIONS.get(normalizeUnit(toUnit));
  if (from === undefined || to === undefined || from.dimension !== to.dimension) return null;

  const converted = (quantity * from.factor) / to.factor;
  return Number.isFinite(converted) ? converted : null;
}

/** Creates a review for one meal; opening a review never changes inventory. */
export function createRecipeSuggestionCookReview(
  review: RecipeSuggestionReview,
  mealIndex: number,
): RecipeSuggestionCookReview | null {
  const meal = review.meals[mealIndex];
  if (meal === undefined) return null;

  return {
    status: 'pending_confirmation',
    meal,
    entries: meal.usedItems.map((item) => ({
      inventoryItemId: item.inventory_item_id,
      quantity: item.quantity,
      unit: item.unit,
      included: true,
    })),
  };
}

/** Any edit invalidates a previous confirmation and requires a new final confirmation. */
export function updateRecipeSuggestionCookReviewEntry(
  review: RecipeSuggestionCookReview,
  inventoryItemId: string,
  patch: Partial<Pick<RecipeSuggestionCookReviewEntry, 'quantity' | 'included'>>,
): RecipeSuggestionCookReview {
  return {
    ...review,
    status: 'pending_confirmation',
    entries: review.entries.map((entry) =>
      entry.inventoryItemId === inventoryItemId ? { ...entry, ...patch } : entry,
    ),
  };
}

export function confirmRecipeSuggestionCookReview(
  review: RecipeSuggestionCookReview,
): RecipeSuggestionCookReview {
  return { ...review, status: 'confirmed' };
}

export function canApplyRecipeSuggestionCookReview(review: RecipeSuggestionCookReview): boolean {
  return review.status === 'confirmed';
}

/**
 * Converts the reviewed quantities to the authoritative inventory units and
 * rejects stale or unsafe plans before the outbox is touched.
 */
export function buildRecipeSuggestionConsumptionPlan(
  review: RecipeSuggestionCookReview,
  inventory: readonly RecipeSuggestionInventorySnapshot[],
): RecipeSuggestionConsumptionPlanResult {
  if (!canApplyRecipeSuggestionCookReview(review)) {
    return { ok: false, issues: [{ code: 'not_confirmed' }] };
  }

  const inventoryById = new Map(inventory.map((item) => [item.id, item]));
  const totals = new Map<
    string,
    { householdId: string; quantity: number; inventoryUnit: string }
  >();
  const issues: RecipeSuggestionCookReviewIssue[] = [];

  for (const entry of review.entries) {
    if (!entry.included) continue;

    const item = inventoryById.get(entry.inventoryItemId);
    if (item === undefined) {
      issues.push({ code: 'inventory_item_missing', inventoryItemId: entry.inventoryItemId });
      continue;
    }

    if (!Number.isFinite(item.quantity) || item.quantity < 0) {
      issues.push({ code: 'invalid_quantity', inventoryItemId: entry.inventoryItemId });
      continue;
    }

    if (!Number.isFinite(entry.quantity) || entry.quantity <= 0) {
      issues.push({ code: 'invalid_quantity', inventoryItemId: entry.inventoryItemId });
      continue;
    }

    const quantityInInventoryUnit = convertQuantity(entry.quantity, entry.unit, item.unit);
    if (quantityInInventoryUnit === null) {
      issues.push({ code: 'incompatible_unit', inventoryItemId: entry.inventoryItemId });
      continue;
    }

    const previous = totals.get(entry.inventoryItemId);
    totals.set(entry.inventoryItemId, {
      householdId: item.householdId,
      quantity: (previous?.quantity ?? 0) + quantityInInventoryUnit,
      inventoryUnit: item.unit,
    });
  }

  for (const [inventoryItemId, total] of totals) {
    const item = inventoryById.get(inventoryItemId);
    if (item === undefined) continue;

    const tolerance = Number.EPSILON * Math.max(item.quantity, total.quantity, 1) * 8;
    if (total.quantity - item.quantity > tolerance) {
      issues.push({ code: 'quantity_exceeds_available', inventoryItemId });
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  return {
    ok: true,
    value: [...totals].map(([id, total]) => ({
      id,
      household_id: total.householdId,
      delta: -total.quantity,
      operation: 'consume' as const,
    })),
  };
}
