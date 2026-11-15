import { getSupabase } from '@/lib/backend/supabase/remote-client';
import type { AssistantProposal } from '../types';
import {
  getAiCreditStatus,
  sendAssistantMessage,
  testAiModel,
  validateAssistantMealPlanProposal,
  validateAssistantRecipeProposal,
} from './assistant-api';

const mockInvoke = jest.fn();
const mockDevModelSelection = jest.fn<
  { provider: 'openrouter' | 'groq'; model: string } | null,
  []
>();

jest.mock('@/lib/backend/supabase/remote-client', () => ({ getSupabase: jest.fn() }));
jest.mock('./dev-ai-model-selection', () => ({
  getDevAiModelSelection: () => mockDevModelSelection(),
}));

const meal = {
  date: '2026-11-09',
  mealSlot: 'dinner',
  recipeId: 'recipe-1',
  recipeTitle: 'Linsensuppe',
  recipeUpdatedAt: 'recipe-v1',
  portions: 4,
  rationale: 'Passt zu eurem Vorrat.',
};

const mealPlanProposal = {
  kind: 'meal_plan_proposal.v1',
  foodRulesUpdatedAt: 'rules-v2',
  foodRuleCoverage: {
    status: 'clear',
    rulesUpdatedAt: 'rules-v2',
    recipeVersions: [{ recipeId: 'recipe-1', recipeUpdatedAt: 'recipe-v1', coverageVersion: 'v1' }],
  },
  meals: [meal],
  safetyNote: 'Geprüfte Regeln wurden berücksichtigt.',
};

const shoppingItemProposal = {
  kind: 'shopping_list_item_proposal.v1',
  name: 'Hafermilch',
  quantity: 2,
  unit: 'package',
  foodRuleStatus: 'unknown',
};

function reply(overrides: Record<string, unknown> = {}) {
  return {
    skill: 'fam-assistant',
    requestId: 'request-1',
    model: 'test-model',
    result: {
      kind: 'assistant_reply.v1',
      text: 'Hier ist ein Vorschlag.',
      suggestions: ['Mehr Gemüse'],
      proposals: [mealPlanProposal],
      toolTrace: ['search_recipes', 'get_inventory', 'propose_meal_plan'],
    },
    ...overrides,
  };
}

describe('assistant API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevModelSelection.mockReturnValue(null);
    mockDevModelSelection.mockReturnValue(null);
    jest.mocked(getSupabase).mockReturnValue({
      functions: { invoke: mockInvoke },
    } as never);
  });

  it('sends a bounded conversation with household context and parses evidence-backed proposals', async () => {
    mockInvoke.mockResolvedValue({
      data: { ...reply(), usage: { total_tokens: 124, cost: 0.002 } },
      error: null,
    });
    const history = Array.from({ length: 15 }, (_, index) => ({
      role: index % 2 === 0 ? ('user' as const) : ('assistant' as const),
      text: `Nachricht ${index}`,
    }));

    const result = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Was essen wir?',
      history,
      includeHouseholdContext: true,
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        skill: 'fam-assistant',
        householdId: 'household-1',
        message: 'Was essen wir?',
        history: history.slice(-12),
        includeHouseholdContext: true,
      },
    });
    expect(result.result.proposals).toEqual([mealPlanProposal]);
    expect(result.usage).toEqual({ total_tokens: 124, cost: 0.002 });
  });

  it('parses a bounded shopping item proposal and its tool trace', async () => {
    mockInvoke.mockResolvedValue({
      data: reply({
        result: {
          ...reply().result,
          proposals: [shoppingItemProposal],
          toolTrace: ['propose_shopping_list_item'],
        },
      }),
      error: null,
    });

    const result = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Setze Hafermilch auf die Liste.',
      history: [],
      includeHouseholdContext: true,
    });

    expect(result.result.proposals).toEqual([shoppingItemProposal]);
    expect(result.result.toolTrace).toEqual(['propose_shopping_list_item']);
  });

  it('sends the optional recipe page reference with the household request', async () => {
    mockInvoke.mockResolvedValue({ data: reply(), error: null });

    await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Wie kann ich das Rezept anpassen?',
      history: [],
      includeHouseholdContext: true,
      pageContext: { kind: 'recipe', recipeId: 'recipe-1' },
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: expect.objectContaining({
        skill: 'fam-assistant',
        householdId: 'household-1',
        pageContext: { kind: 'recipe', recipeId: 'recipe-1' },
      }),
    });
  });

  it('omits usage when the provider returned no token or cost data', async () => {
    mockInvoke.mockResolvedValue({
      data: reply({ result: { ...reply().result, proposals: [] } }),
      error: null,
    });
    const result = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Hallo',
      history: [],
      includeHouseholdContext: false,
    });
    expect(result.usage).toBeUndefined();
  });

  it('omits malformed non-finite usage metadata instead of exposing it to the UI', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...reply({ result: { ...reply().result, proposals: [] } }),
        usage: {
          total_tokens: Number.NaN,
          cost: Number.POSITIVE_INFINITY,
          prompt_tokens: '12',
        },
      },
      error: null,
    });

    const result = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Hallo',
      history: [],
      includeHouseholdContext: false,
    });

    expect(result.usage).toBeUndefined();
  });

  it.each([
    ['ai_subscription_required', 'Für den Assistant brauchst du das AI-Abo dieses Haushalts.'],
    ['ai_credit_limit_exceeded', 'Das monatliche AI-Credit-Limit ist erreicht.'],
    ['model_not_allowed', 'Dieses AI-Modell ist derzeit nicht verfügbar.'],
    ['provider_invalid_json', 'Die KI konnte gerade keine passende Antwort erstellen.'],
    [
      'invalid_assistant_reply',
      'Die KI hat gerade eine ungültige Antwort geliefert. Bitte versuche es erneut.',
    ],
    [
      'provider_not_configured',
      'Der ausgewählte KI-Anbieter ist serverseitig nicht konfiguriert. Bitte wähle ein anderes Modell.',
    ],
    ['provider_invalid_response', 'Die KI konnte gerade keine passende Antwort erstellen.'],
    ['provider_empty_response', 'Die KI konnte gerade keine passende Antwort erstellen.'],
    [
      'provider_unavailable',
      'Die KI ist gerade nicht erreichbar. Bitte versuche es später erneut.',
    ],
    [
      'provider_rate_limited',
      'Die KI ist gerade stark ausgelastet. Bitte versuche es später erneut.',
    ],
    [
      'provider_request_failed',
      'Die Anfrage konnte gerade nicht verarbeitet werden. Bitte versuche es später erneut.',
    ],
  ])('maps the gateway error %s to user-facing copy', async (code, expected) => {
    mockInvoke.mockResolvedValue({ data: { error: code }, error: { message: 'gateway failed' } });
    await expect(
      sendAssistantMessage({
        householdId: 'household-1',
        message: 'Hallo',
        history: [],
        includeHouseholdContext: true,
      }),
    ).rejects.toThrow(expected);
  });

  it('marks refunded provider response errors as safe to retry', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'provider_invalid_response' },
      error: { message: 'gateway failed' },
    });
    const error = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Was essen wir heute?',
      history: [],
      includeHouseholdContext: true,
    }).catch((value: unknown) => value);
    expect(error).toMatchObject({
      message: 'Die KI konnte gerade keine passende Antwort erstellen.',
      retryable: true,
    });
  });

  it('distinguishes retryable invalid replies from a missing provider configuration', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { error: 'invalid_assistant_reply' },
      error: { message: 'gateway failed' },
    });
    const invalidReply = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Hallo',
      history: [],
      includeHouseholdContext: true,
    }).catch((value: unknown) => value);
    expect(invalidReply).toMatchObject({
      message: 'Die KI hat gerade eine ungültige Antwort geliefert. Bitte versuche es erneut.',
      retryable: true,
    });

    mockInvoke.mockResolvedValueOnce({
      data: { error: 'provider_not_configured' },
      error: { message: 'gateway failed' },
    });
    const missingProvider = await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Hallo',
      history: [],
      includeHouseholdContext: true,
    }).catch((value: unknown) => value);
    expect(missingProvider).toMatchObject({
      message:
        'Der ausgewählte KI-Anbieter ist serverseitig nicht konfiguriert. Bitte wähle ein anderes Modell.',
      retryable: false,
    });
  });

  it('reads a gateway error from the response body and falls back to the invoke message', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: {
        message: 'request failed',
        context: new Response(JSON.stringify({ error: 'ai_credit_limit_exceeded' })),
      },
    });
    await expect(
      sendAssistantMessage({
        householdId: 'household-1',
        message: 'Hallo',
        history: [],
        includeHouseholdContext: true,
      }),
    ).rejects.toThrow('Das monatliche AI-Credit-Limit ist erreicht.');

    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'network down' } });
    await expect(
      sendAssistantMessage({
        householdId: 'household-1',
        message: 'Hallo',
        history: [],
        includeHouseholdContext: true,
      }),
    ).rejects.toThrow(
      'Der Assistant ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.',
    );

    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'bad response', context: new Response('not json') },
    });
    await expect(
      sendAssistantMessage({
        householdId: 'household-1',
        message: 'Hallo',
        history: [],
        includeHouseholdContext: true,
      }),
    ).rejects.toThrow(
      'Der Assistant ist gerade nicht erreichbar. Bitte prüfe deine Verbindung und versuche es erneut.',
    );
  });

  it.each([
    { skill: 'other' },
    { result: { ...reply().result, toolTrace: ['unknown_tool'] } },
    { result: { ...reply().result, suggestions: [5] } },
    { result: { ...reply().result, proposals: [{ kind: 'other' }] } },
    {
      result: {
        ...reply().result,
        proposals: [{ ...shoppingItemProposal, quantity: -1 }],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [{ ...shoppingItemProposal, quantity: Number.NaN }],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [{ ...shoppingItemProposal, quantity: Number.POSITIVE_INFINITY }],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [{ ...shoppingItemProposal, unit: 'box' }],
      },
    },
    {
      result: {
        ...reply().result,
        toolTrace: ['propose_shopping_list_item'],
        proposals: [{ ...shoppingItemProposal, foodRuleStatus: 'pass' }],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            ...mealPlanProposal,
            foodRuleCoverage: { ...mealPlanProposal.foodRuleCoverage, recipeVersions: [] },
          },
        ],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            ...mealPlanProposal,
            meals: [{ ...meal, date: '2026-02-30' }],
          },
        ],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            ...mealPlanProposal,
            meals: [{ ...meal, portions: -1 }],
          },
        ],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            ...mealPlanProposal,
            meals: [{ ...meal, portions: 13 }],
          },
        ],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            ...mealPlanProposal,
            meals: [{ ...meal, portions: 0 }],
          },
        ],
      },
    },
    {
      result: {
        ...reply().result,
        proposals: [
          {
            kind: 'ingredient_swap_proposal.v1',
            foodRulesUpdatedAt: null,
            foodRuleCoverage: {
              status: 'clear',
              rulesUpdatedAt: null,
              recipeVersions: [{ recipeId: 'other', recipeUpdatedAt: 'v1', coverageVersion: 'v1' }],
            },
            recipeId: 'recipe-1',
            recipeTitle: 'Suppe',
            ingredientName: 'Milch',
            replacement: 'Haferdrink',
            rationale: 'Passt',
            safetyNote: 'Zutat prüfen',
          },
        ],
      },
    },
  ])('rejects malformed assistant reply payloads', async (overrides) => {
    mockInvoke.mockResolvedValue({ data: reply(overrides), error: null });
    await expect(
      sendAssistantMessage({
        householdId: 'household-1',
        message: 'Hallo',
        history: [],
        includeHouseholdContext: true,
      }),
    ).rejects.toThrow('Die Antwort des Assistant hatte ein ungültiges Format.');
  });

  it('uses the locally selected provider and model only when the developer selection exists', async () => {
    mockDevModelSelection.mockReturnValue({ provider: 'groq', model: 'qwen/qwen3.8-27b' });
    mockInvoke.mockResolvedValue({ data: reply(), error: null });

    await sendAssistantMessage({
      householdId: 'household-1',
      message: 'Was essen wir?',
      history: [],
      includeHouseholdContext: true,
    });

    expect(mockInvoke).toHaveBeenCalledWith(
      'ai-gateway',
      expect.objectContaining({
        body: expect.objectContaining({
          provider: 'groq',
          model: 'qwen/qwen3.8-27b',
        }),
      }),
    );
  });

  it('tests a selected provider and model without adding household context to the test prompt', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        skill: 'fam-ai-model-test',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        text: 'Eine schnelle Linsenpfanne.',
        durationMs: 280,
        usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
      },
      error: null,
    });

    const result = await testAiModel({
      householdId: 'household-1',
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      prompt: 'Schlage ein schnelles Gericht mit Linsen vor.',
    });

    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: {
        skill: 'fam-ai-model-test',
        householdId: 'household-1',
        provider: 'groq',
        model: 'openai/gpt-oss-120b',
        prompt: 'Schlage ein schnelles Gericht mit Linsen vor.',
      },
    });
    expect(result).toEqual({
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      text: 'Eine schnelle Linsenpfanne.',
      durationMs: 280,
      usage: { prompt_tokens: 20, completion_tokens: 12, total_tokens: 32 },
    });
  });

  it.each([
    ['provider_not_configured', 'Der Groq-API-Key fehlt in der lokalen Functions-Umgebung.'],
    [
      'model_testing_unavailable',
      'Modelltests sind nur mit der lokalen Supabase-Instanz verfügbar.',
    ],
    ['model_not_allowed', 'Die Modell-ID ist nicht in der lokalen Allowlist für Groq freigegeben.'],
    ['unknown_model_error', 'unknown_model_error'],
  ])('maps local model test error %s', async (code, expected) => {
    mockInvoke.mockResolvedValue({ data: { error: code }, error: { message: 'invoke failed' } });
    await expect(
      testAiModel({ householdId: 'household-1', provider: 'groq', model: 'model', prompt: 'test' }),
    ).rejects.toThrow(expected);
  });

  it('marks missing model-test provider configuration as non-retryable', async () => {
    mockInvoke.mockResolvedValue({
      data: { error: 'provider_not_configured' },
      error: { message: 'invoke failed' },
    });
    const error = await testAiModel({
      householdId: 'household-1',
      provider: 'groq',
      model: 'model',
      prompt: 'test',
    }).catch((value: unknown) => value);
    expect(error).toMatchObject({
      message: 'Der Groq-API-Key fehlt in der lokalen Functions-Umgebung.',
      retryable: false,
    });
  });

  it('validates ingredient swaps against fresh recipe evidence and reports invalid snapshots', async () => {
    const proposal = {
      kind: 'ingredient_swap_proposal.v1',
      foodRulesUpdatedAt: 'rules-v2',
      foodRuleCoverage: mealPlanProposal.foodRuleCoverage,
      recipeId: 'recipe-1',
      recipeTitle: 'Linsensuppe',
      ingredientItemId: 'ingredient-1',
      ingredientName: 'Butter',
      replacement: 'Olivenöl',
      rationale: 'Pflanzliche Alternative',
      safetyNote: 'Allergene wurden geprüft.',
    } as Extract<AssistantProposal, { kind: 'ingredient_swap_proposal.v1' }>;

    mockInvoke.mockResolvedValueOnce({
      data: { skill: 'fam-assistant-proposal-validation', valid: true },
      error: null,
    });
    await expect(
      validateAssistantRecipeProposal({ householdId: 'household-1', proposal }),
    ).resolves.toEqual({ valid: true });
    expect(mockInvoke).toHaveBeenLastCalledWith('ai-gateway', {
      body: {
        skill: 'fam-assistant-proposal-validation',
        householdId: 'household-1',
        foodRulesUpdatedAt: 'rules-v2',
        coverageRulesUpdatedAt: 'rules-v2',
        recipeIds: ['recipe-1'],
        recipeVersions: mealPlanProposal.foodRuleCoverage.recipeVersions,
      },
    });

    const staleSnapshot = {
      ...proposal,
      foodRuleCoverage: { ...proposal.foodRuleCoverage, recipeVersions: [] },
    } as unknown as typeof proposal;
    await expect(
      validateAssistantRecipeProposal({ householdId: 'household-1', proposal: staleSnapshot }),
    ).resolves.toEqual({ valid: false, reason: 'invalid_proposal_snapshot' });

    mockInvoke.mockResolvedValueOnce({
      data: { skill: 'wrong', valid: 'yes' },
      error: null,
    });
    await expect(
      validateAssistantRecipeProposal({ householdId: 'household-1', proposal }),
    ).rejects.toThrow('Der Vorschlag konnte nicht auf Aktualität geprüft werden.');
  });

  it('reads validated credit status and maps errors', async () => {
    const status = {
      creditsUsed: 3,
      creditsRemaining: 7,
      creditLimit: 10,
      warningReached: false,
      blocked: false,
    };
    mockInvoke.mockResolvedValueOnce({
      data: { skill: 'fam-ai-credit-status', status },
      error: null,
    });
    await expect(getAiCreditStatus('household-1')).resolves.toEqual(status);
    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      body: { skill: 'fam-ai-credit-status', householdId: 'household-1' },
    });

    mockInvoke.mockResolvedValueOnce({ data: { skill: 'wrong', status }, error: null });
    await expect(getAiCreditStatus('household-1')).rejects.toThrow(
      'Das AI-Guthaben ist nicht verfügbar.',
    );

    mockInvoke.mockResolvedValueOnce({
      data: { error: 'ai_subscription_required' },
      error: { message: 'failed' },
    });
    await expect(getAiCreditStatus('household-1')).rejects.toThrow('ai_subscription_required');
  });

  it('validates only current, unique meal-plan evidence and sends unique recipe ids', async () => {
    const proposal = {
      ...mealPlanProposal,
      meals: [meal, { ...meal, date: '2026-11-10' }],
    } as Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>;
    mockInvoke.mockResolvedValueOnce({
      data: { skill: 'fam-assistant-proposal-validation', valid: true },
      error: null,
    });
    await expect(
      validateAssistantMealPlanProposal({ householdId: 'household-1', proposal }),
    ).resolves.toEqual({ valid: true });
    expect(mockInvoke).toHaveBeenLastCalledWith('ai-gateway', {
      body: {
        skill: 'fam-assistant-proposal-validation',
        householdId: 'household-1',
        foodRulesUpdatedAt: 'rules-v2',
        coverageRulesUpdatedAt: 'rules-v2',
        recipeIds: ['recipe-1'],
        recipeVersions: mealPlanProposal.foodRuleCoverage.recipeVersions,
      },
    });

    mockInvoke.mockResolvedValueOnce({
      data: { skill: 'fam-assistant-proposal-validation', valid: false, reason: 'recipe_changed' },
      error: null,
    });
    await expect(
      validateAssistantMealPlanProposal({ householdId: 'household-1', proposal }),
    ).resolves.toEqual({ valid: false, reason: 'recipe_changed' });

    const oldProposal = {
      ...proposal,
      foodRuleCoverage: undefined,
    } as unknown as Extract<AssistantProposal, { kind: 'meal_plan_proposal.v1' }>;
    await expect(
      validateAssistantMealPlanProposal({ householdId: 'household-1', proposal: oldProposal }),
    ).resolves.toEqual({ valid: false, reason: 'invalid_proposal_snapshot' });
  });
});
