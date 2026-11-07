import {
  canContinueChefConversation,
  chefHistoryHydrationSchema,
  createContinuationInput,
  cursorAfter,
  recipeHistoryTitle,
} from './chef-history';

const conversation = {
  id: 'conversation-1',
  last_activity_at: '2026-11-07T08:00:00.000Z',
} as const;

const recipeResult = {
  schema_version: 1 as const,
  meals: [
    {
      title: 'Tomatenpfanne',
      source: 'catalog' as const,
      recipe_id: 'recipe-1',
      servings: 2,
      used_items: [{ inventory_item_id: 'item-1', quantity: 1, unit: 'piece' }],
      additional_ingredients: [],
      steps: ['Garen.'],
      notes: [],
    },
  ],
};

function hydration() {
  return {
    schema_version: 1,
    replayed: false,
    conversation: {
      id: 'conversation-1',
      household_id: 'household-1',
      created_by: 'user-1',
      created_at: '2026-11-07T08:00:00.000Z',
      last_activity_at: '2026-11-07T08:00:00.000Z',
      continued_from_id: null,
      updated_at: '2026-11-07T08:00:00.000Z',
    },
    turn: {
      id: 'turn-1',
      conversation_id: 'conversation-1',
      household_id: 'household-1',
      created_by: 'user-1',
      client_request_id: 'request-1',
      request_fingerprint: 'a'.repeat(64),
      user_text: 'Was soll ich kochen?',
      request_payload: {
        schema_version: 1,
        user_text: 'Was soll ich kochen?',
        servings: 2,
        max_minutes: null,
        dietary_pattern: null,
        shopping_decision: null,
        selected_inventory_item_ids: ['item-1'],
      },
      response_payload: {
        schema_version: 1,
        skill: 'fam-cook-from-inventory',
        model: 'test-model',
        generated_at: '2026-11-07T08:00:00.000Z',
        priority_food_count: 1,
        shopping_question: null,
        result: recipeResult,
      },
      created_at: '2026-11-07T08:00:00.000Z',
    },
    recipe_history: [
      {
        id: 'recipe-history-1',
        conversation_id: 'conversation-1',
        turn_id: 'turn-1',
        household_id: 'household-1',
        title: 'Tomatenpfanne',
        recipe_payload: {
          schema_version: 1,
          response: recipeResult,
          used_item_snapshots: [
            {
              inventory_item_id: 'item-1',
              name: 'Tomate',
              quantity: 1,
              unit: 'piece',
            },
          ],
        },
        created_at: '2026-11-07T08:00:00.000Z',
      },
    ],
  };
}

describe('Chef-Koch-History continuation', () => {
  it('allows continuation through exactly 48 hours', () => {
    expect(canContinueChefConversation(conversation, new Date('2026-11-09T08:00:00.000Z'))).toBe(
      true,
    );
  });

  it('rejects conversations older than 48 hours, future timestamps, and invalid dates', () => {
    expect(canContinueChefConversation(conversation, new Date('2026-11-09T08:00:00.001Z'))).toBe(
      false,
    );
    expect(canContinueChefConversation(conversation, new Date('2026-11-07T07:59:59.999Z'))).toBe(
      false,
    );
    expect(canContinueChefConversation({ last_activity_at: 'invalid' })).toBe(false);
  });

  it('creates only the server-owned continuation reference', () => {
    expect(createContinuationInput(conversation, new Date('2026-11-07T12:00:00.000Z'))).toEqual({
      continuedFromConversationId: 'conversation-1',
    });
    expect(conversation).toEqual({
      id: 'conversation-1',
      last_activity_at: '2026-11-07T08:00:00.000Z',
    });
  });
});

describe('Chef-Koch-History contracts', () => {
  it('accepts one response-level recipe snapshot with all visible payloads', () => {
    expect(chefHistoryHydrationSchema.safeParse(hydration()).success).toBe(true);
  });

  it('rejects provider usage and more than one recipe snapshot per response', () => {
    expect(
      chefHistoryHydrationSchema.safeParse({ ...hydration(), usage: { tokens: 12 } }).success,
    ).toBe(false);
    const invalid = hydration();
    invalid.recipe_history.push({ ...invalid.recipe_history[0], id: 'recipe-history-2' });
    expect(chefHistoryHydrationSchema.safeParse(invalid).success).toBe(false);
  });

  it('creates a keyset cursor only for a full page', () => {
    const items = [
      { id: 'b', created_at: '2026-11-07T09:00:00.000Z' },
      { id: 'a', created_at: '2026-11-07T08:00:00.000Z' },
    ];
    expect(cursorAfter(items, (item) => item.created_at, 2)).toEqual({
      timestamp: '2026-11-07T08:00:00.000Z',
      id: 'a',
    });
    expect(cursorAfter(items, (item) => item.created_at, 3)).toBeNull();
  });

  it('summarizes all meals in one response-level title', () => {
    expect(recipeHistoryTitle(recipeResult)).toBe('Tomatenpfanne');
    expect(
      recipeHistoryTitle({
        ...recipeResult,
        meals: [
          ...recipeResult.meals,
          { ...recipeResult.meals[0], title: 'Suppe' },
          { ...recipeResult.meals[0], title: 'Salat' },
        ],
      }),
    ).toBe('Tomatenpfanne, Suppe und 1 weitere');
  });
});
