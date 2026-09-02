import {
  aiGatewayRequestSchema,
  aiGatewayResponseSchema,
  cookingInputSchema,
  cookingSuggestionSchema,
  inventoryCaptureInputSchema,
  inventoryCaptureProposalSchema,
  perishableInventoryContextSchema,
} from '@/features/ai-agent-skills/domain/contracts';

describe('AI skill contracts', () => {
  it('keeps cooking input tenant-scoped and validates hard constraints', () => {
    expect(
      cookingInputSchema.safeParse({
        householdId: 'household-1',
        servings: 4,
        maxMinutes: 30,
        dietaryPattern: 'vegetarian',
        allergies: ['Erdnüsse'],
      }).success,
    ).toBe(true);

    expect(
      cookingInputSchema.safeParse({
        householdId: 'household-1',
        servings: 0,
        maxMinutes: null,
        dietaryPattern: null,
        allergies: [],
      }).success,
    ).toBe(false);
  });

  it('requires German locale and gateway-owned capture scope', () => {
    expect(
      inventoryCaptureInputSchema.safeParse({
        text: 'etwas Spinat',
        locale: 'de-DE',
        householdId: 'household-1',
        now: '2026-09-01T10:00:00.000Z',
      }).success,
    ).toBe(true);

    expect(
      inventoryCaptureInputSchema.safeParse({
        text: 'etwas Spinat',
        locale: 'en-US',
        householdId: 'household-1',
        now: '2026-09-01T10:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('accepts a cooking suggestion with inventory evidence', () => {
    const result = cookingSuggestionSchema.safeParse({
      kind: 'cooking_suggestion.v1',
      recipeId: 'recipe-1',
      title: 'Spinat-Feta-Pasta',
      usedLots: ['lot-spinach', 'lot-feta'],
      missingIngredients: ['Pasta'],
      estimatedMinutes: 20,
      servings: 2,
      rationale: 'Verbraucht den Spinat zuerst.',
      constraintChecks: {
        allergies: 'pass',
        dietaryPattern: 'pass',
        time: 'pass',
      },
    });

    expect(result.success).toBe(true);
  });

  it('rejects a cooking suggestion with an allergy failure', () => {
    const result = cookingSuggestionSchema.safeParse({
      kind: 'cooking_suggestion.v1',
      recipeId: 'recipe-1',
      title: 'Falscher Vorschlag',
      usedLots: ['lot-1'],
      missingIngredients: [],
      estimatedMinutes: 20,
      servings: 2,
      rationale: 'Nicht sicher.',
      constraintChecks: {
        allergies: 'fail',
        dietaryPattern: 'pass',
        time: 'pass',
      },
    });

    expect(result.success).toBe(false);
  });

  it('accepts unknown capture quantities without inventing a value', () => {
    const result = inventoryCaptureProposalSchema.safeParse({
      kind: 'inventory_capture_proposal.v1',
      items: [
        {
          rawText: 'etwas Spinat',
          normalizedName: 'Spinat',
          quantity: null,
          unit: null,
          perishability: 'perishable',
          storage: 'unknown',
          date: null,
          dateKind: null,
          confidence: 0.72,
          evidence: 'etwas Spinat',
          missingFields: ['quantity', 'unit', 'storage', 'date'],
        },
      ],
      questions: ['Wie viel Spinat ist es ungefähr?'],
      warnings: [],
    });

    expect(result.success).toBe(true);
  });

  it('rejects inventory context from a non-inventory source', () => {
    const result = perishableInventoryContextSchema.safeParse({
      source: 'model',
      fetchedAt: '2026-09-01T10:00:00.000Z',
      lots: [],
    });

    expect(result.success).toBe(false);
  });

  it('keeps the gateway envelope strict and skill-bound', () => {
    const request = aiGatewayRequestSchema.safeParse({
      skill: 'fam-cook-from-inventory',
      householdId: 'household-1',
      userText: 'Was kann ich heute kochen?',
      servings: null,
      maxMinutes: null,
      dietaryPattern: null,
      allergies: [],
    });
    expect(request.success).toBe(true);

    const response = aiGatewayResponseSchema.safeParse({
      requestId: 'request-1',
      skill: 'fam-cook-from-inventory',
      model: 'z-ai/glm-5.3-flash',
      generatedAt: '2026-09-01T10:00:00.000Z',
      result: {
        kind: 'cooking_suggestion.v1',
        recipeId: 'recipe-1',
        title: 'Tomatenpfanne',
        usedLots: ['lot-tomato'],
        missingIngredients: [],
        estimatedMinutes: 20,
        servings: 2,
        rationale: 'Verbraucht die Tomate zuerst.',
        constraintChecks: { allergies: 'pass', dietaryPattern: 'unknown', time: 'unknown' },
      },
    });
    expect(response.success).toBe(true);
  });
});
