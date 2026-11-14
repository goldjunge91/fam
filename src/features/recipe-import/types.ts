import type { IngredientMappingReview } from '@/features/recipes/domain/ingredient-mapping';

export type RecipeImportSourceType = 'url' | 'text' | 'image' | 'pdf' | 'video';
export type RecipeImportMethod = 'structured' | 'ai';
export type RecipeImportIngredientConfidence = 'high' | 'medium' | 'low';

export type RecipeImportIngredient = {
  name: string;
  quantity: number | null;
  unit: string | null;
  confidence: RecipeImportIngredientConfidence;
  mapping: IngredientMappingReview;
};

const IMPORT_UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  gramm: 'g',
  kg: 'kg',
  kilo: 'kg',
  kilogramm: 'kg',
  l: 'l',
  liter: 'l',
  litre: 'l',
  ml: 'ml',
  milliliter: 'ml',
  millilitre: 'ml',
  package: 'package',
  packung: 'package',
  pkg: 'package',
  piece: 'piece',
  stk: 'piece',
  'stk.': 'piece',
  stück: 'piece',
  stueck: 'piece',
  portion: 'portion',
  portionen: 'portion',
};

function parseLegacyIngredientText(text: string): {
  name: string;
  quantity: number | null;
  unit: string | null;
} {
  const trimmed = text.trim();
  const match = trimmed.match(
    /^(\d+(?:[.,]\d+)?)\s*(kg|g|ml|l|gramm|gram|kilo|kilogramm|liter|litre|milliliter|millilitre|package|packung|pkg|piece|stk\.?|stück|stueck|portionen?)\s+(.+)$/iu,
  );
  if (!match) return { name: trimmed, quantity: null, unit: null };

  const quantity = Number((match[1] ?? '').replace(',', '.'));
  const unit = IMPORT_UNIT_ALIASES[(match[2] ?? '').toLowerCase()] ?? null;
  const name = match[3]?.trim() ?? '';
  if (!Number.isFinite(quantity) || quantity <= 0 || !unit || !name) {
    return { name: trimmed, quantity: null, unit: null };
  }
  return { name, quantity, unit };
}

export function normalizeRecipeImportIngredient(
  value: unknown,
): Omit<RecipeImportIngredient, 'mapping'> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const isLegacy = typeof record.text === 'string' && typeof record.name !== 'string';
  if (
    (!isLegacy &&
      (typeof record.name !== 'string' ||
        !Object.hasOwn(record, 'quantity') ||
        !Object.hasOwn(record, 'unit'))) ||
    !['high', 'medium', 'low'].includes(String(record.confidence))
  )
    return null;

  const legacy = isLegacy ? parseLegacyIngredientText(record.text as string) : null;
  const name = legacy ? legacy.name : (record.name as string).trim();
  const quantity = legacy ? legacy.quantity : (record.quantity as number | null);
  const unit = legacy ? legacy.unit : (record.unit as string | null);
  if (
    !name ||
    !(
      quantity === null ||
      (typeof quantity === 'number' && Number.isFinite(quantity) && quantity > 0)
    ) ||
    !(unit === null || (typeof unit === 'string' && unit.trim().length > 0)) ||
    (quantity === null) !== (unit === null)
  )
    return null;

  return {
    name,
    quantity,
    unit: typeof unit === 'string' ? unit.trim() : null,
    confidence: record.confidence as RecipeImportIngredientConfidence,
  };
}

export type RecipeImportDraft = {
  kind: 'recipe_import_draft.v1';
  title: string;
  servings: number | null;
  ingredients: RecipeImportIngredient[];
  steps: string[];
  notes: string | null;
  warnings: string[];
};

export type RecipeImportDraftRecord = {
  id: string;
  sourceType: RecipeImportSourceType;
  sourceLabel: string;
  sourceUrl: string | null;
  originalText: string | null;
  mediaUris: string[];
  method: RecipeImportMethod;
  draft: RecipeImportDraft;
  createdAt: string;
};

export type SavedRecipeImportSource = {
  recipeId: string;
  title: string;
  sourceUrl: string;
  normalizedSourceUrl: string;
  savedAt: string;
};
