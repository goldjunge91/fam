import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import {
  completeRecipeImportDraft,
  findSavedRecipeImportSource,
  loadRecipeImportDrafts,
  normalizeRecipeSourceUrl,
  saveRecipeImportSource,
} from './recipe-import-storage';

const mockStorage = { getString: jest.fn(), set: jest.fn() };
const storedValues = new Map<string, string>();

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(),
}));

describe('recipe import ingredient mapping storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storedValues.clear();
    mockStorage.getString.mockImplementation((key: string) => storedValues.get(key) ?? null);
    mockStorage.set.mockImplementation((key: string, value: string) => {
      storedValues.set(key, value);
    });
    jest.mocked(getEncryptedAccountStorage).mockResolvedValue(mockStorage as never);
  });

  it('migrates older stored drafts to unknown without losing the original ingredient text', async () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify([
        {
          id: 'draft-1',
          sourceType: 'url',
          sourceLabel: 'Rezeptseite',
          sourceUrl: 'https://example.test/recipe',
          originalText: null,
          mediaUris: [],
          method: 'ai',
          createdAt: '2026-11-08T10:00:00.000Z',
          draft: {
            kind: 'recipe_import_draft.v1',
            title: 'Brot',
            servings: 2,
            ingredients: [{ text: 'Mehl, Wasser und Hefe', confidence: 'high' }],
            steps: ['Mischen.'],
            notes: null,
            warnings: [],
          },
        },
      ]),
    );

    const [draft] = await loadRecipeImportDrafts('user-1');
    expect(draft?.draft.ingredients[0]).toEqual({
      text: 'Mehl, Wasser und Hefe',
      confidence: 'high',
      mapping: { version: 1, status: 'unknown', ingredientIds: [], complete: false },
    });
  });

  it('does not preserve a malformed stored review as verified', async () => {
    mockStorage.getString.mockReturnValue(
      JSON.stringify([
        {
          id: 'draft-2',
          sourceType: 'text',
          sourceLabel: 'Text',
          sourceUrl: null,
          originalText: 'Haferdrink',
          mediaUris: [],
          method: 'structured',
          createdAt: '2026-11-08T10:00:00.000Z',
          draft: {
            kind: 'recipe_import_draft.v1',
            title: 'Porridge',
            servings: null,
            ingredients: [
              {
                text: 'Haferdrink',
                confidence: 'high',
                mapping: {
                  version: 1,
                  status: 'verified',
                  ingredientIds: ['not-an-id'],
                  complete: true,
                },
              },
            ],
            steps: [],
            notes: null,
            warnings: [],
          },
        },
      ]),
    );

    const [draft] = await loadRecipeImportDrafts('user-1');
    expect(draft?.draft.ingredients[0]?.mapping).toEqual({
      version: 1,
      status: 'unknown',
      ingredientIds: [],
      complete: false,
    });
  });

  it('normalizes tracking parameters and fragments without dropping recipe options', () => {
    expect(
      normalizeRecipeSourceUrl(
        'https://Example.test/recipe?utm_source=feed&servings=4&fbclid=tracking#ingredients',
      ),
    ).toBe('https://example.test/recipe?servings=4');
  });

  it('finds a saved source by normalized URL and keeps its recipe reference', async () => {
    await saveRecipeImportSource('user-1', {
      recipeId: 'recipe-1',
      title: 'Linsensuppe',
      sourceUrl: 'https://example.test/recipe?utm_source=feed#ingredients',
    });

    await expect(
      findSavedRecipeImportSource('user-1', 'https://example.test/recipe?fbclid=another-click'),
    ).resolves.toEqual(
      expect.objectContaining({
        recipeId: 'recipe-1',
        title: 'Linsensuppe',
        sourceUrl: 'https://example.test/recipe?utm_source=feed#ingredients',
        normalizedSourceUrl: 'https://example.test/recipe',
      }),
    );
  });

  it('keeps the source trace when a reviewed import draft is completed', async () => {
    storedValues.set(
      'recipe-import.drafts.v1',
      JSON.stringify([
        {
          id: 'draft-1',
          sourceType: 'url',
          sourceLabel: 'https://example.test/recipe',
          sourceUrl: 'https://example.test/recipe?utm_campaign=dinner',
          originalText: null,
          mediaUris: [],
          method: 'structured',
          createdAt: '2026-11-08T10:00:00.000Z',
          draft: {
            kind: 'recipe_import_draft.v1',
            title: 'Linsensuppe',
            servings: 4,
            ingredients: [{ text: 'Linsen', confidence: 'high' }],
            steps: ['Kochen.'],
            notes: null,
            warnings: [],
          },
        },
      ]),
    );

    await completeRecipeImportDraft('user-1', 'draft-1', 'recipe-1');

    expect(storedValues.get('recipe-import.drafts.v1')).toBe('[]');
    await expect(
      findSavedRecipeImportSource('user-1', 'https://example.test/recipe'),
    ).resolves.toEqual(
      expect.objectContaining({
        recipeId: 'recipe-1',
        title: 'Linsensuppe',
        sourceUrl: 'https://example.test/recipe?utm_campaign=dinner',
        normalizedSourceUrl: 'https://example.test/recipe',
      }),
    );
  });
});
