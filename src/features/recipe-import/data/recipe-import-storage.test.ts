import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import { getEncryptedAccountStorage } from '@/lib/storage/local-account-storage';
import type { RecipeImportDraftRecord, SavedRecipeImportSource } from '../types';
import {
  completeRecipeImportDraft,
  findSavedRecipeImportSource,
  loadRecipeImportDrafts,
  normalizeRecipeSourceUrl,
  removeRecipeImportDraft,
  saveRecipeImportDraft,
  saveRecipeImportSource,
} from './recipe-import-storage';

const values = new Map<string, string>();
const mockStorage = {
  getString: jest.fn((key: string) => values.get(key)),
  set: jest.fn((key: string, value: string) => values.set(key, value)),
};

jest.mock('@/lib/storage/local-account-storage', () => ({
  getEncryptedAccountStorage: jest.fn(async () => mockStorage),
}));

const draft = {
  kind: 'recipe_import_draft.v1' as const,
  title: 'Linsensuppe',
  servings: 4,
  ingredients: [
    {
      name: 'Linsen',
      quantity: null,
      unit: null,
      confidence: 'high' as const,
      mapping: UNKNOWN_INGREDIENT_MAPPING,
    },
  ],
  steps: ['Kochen'],
  notes: null,
  warnings: [],
};

function record(overrides: Partial<RecipeImportDraftRecord> = {}): RecipeImportDraftRecord {
  return {
    id: 'draft-1',
    sourceType: 'url',
    sourceLabel: 'https://example.test/recipe',
    sourceUrl: 'https://example.test/recipe',
    originalText: null,
    mediaUris: [],
    method: 'structured',
    draft,
    createdAt: '2026-11-08T00:00:00.000Z',
    ...overrides,
  };
}

function source(overrides: Partial<SavedRecipeImportSource> = {}): SavedRecipeImportSource {
  return {
    recipeId: 'recipe-1',
    title: 'Suppe',
    sourceUrl: 'https://example.test/recipe',
    normalizedSourceUrl: 'https://example.test/recipe',
    savedAt: '2026-11-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('recipe import account storage', () => {
  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    jest.mocked(getEncryptedAccountStorage).mockResolvedValue(mockStorage as never);
  });

  it('normalizes URLs and removes tracking parameters while keeping useful query data', () => {
    expect(
      normalizeRecipeSourceUrl(
        ' HTTPS://Example.test/path?utm_source=news&keep=1&FBCLID=tracking#section ',
      ),
    ).toBe('https://example.test/path?keep=1');
    expect(normalizeRecipeSourceUrl('not a url/Path')).toBe('not a url/path');
    expect(normalizeRecipeSourceUrl('https://example.test/?gclid=x')).toBe('https://example.test/');
  });

  it('returns no drafts for absent, malformed, or non-array stored values', async () => {
    await expect(loadRecipeImportDrafts('user-1')).resolves.toEqual([]);
    values.set('recipe-import.drafts.v1', '{broken');
    await expect(loadRecipeImportDrafts('user-1')).resolves.toEqual([]);
    values.set('recipe-import.drafts.v1', JSON.stringify({ draft: record() }));
    await expect(loadRecipeImportDrafts('user-1')).resolves.toEqual([]);
  });

  it('filters invalid record and draft shapes from saved values', async () => {
    const valid = record();
    const invalidDrafts = [
      null,
      [],
      { ...draft, kind: 'legacy' },
      { ...draft, title: 2 },
      { ...draft, servings: 'four' },
      { ...draft, servings: 2.5 },
      { ...draft, title: '' },
      { ...draft, servings: 0 },
      { ...draft, servings: -1 },
      { ...draft, ingredients: [] },
      { ...draft, steps: [] },
      { ...draft, ingredients: 'lentils' },
      { ...draft, ingredients: [{ text: 'x', confidence: 'certain' }] },
      { ...draft, steps: ['Cook', 2] },
      { ...draft, notes: 42 },
      { ...draft, warnings: [null] },
    ];
    const invalidRecords: unknown[] = [
      null,
      { ...valid, id: 4 },
      { ...valid, sourceType: 'instagram' },
      { ...valid, sourceLabel: null },
      { ...valid, sourceUrl: undefined },
      { ...valid, originalText: 4 },
      { ...valid, mediaUris: ['image://ok', 2] },
      { ...valid, method: 'manual' },
      { ...valid, createdAt: 2 },
      { ...valid, createdAt: 'not-a-date' },
      ...invalidDrafts.map((invalid) => ({ ...valid, draft: invalid })),
    ];
    values.set('recipe-import.drafts.v1', JSON.stringify([valid, ...invalidRecords]));

    const loaded = await loadRecipeImportDrafts('user-1');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.draft.ingredients[0]?.mapping).toEqual(UNKNOWN_INGREDIENT_MAPPING);
  });

  it('normalizes legacy raw ingredient lines when loading stored drafts', async () => {
    values.set(
      'recipe-import.drafts.v1',
      JSON.stringify([
        {
          ...record(),
          draft: {
            ...draft,
            ingredients: [{ text: '150 g Gurke', confidence: 'high' }],
          },
        },
      ]),
    );

    await expect(loadRecipeImportDrafts('user-1')).resolves.toMatchObject([
      {
        draft: {
          ingredients: [{ name: 'Gurke', quantity: 150, unit: 'g', confidence: 'high' }],
        },
      },
    ]);
  });

  it('sorts and limits drafts, then replaces records with the same id', async () => {
    const drafts = Array.from({ length: 34 }, (_, index) =>
      record({
        id: `draft-${index}`,
        createdAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      }),
    );
    values.set('recipe-import.drafts.v1', JSON.stringify(drafts));
    const restored = await loadRecipeImportDrafts('user-1');
    expect(restored).toHaveLength(30);
    expect(restored[0]?.id).toBe('draft-33');
    expect(restored.at(-1)?.id).toBe('draft-4');

    await saveRecipeImportDraft('user-1', record({ draft: { ...draft, title: 'Aktualisiert' } }));
    const saved = JSON.parse(
      values.get('recipe-import.drafts.v1') ?? '[]',
    ) as RecipeImportDraftRecord[];
    expect(saved).toHaveLength(30);
    expect(saved.filter((entry) => entry.id === 'draft-1')).toHaveLength(1);
    expect(saved.find((entry) => entry.id === 'draft-1')?.draft.title).toBe('Aktualisiert');
  });

  it('removes a draft and finds saved sources by normalized URL', async () => {
    values.set('recipe-import.drafts.v1', JSON.stringify([record(), record({ id: 'draft-2' })]));
    await removeRecipeImportDraft('user-1', 'draft-1');
    await expect(loadRecipeImportDrafts('user-1')).resolves.toHaveLength(1);

    values.set('recipe-import.sources.v1', JSON.stringify([source()]));
    await expect(
      findSavedRecipeImportSource('user-1', 'https://example.test/recipe?utm_campaign=mail'),
    ).resolves.toEqual(source());
    await expect(findSavedRecipeImportSource('user-1', 'https://example.test/other')).resolves.toBe(
      null,
    );
  });

  it('filters invalid saved source entries and malformed source collections', async () => {
    const valid = source();
    values.set(
      'recipe-import.sources.v1',
      JSON.stringify([
        valid,
        null,
        { ...valid, recipeId: 4 },
        { ...valid, title: null },
        { ...valid, sourceUrl: null },
        { ...valid, normalizedSourceUrl: null },
        { ...valid, savedAt: null },
      ]),
    );
    await expect(findSavedRecipeImportSource('user-1', valid.sourceUrl)).resolves.toEqual(valid);
    values.set('recipe-import.sources.v1', '{broken');
    await expect(findSavedRecipeImportSource('user-1', valid.sourceUrl)).resolves.toBeNull();
    values.set('recipe-import.sources.v1', JSON.stringify({ not: 'an array' }));
    await expect(findSavedRecipeImportSource('user-1', valid.sourceUrl)).resolves.toBeNull();
  });

  it('upserts saved sources by recipe and URL, rejects blank URLs, and caps history', async () => {
    await saveRecipeImportSource('user-1', {
      recipeId: 'recipe-1',
      title: 'Old title',
      sourceUrl: 'https://example.test/recipe?utm_source=old',
    });
    await saveRecipeImportSource('user-1', {
      recipeId: 'recipe-2',
      title: 'Replacement',
      sourceUrl: 'https://example.test/recipe?utm_source=new',
    });
    let saved = JSON.parse(
      values.get('recipe-import.sources.v1') ?? '[]',
    ) as SavedRecipeImportSource[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.title).toBe('Replacement');
    expect(saved[0]?.sourceUrl).toBe('https://example.test/recipe?utm_source=new');

    await saveRecipeImportSource('user-1', {
      recipeId: 'recipe-2',
      title: 'New source for same recipe',
      sourceUrl: 'https://example.test/another',
    });
    await saveRecipeImportSource('user-1', {
      recipeId: 'recipe-3',
      title: 'Blank',
      sourceUrl: '  ',
    });
    saved = JSON.parse(values.get('recipe-import.sources.v1') ?? '[]') as SavedRecipeImportSource[];
    expect(saved).toHaveLength(1);
    expect(saved[0]?.normalizedSourceUrl).toBe('https://example.test/another');

    const many = Array.from({ length: 205 }, (_, index) =>
      source({
        recipeId: `saved-${index}`,
        sourceUrl: `https://example.test/${index}`,
        normalizedSourceUrl: `https://example.test/${index}`,
      }),
    );
    values.set('recipe-import.sources.v1', JSON.stringify(many));
    await saveRecipeImportSource('user-1', {
      recipeId: 'new',
      title: 'Newest',
      sourceUrl: 'https://example.test/new',
    });
    saved = JSON.parse(values.get('recipe-import.sources.v1') ?? '[]') as SavedRecipeImportSource[];
    expect(saved).toHaveLength(200);
    expect(saved[0]?.recipeId).toBe('new');
  });

  it('completes source-backed drafts and also removes drafts with no source URL', async () => {
    values.set('recipe-import.drafts.v1', JSON.stringify([record()]));
    await completeRecipeImportDraft('user-1', 'draft-1', 'recipe-1');
    await expect(loadRecipeImportDrafts('user-1')).resolves.toEqual([]);
    await expect(
      findSavedRecipeImportSource('user-1', 'https://example.test/recipe'),
    ).resolves.toMatchObject({ recipeId: 'recipe-1', title: 'Linsensuppe' });

    values.set(
      'recipe-import.drafts.v1',
      JSON.stringify([record({ id: 'text-draft', sourceUrl: null })]),
    );
    await completeRecipeImportDraft('user-1', 'text-draft', 'recipe-2');
    await expect(loadRecipeImportDrafts('user-1')).resolves.toEqual([]);
    await completeRecipeImportDraft('user-1', 'missing', 'recipe-3');
  });
});
