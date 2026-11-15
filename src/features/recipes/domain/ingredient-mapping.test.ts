import {
  isCurrentIngredientMappingReview,
  normalizeIngredientMappingReview,
  UNKNOWN_INGREDIENT_MAPPING,
} from './ingredient-mapping';

const INGREDIENT_A = '11111111-1111-4111-8111-111111111111';
const INGREDIENT_B = '22222222-2222-4222-8222-222222222222';

function verifiedMapping(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    status: 'verified',
    ingredientIds: [INGREDIENT_A, INGREDIENT_B],
    complete: true,
    source: 'import_source',
    sourceId: 'https://example.test/recipe',
    sourceUrl: 'https://example.test/recipe',
    sourceVersion: 'recipe-source-revision-2',
    license: null,
    evidenceSnapshot: 'Vollständige Zutatenliste, vom Nutzer geprüft.',
    reviewedAt: '2026-11-08T12:00:00.000Z',
    reviewedBy: '33333333-3333-4333-8333-333333333333',
    ...overrides,
  };
}

describe('ingredient mapping review', () => {
  it('migrates a legacy import item without a mapping to unknown', () => {
    expect(normalizeIngredientMappingReview(undefined)).toEqual(UNKNOWN_INGREDIENT_MAPPING);
    expect(
      normalizeIngredientMappingReview({ status: 'verified', ingredientIds: [INGREDIENT_A] }),
    ).toEqual(UNKNOWN_INGREDIENT_MAPPING);
  });

  it('keeps a complete, reviewed one-to-many ingredient mapping', () => {
    const result = normalizeIngredientMappingReview(verifiedMapping());
    expect(result).toEqual(verifiedMapping());
    expect(
      isCurrentIngredientMappingReview(result, {
        source: 'import_source',
        sourceId: 'https://example.test/recipe',
        sourceUrl: 'https://example.test/recipe',
        sourceVersion: 'recipe-source-revision-2',
        license: null,
      }),
    ).toBe(true);
  });

  it.each([
    ['partial mapping', verifiedMapping({ ingredientIds: [], complete: false })],
    ['unreviewed mapping', verifiedMapping({ reviewedAt: null, reviewedBy: null })],
    ['no source snapshot', verifiedMapping({ evidenceSnapshot: '' })],
    ['duplicate ingredient id', verifiedMapping({ ingredientIds: [INGREDIENT_A, INGREDIENT_A] })],
    ['invalid ingredient id', verifiedMapping({ ingredientIds: ['not-a-uuid'] })],
  ])('fails closed for %s', (_label, value) => {
    expect(normalizeIngredientMappingReview(value)).toEqual(UNKNOWN_INGREDIENT_MAPPING);
  });

  it('invalidates a verified review when the source version changes', () => {
    const result = normalizeIngredientMappingReview(verifiedMapping());
    expect(
      isCurrentIngredientMappingReview(result, {
        source: 'import_source',
        sourceId: 'https://example.test/recipe',
        sourceUrl: 'https://example.test/recipe',
        sourceVersion: 'recipe-source-revision-3',
        license: null,
      }),
    ).toBe(false);
    expect(
      isCurrentIngredientMappingReview(result, {
        source: 'import_source',
        sourceId: 'https://example.test/changed',
        sourceUrl: 'https://example.test/recipe',
        sourceVersion: 'recipe-source-revision-2',
        license: null,
      }),
    ).toBe(false);
    expect(isCurrentIngredientMappingReview(result, null)).toBe(false);
  });
});
