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
  const match = trimmed.match(/^([+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+))\s*([^\d\s]\S*)\s+(.+)$/u);
  if (!match) {
    if (/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)/u.test(trimmed)) {
      return { name: '', quantity: null, unit: null };
    }
    return { name: trimmed, quantity: null, unit: null };
  }

  const quantity = Number((match[1] ?? '').replace(',', '.'));
  const rawUnit = match[2]?.trim() ?? '';
  const unit = IMPORT_UNIT_ALIASES[rawUnit.toLowerCase()] ?? rawUnit;
  const name = match[3]?.trim() ?? '';
  if (!Number.isFinite(quantity) || !unit || !name) {
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
    (!isLegacy && typeof record.name !== 'string') ||
    !['high', 'medium', 'low'].includes(String(record.confidence))
  )
    return null;

  const legacy = isLegacy ? parseLegacyIngredientText(record.text as string) : null;
  const name = legacy ? legacy.name : (record.name as string).trim();
  const rawQuantity = Object.hasOwn(record, 'quantity') ? record.quantity : null;
  const rawUnit = Object.hasOwn(record, 'unit') ? record.unit : null;
  const quantity = legacy ? legacy.quantity : rawQuantity === null ? null : (rawQuantity as number);
  const unit = legacy ? legacy.unit : rawUnit === null ? null : (rawUnit as string);
  if (
    !name ||
    name.length > 300 ||
    !(quantity === null || (typeof quantity === 'number' && Number.isFinite(quantity))) ||
    !(
      unit === null ||
      (typeof unit === 'string' && unit.trim().length > 0 && unit.trim().length <= 20)
    )
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
