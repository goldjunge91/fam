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
      text: 'Milch',
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
    [{ exists: false, size: 100 }, 'Die ausgewählte Datei ist nicht mehr verfügbar.'],
    [{ exists: true, size: 0 }, 'Die Datei ist zu groß. Wähle eine Datei bis 5,5 MB.'],
    [{ exists: true, size: 5_500_001 }, 'Die Datei ist zu groß. Wähle eine Datei bis 5,5 MB.'],
  ])('rejects a missing or oversized attachment', async (fileConfig, message) => {
    mockFileConfig.set('image://one', fileConfig);
    await expect(
      importRecipeSource({
        householdId: 'household-1',
        sourceType: 'image',
        media: [{ uri: 'image://one', name: 'photo.jpg', mimeType: 'image/jpeg' }],
      }),
    ).rejects.toThrow(message);
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
    ['ai_subscription_required', 'Für die KI-Auswertung brauchst du das AI-Abo dieses Haushalts.'],
    ['ai_credit_limit_exceeded', 'Das monatliche AI-Credit-Limit ist erreicht.'],
    ['unsafe_source_url', 'Diese Webadresse kann nicht sicher gelesen werden.'],
    [
      'instagram_video_unavailable',
      'Das Instagram-Video konnte nicht direkt geladen werden. Speichere es mit deinem Shortcut in Fotos und wähle es über „Video aus Fotos auswählen“ aus.',
    ],
    ['source_unavailable', 'Die Webseite ist nicht erreichbar. Füge den Rezepttext ein.'],
    ['source_not_a_webpage', 'Der Link führt nicht zu einer lesbaren Webseite.'],
    ['source_too_large', 'Die Webseite ist zu groß, um sie zu importieren.'],
    ['source_has_no_recipe_text', 'Auf der Webseite wurde kein lesbarer Rezeptinhalt gefunden.'],
    ['model_unsupported_input', 'Das ausgewählte Modell kann diese Quelle nicht verarbeiten.'],
  ])('maps import error %s', async (code, message) => {
    mockInvoke.mockResolvedValue({ data: { error: code }, error: { message: 'gateway failed' } });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toThrow(message);
  });

  it('reads response error codes, falls back to invoke errors and rejects malformed envelopes', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'invoke failed',
        context: new Response(JSON.stringify({ error: 'source_unavailable' })),
      },
    });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toThrow('Die Webseite ist nicht erreichbar. Füge den Rezepttext ein.');

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: '', context: new Response('bad json') },
    });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toThrow('Der Rezeptimport ist fehlgeschlagen.');

    mockInvoke.mockResolvedValueOnce({ data: [], error: null });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toThrow('Die Importantwort hatte ein ungültiges Format.');
    mockInvoke.mockResolvedValueOnce({ data: { source: 'unknown', result: {} }, error: null });
    await expect(
      importRecipeSource({ householdId: 'household-1', sourceType: 'url' }),
    ).rejects.toThrow('Die Importantwort hatte ein ungültiges Format.');
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
    ).rejects.toThrow('Der Rezeptentwurf konnte nicht gelesen werden.');
  });
});
