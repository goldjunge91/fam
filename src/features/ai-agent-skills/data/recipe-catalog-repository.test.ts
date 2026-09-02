import {
  mapRecipeRowsToCandidates,
  type RecipeCatalogRow,
} from '@/features/ai-agent-skills/data/recipe-catalog-repository';

const row = (overrides: Partial<RecipeCatalogRow> = {}): RecipeCatalogRow => ({
  id: 'recipe-1',
  householdId: 'household-1',
  title: 'Gemüsepfanne',
  cookTimeMinutes: 20,
  defaultServings: 2,
  dietaryTags: '["de:vegetarisch"]',
  ...overrides,
});

describe('mapRecipeRowsToCandidates', () => {
  it('maps local recipe metadata without inventing allergen data', () => {
    expect(mapRecipeRowsToCandidates([row()])[0]).toEqual({
      id: 'recipe-1',
      title: 'Gemüsepfanne',
      cookTimeMinutes: 20,
      defaultServings: 2,
      dietaryTags: ['de:vegetarisch'],
      allergens: null,
      ingredients: [],
    });
  });

  it('turns malformed dietary metadata into an empty, unknown tag list', () => {
    expect(mapRecipeRowsToCandidates([row({ dietaryTags: '{not-json}' })])[0]?.dietaryTags).toEqual(
      [],
    );
  });
});
