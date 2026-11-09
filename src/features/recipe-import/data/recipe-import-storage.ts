import { normalizeIngredientMappingReview } from '@/features/recipes/domain/ingredient-mapping';
import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type { RecipeImportDraft, RecipeImportDraftRecord, SavedRecipeImportSource } from '../types';

const DRAFTS_KEY = 'recipe-import.drafts.v1';
const SOURCES_KEY = 'recipe-import.sources.v1';
const MAX_DRAFTS = 30;
const MAX_SAVED_SOURCES = 200;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeRecipeImportDraft(value: unknown): RecipeImportDraft | null {
  if (
    !isRecord(value) ||
    value.kind !== 'recipe_import_draft.v1' ||
    typeof value.title !== 'string' ||
    value.title.trim().length === 0 ||
    !(
      value.servings === null ||
      (typeof value.servings === 'number' && Number.isInteger(value.servings) && value.servings > 0)
    ) ||
    !Array.isArray(value.ingredients) ||
    value.ingredients.length === 0 ||
    !value.ingredients.every(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.text === 'string' &&
        ['high', 'medium', 'low'].includes(String(ingredient.confidence)),
    ) ||
    !Array.isArray(value.steps) ||
    value.steps.length === 0 ||
    !value.steps.every((step) => typeof step === 'string') ||
    !(value.notes === null || typeof value.notes === 'string') ||
    !Array.isArray(value.warnings) ||
    !value.warnings.every((warning) => typeof warning === 'string')
  )
    return null;

  return {
    kind: 'recipe_import_draft.v1',
    title: value.title,
    servings: value.servings,
    ingredients: value.ingredients.map((ingredient) => ({
      text: ingredient.text,
      confidence: ingredient.confidence as 'high' | 'medium' | 'low',
      mapping: normalizeIngredientMappingReview(ingredient.mapping),
    })),
    steps: value.steps,
    notes: value.notes,
    warnings: value.warnings,
  };
}

function isRecipeImportDraftRecord(value: unknown): value is RecipeImportDraftRecord {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    ['url', 'text', 'image', 'pdf', 'video'].includes(String(value.sourceType)) &&
    typeof value.sourceLabel === 'string' &&
    (value.sourceUrl === null || typeof value.sourceUrl === 'string') &&
    (value.originalText === null || typeof value.originalText === 'string') &&
    Array.isArray(value.mediaUris) &&
    value.mediaUris.every((uri) => typeof uri === 'string') &&
    ['structured', 'ai'].includes(String(value.method)) &&
    normalizeRecipeImportDraft(value.draft) !== null &&
    isTimestamp(value.createdAt)
  );
}

function isSavedRecipeImportSource(value: unknown): value is SavedRecipeImportSource {
  return (
    isRecord(value) &&
    typeof value.recipeId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.sourceUrl === 'string' &&
    typeof value.normalizedSourceUrl === 'string' &&
    typeof value.savedAt === 'string'
  );
}

export function normalizeRecipeSourceUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return value.trim().toLowerCase();
  }
}

async function loadArray<T>(
  userId: string,
  key: string,
  validate: (value: unknown) => value is T,
): Promise<T[]> {
  const storage = await getEncryptedAccountStorage(userId);
  const stored = storage.getString(key);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(validate) : [];
  } catch {
    return [];
  }
}

async function saveArray<T>(userId: string, key: string, values: readonly T[]): Promise<void> {
  const storage = await getEncryptedAccountStorage(userId);
  storage.set(key, JSON.stringify(values));
}

export async function loadRecipeImportDrafts(userId: string): Promise<RecipeImportDraftRecord[]> {
  const drafts = await loadArray(userId, DRAFTS_KEY, isRecipeImportDraftRecord);
  return drafts
    .flatMap((draft) => {
      const normalizedDraft = normalizeRecipeImportDraft(draft.draft);
      return normalizedDraft ? [{ ...draft, draft: normalizedDraft }] : [];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_DRAFTS);
}

export async function saveRecipeImportDraft(
  userId: string,
  draft: RecipeImportDraftRecord,
): Promise<void> {
  const drafts = await loadRecipeImportDrafts(userId);
  const nextDrafts = [draft, ...drafts.filter((candidate) => candidate.id !== draft.id)]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_DRAFTS);
  await saveArray(userId, DRAFTS_KEY, nextDrafts);
}

export async function removeRecipeImportDraft(userId: string, draftId: string): Promise<void> {
  const drafts = await loadRecipeImportDrafts(userId);
  await saveArray(
    userId,
    DRAFTS_KEY,
    drafts.filter((draft) => draft.id !== draftId),
  );
}

export async function findSavedRecipeImportSource(
  userId: string,
  sourceUrl: string,
): Promise<SavedRecipeImportSource | null> {
  const sources = await loadArray(userId, SOURCES_KEY, isSavedRecipeImportSource);
  const normalized = normalizeRecipeSourceUrl(sourceUrl);
  return sources.find((source) => source.normalizedSourceUrl === normalized) ?? null;
}

export async function saveRecipeImportSource(
  userId: string,
  input: { recipeId: string; title: string; sourceUrl: string },
): Promise<void> {
  const sourceUrl = input.sourceUrl.trim();
  const normalizedSourceUrl = normalizeRecipeSourceUrl(sourceUrl);
  if (!sourceUrl || !normalizedSourceUrl) return;

  const sources = await loadArray(userId, SOURCES_KEY, isSavedRecipeImportSource);
  const nextSource: SavedRecipeImportSource = {
    ...input,
    sourceUrl,
    normalizedSourceUrl,
    savedAt: new Date().toISOString(),
  };
  const nextSources = [
    nextSource,
    ...sources.filter(
      (source) =>
        source.recipeId !== input.recipeId && source.normalizedSourceUrl !== normalizedSourceUrl,
    ),
  ].slice(0, MAX_SAVED_SOURCES);
  await saveArray(userId, SOURCES_KEY, nextSources);
}

export async function completeRecipeImportDraft(
  userId: string,
  draftId: string,
  recipeId: string,
): Promise<void> {
  const draft = (await loadRecipeImportDrafts(userId)).find(
    (candidate) => candidate.id === draftId,
  );
  if (!draft) return;
  if (draft.sourceUrl) {
    await saveRecipeImportSource(userId, {
      recipeId,
      title: draft.draft.title,
      sourceUrl: draft.sourceUrl,
    });
  }
  await removeRecipeImportDraft(userId, draftId);
}
