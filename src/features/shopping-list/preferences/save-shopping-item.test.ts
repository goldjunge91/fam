import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { createTestDatabase, type TestDatabase } from '../../../../test/node-sqlite-adapter';
import type { CategoryFeedbackInput } from './feedback';
import { saveShoppingItemAtomically } from './save-shopping-item';

jest.mock('./preference-identity.expo', () => ({
  preferenceId: jest.fn(
    async ({
      householdId,
      storeId,
      keyType,
      normalizedKeyValue,
    }: {
      householdId: string;
      storeId?: string | null;
      keyType: string;
      normalizedKeyValue: string;
    }) => `${householdId}:${storeId ?? 'household'}:${keyType}:${normalizedKeyValue}`,
  ),
}));

const feedback: CategoryFeedbackInput = {
  eventId: 'event-1',
  eventType: 'manual_reassign',
  inputMethod: 'edit_form',
  householdId: 'hh-1',
  actorUserId: 'user-1',
  shoppingListItemId: 'item-1',
  productId: null,
  productName: 'Hafermilch',
  storeId: 'store-1',
  preferenceScope: 'store',
  oldPlacementZone: 'ambient_milk_drinks',
  newPlacementZone: 'chilled_plant_based',
  predictedPlacementZone: 'ambient_milk_drinks',
  oldCategorySource: 'name_fallback',
  newCategorySource: 'store_preference',
  predictedProductFamily: 'plant_drink',
  predictedProductForm: 'ambient',
  classifierVersion: 'placement-v2.0.0',
  platform: 'ios',
  appVersion: '1.0.0',
  buildChannel: 'test',
  clientCreatedAt: '2026-08-24T05:00:00.000Z',
};

function itemMutation(shouldFail = false) {
  return {
    entity: 'shopping_list_items' as const,
    entityId: 'item-1',
    op: 'insert' as const,
    payload: { id: 'item-1', household_id: 'hh-1', name: 'Hafermilch' },
    now: 100,
    applyLocally: async (txn: SqlDatabase) => {
      await txn.runAsync(
        'insert into shopping_list_items (id, household_id, name, updated_at, _dirty) values (?, ?, ?, ?, 1)',
        ['item-1', 'hh-1', 'Hafermilch', 100],
      );
      if (shouldFail) throw new Error('atomic save rollback');
    },
  };
}

async function createSchema(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await db.execAsync(`
    create table outbox (
      id integer primary key autoincrement,
      entity text not null,
      entity_id text not null,
      op text not null,
      payload text not null,
      created_at integer not null,
      attempts integer not null default 0,
      last_error text,
      next_attempt_at integer not null default 0
    );
    create table shopping_list_items (
      id text primary key,
      household_id text not null,
      name text not null,
      updated_at integer not null,
      _dirty integer not null default 0
    );
    create table shopping_category_preferences (
      id text primary key,
      household_id text not null,
      store_id text,
      key_type text not null,
      normalized_key_value text not null,
      category_id text,
      created_by text,
      created_at text,
      updated_at integer not null,
      deleted_at integer,
      _dirty integer not null default 0
    );
    create table shopping_category_feedback_events (
      event_id text primary key,
      schema_version integer not null,
      taxonomy_version text not null,
      event_type text not null,
      input_method text not null,
      household_id text not null,
      actor_user_id text not null,
      shopping_list_item_id text not null,
      product_key_type text not null,
      product_key text not null,
      product_id text,
      barcode text,
      product_name text not null,
      store_id text,
      preference_scope text not null,
      old_placement_zone text not null,
      new_placement_zone text not null,
      predicted_placement_zone text not null,
      old_category_source text not null,
      new_category_source text not null,
      predicted_product_family text not null,
      predicted_product_form text not null,
      classifier_version text not null,
      platform text not null,
      app_version text not null,
      build_channel text not null,
      client_created_at text not null,
      _dirty integer not null default 1,
      synced_at integer
    );
  `);
  return db;
}

describe('saveShoppingItemAtomically', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createSchema();
  });

  afterEach(() => db.close());

  it('schreibt Item, Preference und Feedback in Reihenfolge und ohne Netzwerk', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);

    const result = await saveShoppingItemAtomically({
      db,
      itemMutation: itemMutation(),
      preference: {
        type: 'set',
        input: {
          householdId: 'hh-1',
          storeId: 'store-1',
          keyType: 'name',
          keyValue: 'Hafermilch',
          categoryId: 'chilled_plant_based',
          createdBy: 'user-1',
        },
      },
      feedback,
      nowMs: 100,
    });

    unsubscribe();
    expect(result).toMatchObject({ preferenceChanged: true, mutationCount: 3 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(await db.getAllAsync('select entity, op from outbox order by id')).toEqual([
      { entity: 'shopping_list_items', op: 'insert' },
      { entity: 'shopping_category_preferences', op: 'insert' },
      { entity: 'shopping_category_feedback_events', op: 'insert' },
    ]);
    expect(
      await db.getFirstAsync<{ category_id: string; store_id: string }>(
        'select category_id, store_id from shopping_category_preferences',
      ),
    ).toEqual({ category_id: 'chilled_plant_based', store_id: 'store-1' });
  });

  it('rollt Item, Preference und Outbox gemeinsam zurueck', async () => {
    const listener = jest.fn();
    const unsubscribe = onOutboxChanged(listener);

    await expect(
      saveShoppingItemAtomically({
        db,
        itemMutation: itemMutation(true),
        preference: {
          type: 'set',
          input: {
            householdId: 'hh-1',
            keyType: 'name',
            keyValue: 'Hafermilch',
            categoryId: 'chilled_plant_based',
            createdBy: 'user-1',
          },
        },
        feedback,
        nowMs: 100,
      }),
    ).rejects.toThrow('atomic save rollback');

    unsubscribe();
    expect(listener).not.toHaveBeenCalled();
    expect(await db.getAllAsync('select * from shopping_list_items')).toEqual([]);
    expect(await db.getAllAsync('select * from shopping_category_preferences')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });

  it('resetet nur den angeforderten Store-Scope', async () => {
    await db.runAsync(
      `insert into shopping_category_preferences
       (id, household_id, store_id, key_type, normalized_key_value, category_id, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['hh-1:store-1:name:hafermilch', 'hh-1', 'store-1', 'name', 'hafermilch', 'dairy', 1],
    );
    await db.runAsync(
      `insert into shopping_category_preferences
       (id, household_id, store_id, key_type, normalized_key_value, category_id, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['hh-1:household:name:hafermilch', 'hh-1', null, 'name', 'hafermilch', 'dairy', 1],
    );

    await saveShoppingItemAtomically({
      db,
      itemMutation: itemMutation(),
      preference: {
        type: 'reset',
        input: {
          householdId: 'hh-1',
          storeId: 'store-1',
          keyType: 'name',
          keyValue: 'Hafermilch',
        },
      },
      nowMs: 100,
    });

    expect(
      await db.getAllAsync<{ store_id: string | null; deleted_at: number | null }>(
        'select store_id, deleted_at from shopping_category_preferences order by store_id',
      ),
    ).toEqual([
      { store_id: null, deleted_at: null },
      { store_id: 'store-1', deleted_at: 100 },
    ]);
  });
});
