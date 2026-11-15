export type IngredientMappingSource = 'recipe_text' | 'product_label' | 'import_source';

export type UnknownIngredientMapping = {
  version: 1;
  status: 'unknown';
  ingredientIds: [];
  complete: false;
};

export type VerifiedIngredientMapping = {
  version: 1;
  status: 'verified';
  ingredientIds: string[];
  complete: true;
  source: IngredientMappingSource;
  sourceId: string;
  sourceUrl: string | null;
  sourceVersion: string;
  license: string | null;
  evidenceSnapshot: string;
  reviewedAt: string;
  reviewedBy: string;
};

export type IngredientMappingReview = UnknownIngredientMapping | VerifiedIngredientMapping;

export type IngredientMappingSourceContext = {
  source: IngredientMappingSource;
  sourceId: string;
  sourceUrl: string | null;
  sourceVersion: string;
  license: string | null;
};

export const UNKNOWN_INGREDIENT_MAPPING: UnknownIngredientMapping = {
  version: 1,
  status: 'unknown',
  ingredientIds: [],
  complete: false,
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SOURCES = new Set<IngredientMappingSource>(['recipe_text', 'product_label', 'import_source']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/** Old, malformed or incomplete saved reviews safely migrate to unknown. */
export function normalizeIngredientMappingReview(value: unknown): IngredientMappingReview {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.status !== 'verified' ||
    value.complete !== true ||
    !Array.isArray(value.ingredientIds) ||
    value.ingredientIds.length === 0 ||
    !value.ingredientIds.every((id) => typeof id === 'string' && UUID_PATTERN.test(id)) ||
    new Set(value.ingredientIds).size !== value.ingredientIds.length ||
    typeof value.source !== 'string' ||
    !SOURCES.has(value.source as IngredientMappingSource) ||
    !nonEmptyString(value.sourceId) ||
    !nonEmptyString(value.sourceVersion) ||
    !nonEmptyString(value.evidenceSnapshot) ||
    !isIsoTimestamp(value.reviewedAt) ||
    !nonEmptyString(value.reviewedBy)
  ) {
    return { ...UNKNOWN_INGREDIENT_MAPPING };
  }

  return {
    version: 1,
    status: 'verified',
    ingredientIds: [...value.ingredientIds] as string[],
    complete: true,
    source: value.source as IngredientMappingSource,
    sourceId: value.sourceId.trim(),
    sourceUrl: nonEmptyString(value.sourceUrl) ? value.sourceUrl.trim() : null,
    sourceVersion: value.sourceVersion.trim(),
    license: nonEmptyString(value.license) ? value.license.trim() : null,
    evidenceSnapshot: value.evidenceSnapshot.trim(),
    reviewedAt: value.reviewedAt,
    reviewedBy: value.reviewedBy.trim(),
  };
}

export function isCurrentIngredientMappingReview(
  mapping: IngredientMappingReview,
  currentSource: IngredientMappingSourceContext | null,
): mapping is VerifiedIngredientMapping {
  return (
    mapping.status === 'verified' &&
    currentSource !== null &&
    mapping.source === currentSource.source &&
    mapping.sourceId === currentSource.sourceId &&
    mapping.sourceVersion === currentSource.sourceVersion
  );
}
