import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { importRecipeSource } from './recipe-import-api';

const mockInvoke = jest.fn();

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));

describe('recipe import API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getSupabase).mockReturnValue({
      functions: { invoke: mockInvoke },
    } as never);
  });

  it('never treats model confidence or model-supplied mapping as a reviewed ingredient link', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Grießbrei',
          servings: 2,
          ingredients: [
            {
              text: 'Milch',
              confidence: 'high',
              mapping: {
                version: 1,
                status: 'verified',
                ingredientIds: ['00000000-0000-4000-8000-000000000001'],
                complete: true,
              },
            },
          ],
          steps: ['Milch erhitzen.'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    const imported = await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'text',
      sourceText: 'Milch erhitzen und Grieß einrühren.',
    });

    expect(imported.draft.ingredients[0]).toEqual({
      text: 'Milch',
      confidence: 'high',
      mapping: UNKNOWN_INGREDIENT_MAPPING,
    });
  });

  it('rejects malformed model output instead of saving a partial import draft', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Grießbrei',
          servings: 'zwei',
          ingredients: [],
          steps: [],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    await expect(
      importRecipeSource({
        householdId: 'household-1',
        sourceType: 'text',
        sourceText: 'Milch erhitzen und Grieß einrühren.',
      }),
    ).rejects.toThrow('Der Rezeptentwurf konnte nicht gelesen werden.');
  });
});
