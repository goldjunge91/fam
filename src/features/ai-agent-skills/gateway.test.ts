import { invokeAiGateway } from '@/features/ai-agent-skills/gateway';

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
    });
  });

  it('surfaces function errors with their HTTP status', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Haushalt nicht gefunden', context: { status: 403 } },
    });

    await expect(invokeAiGateway(cookingRequest)).rejects.toMatchObject({
      status: 403,
      message: 'Haushalt nicht gefunden',
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
