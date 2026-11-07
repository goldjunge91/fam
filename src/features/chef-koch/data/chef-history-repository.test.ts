jest.mock('@/lib/telemetry', () => ({ reportError: jest.fn() }));

import {
  getChefConversation,
  getChefRecipeHistory,
  hydrateChefHistory,
  listChefConversations,
  listChefConversationTurns,
  listChefRecipeHistory,
} from '@/features/chef-koch/data/chef-history-repository';
import type { ChefHistoryHydration } from '@/features/chef-koch/domain/chef-history';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../test/node-sqlite-adapter';

const { reportError } = jest.requireMock('@/lib/telemetry') as { reportError: jest.Mock };

function hydration(
  overrides: {
    householdId?: string;
    conversationId?: string;
    turnId?: string;
    recipeId?: string;
    clientRequestId?: string;
    createdAt?: string;
  } = {},
): ChefHistoryHydration {
  const householdId = overrides.householdId ?? 'household-1';
  const conversationId = overrides.conversationId ?? 'conversation-1';
  const turnId = overrides.turnId ?? 'turn-1';
  const createdAt = overrides.createdAt ?? '2026-11-07T08:00:00.000Z';
  const result = {
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

  return {
    schema_version: 1,
    replayed: false,
    conversation: {
      id: conversationId,
      household_id: householdId,
      created_by: 'user-1',
      created_at: createdAt,
      last_activity_at: createdAt,
      continued_from_id: null,
      updated_at: createdAt,
    },
    turn: {
      id: turnId,
      conversation_id: conversationId,
      household_id: householdId,
      created_by: 'user-1',
      client_request_id: overrides.clientRequestId ?? 'request-1',
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
        generated_at: createdAt,
        priority_food_count: 1,
        shopping_question: null,
        result,
      },
      created_at: createdAt,
    },
    recipe_history: [
      {
        id: overrides.recipeId ?? 'recipe-history-1',
        conversation_id: conversationId,
        turn_id: turnId,
        household_id: householdId,
        title: 'Tomatenpfanne',
        recipe_payload: {
          schema_version: 1,
          response: result,
          used_item_snapshots: [
            {
              inventory_item_id: 'item-1',
              name: 'Tomate',
              quantity: 1,
              unit: 'piece',
            },
          ],
        },
        created_at: createdAt,
      },
    ],
  };
}

describe('chef-history-repository', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = createTestDatabase();
    await applyLocalSchema(db);
  });

  afterEach(() => db.close());

  it('hydrates one exchange atomically as clean rows without an outbox entry', async () => {
    await hydrateChefHistory(db, hydration());

    expect(
      await db.getFirstAsync<{ dirty: number }>(
        'select _dirty as dirty from chef_conversations where id = ?',
        ['conversation-1'],
      ),
    ).toEqual({ dirty: 0 });
    expect(
      await db.getFirstAsync<{ dirty: number }>(
        'select _dirty as dirty from chef_conversation_turns where id = ?',
        ['turn-1'],
      ),
    ).toEqual({ dirty: 0 });
    expect(
      await db.getFirstAsync<{ dirty: number }>(
        'select _dirty as dirty from chef_recipe_history where id = ?',
        ['recipe-history-1'],
      ),
    ).toEqual({ dirty: 0 });
    expect(await db.getFirstAsync('select id from outbox')).toBeNull();
  });

  it('rejects a mismatched recipe snapshot without leaving any history rows', async () => {
    const invalid = hydration();
    const recipe = invalid.recipe_history[0];
    if (recipe === undefined) throw new Error('test fixture is missing its recipe history row');
    recipe.recipe_payload = {
      ...recipe.recipe_payload,
      response: {
        ...recipe.recipe_payload.response,
        meals: recipe.recipe_payload.response.meals.map((meal) => ({
          ...meal,
          title: 'Abweichende Tomatenpfanne',
        })),
      },
    };

    await expect(hydrateChefHistory(db, invalid)).rejects.toThrow();
    expect(
      await db.getFirstAsync<{ count: number }>('select count(*) as count from chef_conversations'),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'select count(*) as count from chef_conversation_turns',
      ),
    ).toEqual({ count: 0 });
    expect(
      await db.getFirstAsync<{ count: number }>(
        'select count(*) as count from chef_recipe_history',
      ),
    ).toEqual({ count: 0 });
  });

  it('reads conversations, turns, and response-level recipes only for the requested household', async () => {
    await hydrateChefHistory(db, hydration());
    await hydrateChefHistory(
      db,
      hydration({
        householdId: 'household-2',
        conversationId: 'conversation-2',
        turnId: 'turn-2',
        recipeId: 'recipe-history-2',
        clientRequestId: 'request-2',
      }),
    );

    const conversations = await listChefConversations(db, 'household-1');
    expect(conversations.items.map(({ id }) => id)).toEqual(['conversation-1']);
    expect(conversations.items[0]?.first_user_text).toBe('Was soll ich kochen?');

    const conversation = await getChefConversation(db, 'household-1', 'conversation-1');
    expect(conversation?.household_id).toBe('household-1');
    await expect(getChefConversation(db, 'household-2', 'conversation-1')).resolves.toBeNull();

    const turns = await listChefConversationTurns(db, 'household-1', 'conversation-1');
    expect(turns.items).toHaveLength(1);
    expect(turns.items[0]?.request_payload.shopping_decision).toBeNull();

    const recipes = await listChefRecipeHistory(db, 'household-1');
    expect(recipes.items.map(({ id }) => id)).toEqual(['recipe-history-1']);
    expect(recipes.items[0]?.recipe_payload.response.meals).toHaveLength(1);

    const recipe = await getChefRecipeHistory(db, 'household-1', 'recipe-history-1');
    expect(recipe?.recipe_payload.used_item_snapshots[0]?.name).toBe('Tomate');
  });

  it('uses stable timestamp and id cursors for independently paged lists', async () => {
    await hydrateChefHistory(
      db,
      hydration({
        conversationId: 'conversation-a',
        turnId: 'turn-a',
        recipeId: 'recipe-a',
        clientRequestId: 'request-a',
        createdAt: '2026-11-07T08:00:00.000Z',
      }),
    );
    await hydrateChefHistory(
      db,
      hydration({
        conversationId: 'conversation-b',
        turnId: 'turn-b',
        recipeId: 'recipe-b',
        clientRequestId: 'request-b',
        createdAt: '2026-11-07T09:00:00.000Z',
      }),
    );

    const first = await listChefConversations(db, 'household-1', null, 1);
    const second = await listChefConversations(db, 'household-1', first.nextCursor, 1);
    expect(first.items.map(({ id }) => id)).toEqual(['conversation-b']);
    expect(second.items.map(({ id }) => id)).toEqual(['conversation-a']);

    const firstRecipe = await listChefRecipeHistory(db, 'household-1', null, 1);
    const secondRecipe = await listChefRecipeHistory(db, 'household-1', firstRecipe.nextCursor, 1);
    expect(firstRecipe.items.map(({ id }) => id)).toEqual(['recipe-b']);
    expect(secondRecipe.items.map(({ id }) => id)).toEqual(['recipe-a']);
  });

  it('isolates a corrupt recipe row and keeps valid history visible', async () => {
    await hydrateChefHistory(db, hydration());
    await db.runAsync(
      `insert into chef_recipe_history
         (id, conversation_id, turn_id, household_id, title, recipe_payload,
          created_at, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        'recipe-corrupt',
        'conversation-corrupt',
        'turn-corrupt',
        'household-1',
        'Kaputt',
        '{',
        '2026-11-07T09:00:00.000Z',
        Date.now(),
      ],
    );

    const page = await listChefRecipeHistory(db, 'household-1');

    expect(page.items.map(({ id }) => id)).toEqual(['recipe-history-1']);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        entity: 'chef_recipe_history',
        entity_id: 'recipe-corrupt',
        error_code: 'chef_history_row_invalid',
      }),
    );
  });

  it('isolates a corrupt turn payload and keeps the rest of the conversation readable', async () => {
    await hydrateChefHistory(db, hydration());
    await db.runAsync(
      `insert into chef_conversation_turns
         (id, conversation_id, household_id, created_by, client_request_id,
          request_fingerprint, user_text, request_payload, response_payload,
          created_at, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        'turn-corrupt',
        'conversation-1',
        'household-1',
        'user-1',
        'request-corrupt',
        'b'.repeat(64),
        'Ungültiger Verlauf',
        '{',
        '{',
        '2026-11-07T09:00:00.000Z',
        Date.now(),
      ],
    );

    const page = await listChefConversationTurns(db, 'household-1', 'conversation-1');

    expect(page.items.map(({ id }) => id)).toEqual(['turn-1']);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        entity: 'chef_conversation_turns',
        entity_id: 'turn-corrupt',
        error_code: 'chef_history_row_invalid',
      }),
    );
  });
});
