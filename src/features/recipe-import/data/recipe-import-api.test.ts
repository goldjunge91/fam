import { UNKNOWN_INGREDIENT_MAPPING } from '@/features/recipes/domain/ingredient-mapping';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { importRecipeSource } from './recipe-import-api';

const mockInvoke = jest.fn();
const mockFileConfig = new Map<
  string,
  { exists?: boolean; size?: number; base64?: string; base64Error?: Error }
>();
const mockDevModelSelection = jest.fn<
  { provider: 'openrouter' | 'groq'; model: string } | null,
  []
>();
const mockTrackAnalyticsEvent = jest.fn();

jest.mock('@/lib/analytics', () => ({
  trackAnalyticsEvent: (...args: unknown[]) => mockTrackAnalyticsEvent(...args),
}));
jest.mock('expo-file-system', () => ({
  File: jest.fn((uri: string) => {
    const config = mockFileConfig.get(uri) ?? { exists: true, size: 100, base64: 'encoded' };
    return {
      exists: config.exists ?? true,
      size: config.size,
      base64: jest.fn(async () => {
        if (config.base64Error) throw config.base64Error;
        return config.base64 ?? 'encoded';
      }),
    };
  }),
}));
jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));
jest.mock('@/features/ai-assistant/data/dev-ai-model-selection', () => ({
  getDevAiModelSelection: () => mockDevModelSelection(),
}));

describe('recipe import API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevModelSelection.mockReturnValue(null);
    mockFileConfig.clear();
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
      name: 'Milch',
      quantity: null,
      unit: null,
      confidence: 'high',
      mapping: UNKNOWN_INGREDIENT_MAPPING,
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(1, 'recipe_import.started', {
      source: 'text',
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(
      2,
      'recipe_import.completed',
      expect.objectContaining({ method: 'ai', duration_bucket: expect.any(String) }),
    );
  });

  it('passes structured ingredient quantities and units through the import draft', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Cremiger Gurkensalat',
          servings: 2,
          ingredients: [
            { name: 'Gurke', quantity: 150, unit: 'g', confidence: 'high' },
            { name: 'Cocktailtomaten', quantity: 120, unit: 'g', confidence: 'high' },
            { name: 'Mais', quantity: 140, unit: 'g', confidence: 'high' },
            { name: 'Creme mit 7 % Fett', quantity: 50, unit: 'ml', confidence: 'high' },
          ],
          steps: ['Dressing anrühren.', 'Alles vermengen.'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    const imported = await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'video',
      sourceUrl: 'https://www.instagram.com/reel/example/',
    });

    expect(
      imported.draft.ingredients.map(({ name, quantity, unit }) => ({
        name,
        quantity,
        unit,
      })),
    ).toEqual([
      { name: 'Gurke', quantity: 150, unit: 'g' },
      { name: 'Cocktailtomaten', quantity: 120, unit: 'g' },
      { name: 'Mais', quantity: 140, unit: 'g' },
      { name: 'Creme mit 7 % Fett', quantity: 50, unit: 'ml' },
    ]);
  });

  it('preserves finite, missing, and unknown ingredient values in their original order', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Freie Mengen',
          servings: 2,
          ingredients: [
            { name: 'Gurke', quantity: 150, unit: 'g', confidence: 'high' },
            { name: 'Mehl', quantity: -2, unit: 'cup', confidence: 'low' },
            { name: 'Wasser', quantity: 3, confidence: 'medium' },
            { name: 'Salz', unit: 'Prise', confidence: 'low' },
            { name: 'Pfeffer', quantity: null, unit: null, confidence: 'low' },
          ],
          steps: ['Alles vermengen.'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    const imported = await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'video',
      sourceUrl: 'https://www.instagram.com/reel/lossless/',
    });

    expect(
      imported.draft.ingredients.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    ).toEqual([
      { name: 'Gurke', quantity: 150, unit: 'g' },
      { name: 'Mehl', quantity: -2, unit: 'cup' },
      { name: 'Wasser', quantity: 3, unit: null },
      { name: 'Salz', quantity: null, unit: 'Prise' },
      { name: 'Pfeffer', quantity: null, unit: null },
    ]);
  });

  it('keeps signed and unknown units when normalizing legacy ingredient text', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'structured',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Legacy',
          servings: null,
          ingredients: [{ text: '-2 cup Mehl', confidence: 'low' }],
          steps: ['Backen.'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    const imported = await importRecipeSource({ householdId: 'household-1', sourceType: 'url' });

    expect(imported.draft.ingredients[0]).toMatchObject({
      name: 'Mehl',
      quantity: -2,
      unit: 'cup',
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
    ).rejects.toMatchObject({ code: 'draftInvalid' });
    expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(1, 'recipe_import.started', {
      source: 'text',
    });
    expect(mockTrackAnalyticsEvent).toHaveBeenNthCalledWith(2, 'recipe_import.failed', {
      stage: 'parse',
    });
  });

  it('omits optional input fields and accepts a structured recipe with nullable values', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'structured',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Brot',
          servings: null,
          ingredients: [
            { text: 'Mehl', confidence: 'medium' },
            { text: 'Wasser', confidence: 'low' },
          ],
          steps: ['Brot backen.'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    const result = await importRecipeSource({ householdId: 'household-1', sourceType: 'url' });

    expect(result.method).toBe('structured');
    expect(result.draft.servings).toBeNull();
    expect(result.draft.ingredients.map((ingredient) => ingredient.confidence)).toEqual([
      'medium',
      'low',
    ]);
    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        skill: 'fam-recipe-import',
        householdId: 'household-1',
        sourceType: 'url',
      },
    });
  });

  it('forwards the provider and model selected in developer tools', async () => {
    mockDevModelSelection.mockReturnValue({ provider: 'groq', model: 'qwen/qwen3.8-27b' });
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Linsen',
          servings: 2,
          ingredients: [{ text: 'Linsen', confidence: 'high' }],
          steps: ['Kochen'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });

    await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'text',
      sourceText: 'Linsen kochen.',
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: expect.objectContaining({ provider: 'groq', model: 'qwen/qwen3.8-27b' }),
    });
  });

  it('encodes media and bounds attachment size and filename', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Kuchen',
          servings: 2,
          ingredients: [{ text: 'Mehl', confidence: 'low' }],
          steps: ['Backen'],
          notes: '',
          warnings: ['Prüfen'],
        },
      },
      error: null,
    });

    await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'image',
      sourceText: 'Beschreibung',
      sourceUrl: 'https://example.test/recipe',
      media: [{ uri: 'image://one', name: 'a'.repeat(120), mimeType: 'image/jpeg' }],
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: expect.objectContaining({
        sourceText: 'Beschreibung',
        sourceUrl: 'https://example.test/recipe',
        attachments: [{ filename: 'a'.repeat(100), mimeType: 'image/jpeg', data: 'encoded' }],
      }),
    });
  });

  it.each([
    [{ exists: false, size: 100 }, 'fileUnavailable'],
    [{ exists: true, size: 0 }, 'fileTooLarge'],
    [{ exists: true, size: 5_500_001 }, 'fileTooLarge'],
  ])('rejects a missing or oversized attachment', async (fileConfig, errorCode) => {
    mockFileConfig.set('image://one', fileConfig);
    await expect(
      importRecipeSource({
        householdId: 'household-1',
        sourceType: 'image',
        media: [{ uri: 'image://one', name: 'photo.jpg', mimeType: 'image/jpeg' }],
      }),
    ).rejects.toMatchObject({ code: errorCode });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('accepts the exact media size boundary, truncates long filenames, and surfaces file read errors', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        source: 'ai',
        result: {
          kind: 'recipe_import_draft.v1',
          title: 'Kuchen',
          servings: 1,
          ingredients: [{ text: 'Mehl', confidence: 'high' }],
          steps: ['Backen'],
          notes: null,
          warnings: [],
        },
      },
      error: null,
    });
    mockFileConfig.set('pdf://boundary', { size: 5_500_000 });
    await importRecipeSource({
      householdId: 'household-1',
      sourceType: 'pdf',
      media: [
        {
          uri: 'pdf://boundary',
          name: `${'a'.repeat(101)}.pdf`,
          mimeType: 'application/pdf',
        },
      ],
    });
    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: expect.objectContaining({
        attachments: [
          {
            filename: 'a'.repeat(100),
            mimeType: 'application/pdf',
            data: 'encoded',
          },
        ],
      }),
    });

    mockInvoke.mockClear();
    mockFileConfig.set('pdf://broken', {
      size: 100,
      base64Error: new Error('file read failed'),
    });
    await expect(
      importRecipeSource({
        householdId: 'household-1',
        sourceType: 'pdf',
        media: [{ uri: 'pdf://broken', name: 'recipe.pdf', mimeType: 'application/pdf' }],
      }),
    ).rejects.toThrow('file read failed');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it.each([
    ['ai_subscription_required', 'aiSubscriptionRequired'],
    ['ai_credit_limit_exceeded', 'creditLimitExceeded'],
    ['food_rule_snapshot_incomplete', 'foodRuleSnapshotUnavailable'],
    ['food_rule_snapshot_unavailable', 'foodRuleSnapshotUnavailable'],
    ['food_rule_snapshot_changed', 'foodRuleSnapshotChanged'],
    ['unsafe_source_url', 'unsafeSourceUrl'],
    ['instagram_video_unavailable', 'instagramVideoUnavailable'],
    ['instagram_recipe_not_found', 'instagramRecipeNotFound'],
    ['groq_transcription_not_configured', 'transcriptionNotConfigured'],
    ['groq_transcription_rate_limited', 'transcriptionRateLimited'],
    ['groq_transcription_rejected', 'transcriptionRejected'],
    ['groq_transcription_unavailable', 'transcriptionUnavailable'],
    ['groq_transcription_invalid_response', 'transcriptionUnavailable'],
    ['provider_request_failed', 'providerUnavailable'],
    ['invalid_recipe_import_draft', 'draftCreationFailed'],
    ['source_unavailable', 'sourceUnavailable'],
    ['source_not_a_webpage', 'sourceNotWebpage'],
    ['source_too_large', 'sourceTooLarge'],
    ['source_has_no_recipe_text', 'sourceNoRecipeText'],
    ['model_unsupported_input', 'modelUnsupportedInput'],
  ])('maps import error %s', async (code, errorCode) => {
    mockInvoke.mockResolvedValue({ data: { error: code }, error: { message: 'gateway failed' } });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: errorCode });
  });

  it('reads response error codes, falls back to invoke errors and rejects malformed envelopes', async () => {
    const { FunctionsHttpError } =
      jest.requireActual<typeof import('@supabase/supabase-js')>('@supabase/supabase-js');
    const expoResponse = {
      clone: () => ({
        json: () => Promise.resolve({ error: 'instagram_video_unavailable' }),
      }),
    } as unknown as Response;
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(expoResponse),
    });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: 'instagramVideoUnavailable' });

    const unknownResponse = {
      clone: () => ({ json: () => Promise.resolve({ error: 'future_gateway_error' }) }),
    } as unknown as Response;
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(unknownResponse),
    });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: 'importFailed' });

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: '', context: new Response('bad json') },
    });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: 'importFailed' });

    mockInvoke.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: 'invalidResponse' });
    mockInvoke.mockResolvedValueOnce({ data: { source: 'unknown', result: {} }, error: null });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toMatchObject({ code: 'invalidResponse' });
  });

  it.each([
    {
      kind: 'wrong',
      title: 'A',
      servings: null,
      ingredients: [],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 5,
      servings: null,
      ingredients: [],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2.5,
      ingredients: [],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{}],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{ text: 2, confidence: 'low' }],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{ text: 'x', confidence: 'x' }],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [],
      steps: [4],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [],
      steps: [],
      notes: 4,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: '',
      servings: null,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: ['Cook'],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 0,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: ['Cook'],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: -1,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: ['Cook'],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [],
      steps: ['Cook'],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: [],
      notes: null,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: ['Cook'],
      notes: 4,
      warnings: [],
    },
    {
      kind: 'recipe_import_draft.v1',
      title: 'A',
      servings: 2,
      ingredients: [{ text: 'x', confidence: 'low' }],
      steps: ['Cook'],
      notes: null,
      warnings: [4],
    },
  ])('rejects invalid recipe draft shape', async (draft) => {
    mockInvoke.mockResolvedValue({ data: { source: 'ai', result: draft }, error: null });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'text' }),
    ).rejects.toMatchObject({ code: 'draftInvalid' });
  });
});
