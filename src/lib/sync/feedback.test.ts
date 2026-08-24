import {
  type CategoryFeedbackInput,
  categoryFeedbackMutation,
} from '@/features/shopping-list/preferences/feedback';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation } from '@/lib/db/outbox';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { applyRemoteRow, upsertMirrorRow } from '@/lib/sync/mirror-write';
import { pullHousehold } from '@/lib/sync/pull';
import { pushOutbox } from '@/lib/sync/push';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

const feedbackInput: CategoryFeedbackInput = {
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

function pushOnlyClient(response: {
  data: Record<string, unknown>[] | null;
  error: { message: string; code?: string } | null;
  status: number;
}) {
  const insert = jest.fn().mockResolvedValue(response);
  const from = jest.fn().mockReturnValue({ insert });
  return {
    client: { from } as unknown as TypedSupabaseClient,
    from,
    insert,
  };
}

describe('shopping category feedback sync contract', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => db.close());

  it('pullt oder spiegelt push-only Feedback nie', async () => {
    const from = jest.fn(() => {
      throw new Error('Feedback darf nicht abgefragt werden');
    });

    await expect(
      pullHousehold({
        db,
        supabase: { from } as unknown as TypedSupabaseClient,
        householdIds: ['hh-1'],
        clockCeilingMs: 1_000,
        entities: ['shopping_category_feedback_events'],
      }),
    ).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();

    await expect(
      upsertMirrorRow(
        db,
        'shopping_category_feedback_events',
        { event_id: 'event-1' },
        { dirty: 0 },
      ),
    ).rejects.toThrow('push-only');

    await expect(
      applyRemoteRow(
        db,
        'shopping_category_feedback_events',
        { id: 'event-1', updated_at: '2026-08-24T05:00:00.000Z' },
        1_000,
      ),
    ).rejects.toThrow('push-only');
  });

  it.each([
    {
      name: 'normal success',
      response: { data: null, error: null, status: 201 },
    },
    {
      name: 'duplicate retry',
      response: {
        data: null,
        error: { message: 'duplicate key value violates unique constraint', code: '23505' },
        status: 409,
      },
    },
  ])(
    'pusht Feedback ohne Representation-Select und setzt dirty/synced_at bei $name',
    async ({ response }) => {
      await enqueueMutation(db, categoryFeedbackMutation(feedbackInput, 10));
      const { client, from, insert } = pushOnlyClient(response);

      const result = await pushOutbox({ db, supabase: client, now: () => 12_345 });

      expect(result.outcomes[0]).toMatchObject({
        kind: 'pushed',
        entity: 'shopping_category_feedback_events',
        entityId: 'event-1',
      });
      expect(from).toHaveBeenCalledWith('shopping_category_feedback_events');
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_id: 'event-1' }));

      const local = await db.getFirstAsync<{ _dirty: number; synced_at: number | null }>(
        'select _dirty, synced_at from shopping_category_feedback_events where event_id = ?',
        ['event-1'],
      );
      expect(local).toEqual({ _dirty: 0, synced_at: 12_345 });
      expect(await db.getAllAsync('select id from outbox')).toEqual([]);
    },
  );

  it.each(['update', 'delete', 'restore'] as const)(
    'weist die push-only Operation %s vor jedem Netzwerkzugriff ab',
    async (op) => {
      await enqueueMutation(db, {
        entity: 'shopping_category_feedback_events',
        entityId: 'event-1',
        op,
        payload: { event_id: 'event-1' },
        now: 10,
        applyLocally: async () => {},
      });
      const from = jest.fn(() => {
        throw new Error('ungueltige push-only Operation darf kein Netzwerk erreichen');
      });

      const result = await pushOutbox({
        db,
        supabase: { from } as unknown as TypedSupabaseClient,
        now: () => 12_345,
      });

      expect(result.outcomes[0]).toMatchObject({
        kind: 'failed-permanent',
        entity: 'shopping_category_feedback_events',
        entityId: 'event-1',
        error: expect.stringContaining('push-only'),
      });
      expect(from).not.toHaveBeenCalled();
    },
  );
});
