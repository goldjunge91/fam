import { developmentBypassHeaders, invokeAiGateway } from '@/features/ai-agent-skills/gateway';

const mockInvoke = jest.fn();

jest.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ functions: { invoke: mockInvoke } }),
}));

const cookingRequest = {
  skill: 'fam-cook-from-inventory' as const,
  householdId: 'household-1',
  userText: 'Was kann ich heute kochen?',
  servings: 2,
  maxMinutes: 30,
  dietaryPattern: null,
  allergies: [],
};

const cookingResponse = {
  requestId: 'request-1',
  skill: 'fam-cook-from-inventory' as const,
  model: 'z-ai/glm-5.3-flash',
  result: {
    kind: 'cooking_suggestion.v1' as const,
    recipeId: 'recipe-1',
    title: 'Tomatenpfanne',
    usedLots: ['lot-tomato'],
    missingIngredients: [],
    estimatedMinutes: 20,
    servings: 2,
    rationale: 'Verbraucht zuerst die vorhandene Tomate.',
    constraintChecks: {
      allergies: 'pass' as const,
      dietaryPattern: 'unknown' as const,
      time: 'pass' as const,
    },
  },
};

describe('invokeAiGateway', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it('sends the development bypass header only for development builds', () => {
    expect(developmentBypassHeaders(true)).toEqual({ 'x-fam-ai-dev-bypass': 'true' });
    expect(developmentBypassHeaders(false)).toBeUndefined();
  });

  it('validates the request before contacting the gateway', async () => {
    await expect(
      invokeAiGateway({
        ...cookingRequest,
        householdId: ' ',
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('invokes the authenticated edge function and validates its response', async () => {
    mockInvoke.mockResolvedValue({ data: cookingResponse, error: null });

    await expect(invokeAiGateway(cookingRequest)).resolves.toEqual(cookingResponse);
    expect(mockInvoke).toHaveBeenCalledWith('ai-gateway', {
      method: 'POST',
      body: cookingRequest,
      headers: { 'x-fam-ai-dev-bypass': 'true' },
    });
  });

  it('surfaces function errors with their HTTP status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Haushalt nicht gefunden', context: { status: 403 } },
    });

    await expect(invokeAiGateway(cookingRequest)).rejects.toMatchObject({
      status: 403,
      message: 'Der AI-Gateway-Aufruf ist fehlgeschlagen.',
    });
  });

  it('maps rate and credit failures to actionable messages without exposing server details', async () => {
    const context = {
      status: 429,
      clone: () => ({ json: async () => ({ error: 'ai_credit_limit_exceeded' }) }),
    };
    mockInvoke.mockResolvedValue({
      data: null,
      error: { context },
    });

    await expect(invokeAiGateway(cookingRequest)).rejects.toMatchObject({
      status: 429,
      code: 'ai_credit_limit_exceeded',
      message: 'Dein KI-Kontingent ist aufgebraucht.',
    });
  });

  it('rejects a malformed or cross-skill response', async () => {
    mockInvoke.mockResolvedValue({
      data: { ...cookingResponse, skill: 'fam-inventory-capture' },
      error: null,
    });

    await expect(invokeAiGateway(cookingRequest)).rejects.toMatchObject({ status: 502 });
  });

  it('rejects a result whose shape does not match the declared skill', async () => {
    mockInvoke.mockResolvedValue({
      data: {
        ...cookingResponse,
        result: {
          kind: 'inventory_capture_proposal.v1',
          items: [],
          questions: [],
          warnings: [],
        },
      },
      error: null,
    });

    await expect(invokeAiGateway(cookingRequest)).rejects.toMatchObject({ status: 502 });
  });
});
