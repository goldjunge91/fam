import {
  createConsumeInventoryOperation,
  type InventoryIntentLot,
} from '@/features/inventory/inventory-lifecycle';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { toEpochMs } from '@/lib/sync/cursor';
import { commitInventoryOperation } from '@/lib/sync/inventory-quantity';
import {
  applyLocalMirrorWrite,
  applyRemoteRow,
  deleteMirrorRow,
  projectPendingInventoryOperations,
  upsertMirrorRow,
} from '@/lib/sync/mirror-write';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

describe('mirror-write', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runDrizzleMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('spiegelt eine vollständige Serverzeile mit Zeitstempeln und Dirty-Flag', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-1',
        household_id: 'hh-1',
        name: 'Kühlschrank',
        kind: 'fridge',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-15T10:30:00.123Z',
        deleted_at: null,
      },
      { dirty: 0 },
    );

    await expect(
      db.getFirstAsync<{
        id: string;
        updated_at: number;
        deleted_at: number | null;
        _dirty: number;
      }>('select id, updated_at, deleted_at, _dirty from storage_locations where id = ?', [
        'loc-1',
      ]),
    ).resolves.toEqual({
      id: 'loc-1',
      updated_at: toEpochMs('2026-01-15T10:30:00.123Z'),
      deleted_at: null,
      _dirty: 0,
    });
  });

  it('behält einen lokalen Dirty-Stand bei einer älteren Remote-Zeile', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-1',
        household_id: 'hh-1',
        name: 'Lokal',
        kind: 'fridge',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
        deleted_at: null,
      },
      { dirty: 1 },
    );

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        {
          id: 'loc-1',
          household_id: 'hh-1',
          name: 'Remote',
          kind: 'fridge',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-15T09:00:00Z',
          deleted_at: null,
        },
        toEpochMs('2026-01-15T11:00:00Z'),
      ),
    ).resolves.toBe('local-wins');

    await expect(
      db.getFirstAsync<{ name: string; _dirty: number }>(
        'select name, _dirty from storage_locations where id = ?',
        ['loc-1'],
      ),
    ).resolves.toEqual({ name: 'Lokal', _dirty: 1 });
  });

  it('übernimmt eine neuere Remote-Zeile und setzt Dirty zurück', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-1',
        household_id: 'hh-1',
        name: 'Lokal',
        kind: 'fridge',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
        deleted_at: null,
      },
      { dirty: 1 },
    );

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        {
          id: 'loc-1',
          household_id: 'hh-1',
          name: 'Remote',
          kind: 'fridge',
          sort_order: 0,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-15T12:00:00Z',
          deleted_at: null,
        },
        toEpochMs('2026-01-15T13:00:00Z'),
      ),
    ).resolves.toBe('written');

    await expect(
      db.getFirstAsync<{ name: string; _dirty: number }>(
        'select name, _dirty from storage_locations where id = ?',
        ['loc-1'],
      ),
    ).resolves.toEqual({ name: 'Remote', _dirty: 0 });
  });

  it('schreibt lokale CRUD-Operationen und hält transactions append-only', async () => {
    await applyLocalMirrorWrite(
      db,
      'fridge_items',
      'insert',
      {
        id: 'item-1',
        household_id: 'hh-1',
        location_id: 'loc-1',
        name: 'Milch',
        quantity: 1,
        unit: 'piece',
        package_size: null,
        package_size_unit: null,
        expiry_date: null,
        added_by: null,
        created_at: '2026-01-01T00:00:00Z',
        opened_at: null,
        vacuum_sealed: false,
        expiry_user_set: false,
      },
      1_000,
    );
    await applyLocalMirrorWrite(db, 'fridge_items', 'update', { id: 'item-1', quantity: 2 }, 2_000);

    await expect(
      db.getFirstAsync<{ quantity: number; deleted_at: number | null; _dirty: number }>(
        'select quantity, deleted_at, _dirty from fridge_items where id = ?',
        ['item-1'],
      ),
    ).resolves.toEqual({ quantity: 2, deleted_at: null, _dirty: 1 });

    const transaction = {
      id: 'tx-1',
      operation_id: 'op-1',
      operation_payload_hash: 'hash-1',
      household_id: 'hh-1',
      fridge_item_id: 'item-1',
      product_id: null,
      actor: null,
      type: 'out',
      quantity: 1,
      unit: 'piece',
      location_id: 'loc-1',
      reason: null,
      notes: null,
      created_at: '2026-01-01T00:00:00Z',
      reversal_of: null,
    };
    await applyLocalMirrorWrite(db, 'transactions', 'insert', transaction, 5_000);

    await expect(
      applyLocalMirrorWrite(
        db,
        'transactions',
        'update',
        { id: transaction.id, quantity: 2 },
        6_000,
      ),
    ).rejects.toThrow(/append-only/);
    await expect(
      applyLocalMirrorWrite(db, 'transactions', 'delete', { id: transaction.id }, 7_000),
    ).rejects.toThrow(/append-only/);
  });

  it('löscht Mirror-Zeilen hart nur für echte Remote-DELETEs', async () => {
    await applyLocalMirrorWrite(
      db,
      'storage_locations',
      'insert',
      { id: 'loc-1', household_id: 'hh-1', name: 'Kühlschrank', kind: 'fridge', sort_order: 0 },
      1_000,
    );
    await deleteMirrorRow(db, 'storage_locations', 'loc-1');
    await expect(
      db.getFirstAsync('select id from storage_locations where id = ?', ['loc-1']),
    ).resolves.toBeNull();
  });

  it('projiziert ausstehendes Inventory-Intent auf eine neue Serverbasis', async () => {
    const source: InventoryIntentLot = {
      id: '11111111-1111-4111-8111-111111111111',
      household_id: '22222222-2222-4222-8222-222222222222',
      product_id: null,
      name: 'Milch',
      quantity: 5,
      unit: 'piece',
      package_size: null,
      package_size_unit: null,
      location_id: '33333333-3333-4333-8333-333333333333',
      expiry_date: null,
      opened_at: '2026-09-01T10:00:00.000Z',
      vacuum_sealed: false,
      expiry_user_set: false,
      added_by: null,
    };
    await applyLocalMirrorWrite(
      db,
      'fridge_items',
      'insert',
      {
        ...source,
        created_at: '2026-09-01T10:00:00.000Z',
      },
      toEpochMs('2026-09-01T10:00:00.000Z'),
    );
    const operation = createConsumeInventoryOperation({
      operation_id: '44444444-4444-4444-8444-444444444444',
      out_transaction_id: '55555555-5555-4555-8555-555555555555',
      source,
      consumed_quantity: 1,
      opened_item_id: '66666666-6666-4666-8666-666666666666',
      opened_expiry_date: null,
      created_at: '2026-09-10T10:00:00.000Z',
    });
    await commitInventoryOperation(db, operation, 'actor-1');

    await db.withExclusiveTransactionAsync(async (txn) => {
      await applyRemoteRow(
        txn,
        'fridge_items',
        {
          ...source,
          quantity: 3,
          updated_at: '2026-09-10T11:00:00.000Z',
          deleted_at: null,
        },
        toEpochMs('2026-09-10T12:00:00.000Z'),
      );
      await projectPendingInventoryOperations(
        txn,
        ['22222222-2222-4222-8222-222222222222'],
        new Set(['11111111-1111-4111-8111-111111111111']),
      );
    });

    await expect(
      db.getFirstAsync<{ quantity: number; _dirty: number }>(
        'select quantity, _dirty from fridge_items where id = ?',
        ['11111111-1111-4111-8111-111111111111'],
      ),
    ).resolves.toEqual({ quantity: 2, _dirty: 1 });
  });
});
