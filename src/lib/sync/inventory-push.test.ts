import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { enqueueMutation } from '@/lib/db/outbox';
import type { Entity, OutboxOp } from '@/lib/db/types';
import type { CoalescedEntry } from '@/lib/sync/coalesce';
import {
  applyInventoryMergeUndoPush,
  applyInventoryMovePush,
  applyInventoryQuantityPush,
  applyInventorySplitPush,
} from '@/lib/sync/inventory-push';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

async function createEntry(
  db: TestDatabase,
  input: { entity: Entity; entityId: string; op: OutboxOp; payload: Record<string, unknown> },
): Promise<CoalescedEntry> {
  await enqueueMutation(db, {
    ...input,
    now: 1,
    applyLocally: async () => {},
  });
  const row = await db.getFirstAsync<{ id: number }>(
    'select id from outbox order by id desc limit 1',
  );
  if (!row) throw new Error('Outbox-Eintrag wurde nicht angelegt.');

  return { ...input, sourceIds: [row.id], sequence: row.id };
}

describe('inventory push validation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await applyLocalSchema(db);
  });

  afterEach(() => db.close());

  it('rejects a move attached to another entity before calling Supabase', async () => {
    const entry = await createEntry(db, {
      entity: 'recipes',
      entityId: 'recipe-1',
      op: 'move',
      payload: {},
    });
    const rpc = jest.fn();

    const result = await applyInventoryMovePush(
      db,
      { rpc } as unknown as TypedSupabaseClient,
      entry,
      100,
      0,
    );

    expect(result).toMatchObject({ outcome: { kind: 'failed-permanent' }, stop: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(
      await db.getFirstAsync<{ last_error_kind: string }>('select last_error_kind from outbox'),
    ).toEqual({ last_error_kind: 'permanent' });
  });

  it('permanently rejects malformed inventory operations without network requests', async () => {
    const cases: { op: OutboxOp; payload: Record<string, unknown> }[] = [
      { op: 'move', payload: { expected_quantity: 1 } },
      { op: 'adjust_quantity', payload: { delta: 0 } },
      {
        op: 'correct_quantity',
        payload: { expected_quantity: 2, new_quantity: 2 },
      },
      { op: 'reverse_quantity', payload: { reversal_of: 'tx-1' } },
      {
        op: 'split_open',
        payload: {
          transaction_id: 'tx-1',
          source_item_id: 'item-1',
          opened_item_id: 'item-2',
          household_id: 'hh-1',
          expected_source_quantity: 1,
          open_quantity: 2,
          opened_at: '2026-09-07T10:00:00Z',
          new_expiry_date: null,
          expiry_user_set: false,
          created_at: '2026-09-07T10:00:00Z',
        },
      },
      { op: 'merge_undo_open', payload: { reversal_of: 'tx-1' } },
    ];
    const rpc = jest.fn();
    const client = { rpc } as unknown as TypedSupabaseClient;

    for (const { op, payload } of cases) {
      const entry = await createEntry(db, {
        entity: 'fridge_items',
        entityId: 'item-1',
        op,
        payload,
      });
      const result =
        op === 'move'
          ? await applyInventoryMovePush(db, client, entry, 100, 0)
          : op === 'adjust_quantity' || op === 'correct_quantity' || op === 'reverse_quantity'
            ? await applyInventoryQuantityPush(db, client, entry, 100, 0)
            : op === 'split_open'
              ? await applyInventorySplitPush(db, client, entry, 100, 0)
              : await applyInventoryMergeUndoPush(db, client, entry, 100, 0);

      expect(result).toMatchObject({ outcome: { kind: 'failed-permanent' }, stop: false });
    }

    expect(rpc).not.toHaveBeenCalled();
    expect(
      await db.getAllAsync<{ last_error_kind: string }>(
        'select last_error_kind from outbox order by id',
      ),
    ).toEqual(cases.map(() => ({ last_error_kind: 'permanent' })));
  });

  it('rejects quantity and move payloads whose item identity differs from the outbox entity', async () => {
    const quantity = await createEntry(db, {
      entity: 'fridge_items',
      entityId: 'item-outbox',
      op: 'adjust_quantity',
      payload: {
        operation_id: 'op-1',
        transaction_id: 'tx-1',
        item_id: 'item-payload',
        household_id: 'hh-1',
        delta: -1,
        created_at: '2026-09-07T10:00:00Z',
      },
    });
    const move = await createEntry(db, {
      entity: 'fridge_items',
      entityId: 'item-outbox',
      op: 'move',
      payload: {
        operation_id: 'move-1',
        item_id: 'item-payload',
        household_id: 'hh-1',
        expected_location_id: null,
        new_location_id: 'location-1',
        expected_quantity: 1,
        out_transaction_id: 'tx-out',
        in_transaction_id: 'tx-in',
        created_at: '2026-09-07T10:00:00Z',
      },
    });
    const rpc = jest.fn();
    const client = { rpc } as unknown as TypedSupabaseClient;

    const quantityResult = await applyInventoryQuantityPush(db, client, quantity, 100, 0);
    const moveResult = await applyInventoryMovePush(db, client, move, 100, 0);

    expect(quantityResult).toMatchObject({ outcome: { kind: 'failed-permanent' }, stop: false });
    expect(moveResult).toMatchObject({ outcome: { kind: 'failed-permanent' }, stop: false });
    expect(rpc).not.toHaveBeenCalled();
  });
});
