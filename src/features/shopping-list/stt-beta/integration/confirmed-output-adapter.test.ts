import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../../../test/node-sqlite-adapter';
import { saveConfirmedBetaOutput } from './confirmed-output-adapter';

describe('saveConfirmedBetaOutput', () => {
  let db: TestDatabase;
  let nextId: number;

  beforeEach(async () => {
    db = createTestDatabase();
    await applyLocalSchema(db);
    nextId = 1;
  });

  afterEach(() => db.close());

  function save(output: unknown) {
    return saveConfirmedBetaOutput({
      db,
      householdId: 'household-1',
      output,
      createItemId: () => `item-${nextId++}`,
    });
  }

  it('writes only confirmed items through the local merge and outbox path', async () => {
    const result = await save({
      betaSessionId: 'session-1',
      source: 'text',
      items: [
        {
          confirmation: 'confirmed',
          item: { name: 'Äpfel', quantity: 3, unit: null, brand: null },
          targetListId: 'rewe-list',
        },
        {
          confirmation: 'confirmed',
          item: { name: 'Milch', quantity: 2, unit: 'l', brand: null },
          targetListId: 'aldi-list',
        },
      ],
    });

    expect(result).toMatchObject({ savedItemCount: 2, mutationCount: 2 });
    expect(
      await db.getAllAsync<{
        name: string;
        quantity: number;
        store_id: string;
        category_id: string;
        category_source: string;
        category_classifier_version: string;
      }>(
        `select name, quantity, store_id, category_id, category_source,
                category_classifier_version
         from shopping_list_items order by sort_index`,
      ),
    ).toEqual([
      {
        name: 'Äpfel',
        quantity: 3,
        store_id: 'rewe-list',
        category_id: 'fresh_produce',
        category_source: 'name_fallback',
        category_classifier_version: 'placement-v2.0.0',
      },
      {
        name: 'Milch',
        quantity: 2,
        store_id: 'aldi-list',
        category_id: 'chilled_dairy_eggs',
        category_source: 'name_fallback',
        category_classifier_version: 'placement-v2.0.0',
      },
    ]);
    expect(await db.getAllAsync('select entity, op from outbox order by id')).toHaveLength(2);
  });

  it('uses the existing merge behavior for duplicate confirmed items', async () => {
    const output = {
      betaSessionId: 'session-1',
      source: 'text' as const,
      items: [
        {
          confirmation: 'confirmed' as const,
          item: { name: 'Brot', quantity: 1, unit: 'piece', brand: null },
          targetListId: 'rewe-list',
        },
        {
          confirmation: 'confirmed' as const,
          item: { name: 'Brot', quantity: 2, unit: 'piece', brand: null },
          targetListId: 'rewe-list',
        },
      ],
    };

    await save(output);

    expect(
      await db.getAllAsync<{ quantity: number }>('select quantity from shopping_list_items'),
    ).toEqual([{ quantity: 3 }]);
    expect(await db.getAllAsync('select entity, op from outbox order by id')).toEqual([
      { entity: 'shopping_list_items', op: 'insert' },
      { entity: 'shopping_list_items', op: 'update' },
    ]);
  });

  it('rejects an unconfirmed item before any local or outbox write', async () => {
    await expect(
      save({
        betaSessionId: 'session-1',
        source: 'text',
        items: [
          {
            confirmation: 'pending',
            item: { name: 'Brot', quantity: 1, unit: null, brand: null },
            targetListId: '',
          },
        ],
      }),
    ).rejects.toThrow('confirmed');

    expect(await db.getAllAsync('select * from shopping_list_items')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });

  it('rolls back earlier confirmed items when a later transaction step fails', async () => {
    let idCalls = 0;

    await expect(
      saveConfirmedBetaOutput({
        db,
        householdId: 'household-1',
        output: {
          betaSessionId: 'session-1',
          source: 'text',
          items: [
            {
              confirmation: 'confirmed',
              item: { name: 'Äpfel', quantity: 1, unit: null, brand: null },
              targetListId: 'rewe-list',
            },
            {
              confirmation: 'confirmed',
              item: { name: 'Brot', quantity: 1, unit: null, brand: null },
              targetListId: 'rewe-list',
            },
          ],
        },
        createItemId: () => {
          idCalls += 1;
          if (idCalls === 2) throw new Error('id allocation failed');
          return 'item-1';
        },
      }),
    ).rejects.toThrow('id allocation failed');

    expect(await db.getAllAsync('select * from shopping_list_items')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });
});
