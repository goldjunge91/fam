import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutations } from '@/lib/db/outbox';
import { createInventoryMoveMutation } from '@/lib/sync/inventory-move';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

describe('lokale Inventory-Move-Mutation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
  });

  afterEach(() => db.close());

  it('spiegelt item und beide Ledger-Zeilen zusammen mit genau einem Outbox-Eintrag', async () => {
    await db.runAsync(
      `insert into storage_locations
         (id, household_id, name, kind, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['loc-old', 'hh-1', 'Kühlschrank', 'fridge', 0, '2026-09-07T10:00:00Z', 1],
    );
    await db.runAsync(
      `insert into storage_locations
         (id, household_id, name, kind, sort_order, created_at, updated_at)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['loc-new', 'hh-1', 'Vorrat', 'pantry', 1, '2026-09-07T10:00:00Z', 1],
    );
    await db.runAsync(
      `insert into fridge_items
         (id, household_id, location_id, name, quantity, unit, created_at,
          opened_at, vacuum_sealed, expiry_user_set, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['item-1', 'hh-1', 'loc-old', 'Milch', 2, 'piece', '2026-09-07T10:00:00Z', null, 0, 0, 1],
    );

    const payload = {
      operation_id: 'operation-1',
      item_id: 'item-1',
      household_id: 'hh-1',
      expected_location_id: 'loc-old',
      new_location_id: 'loc-new',
      expected_quantity: 2,
      out_transaction_id: 'tx-out-1',
      in_transaction_id: 'tx-in-1',
      created_at: '2026-09-07T10:00:00Z',
    } as const;
    const transaction = (id: string, type: 'out' | 'in', locationId: string) => ({
      id,
      operation_id: payload.operation_id,
      household_id: payload.household_id,
      fridge_item_id: payload.item_id,
      product_id: null,
      actor: 'user-1',
      type,
      quantity: payload.expected_quantity,
      location_id: locationId,
      reason: null,
      previous_expiry_date: null,
      notes: null,
      undone: false,
      created_at: payload.created_at,
    });

    await enqueueMutations(db, [
      createInventoryMoveMutation({
        payload,
        outTransaction: transaction(payload.out_transaction_id, 'out', 'loc-old'),
        inTransaction: transaction(payload.in_transaction_id, 'in', 'loc-new'),
        nowMs: 2,
      }),
    ]);

    const item = await db.getFirstAsync<{ location_id: string; _dirty: number }>(
      'select location_id, _dirty from fridge_items where id = ?',
      [payload.item_id],
    );
    expect(item).toEqual({ location_id: 'loc-new', _dirty: 1 });

    const ledger = await db.getAllAsync<{
      id: string;
      operation_id: string;
      type: string;
      location_id: string;
      _dirty: number;
    }>(
      `select id, operation_id, type, location_id, _dirty
         from transactions
        where operation_id = ?
        order by type`,
      [payload.operation_id],
    );
    expect(ledger).toEqual([
      {
        id: payload.in_transaction_id,
        operation_id: payload.operation_id,
        type: 'in',
        location_id: 'loc-new',
        _dirty: 1,
      },
      {
        id: payload.out_transaction_id,
        operation_id: payload.operation_id,
        type: 'out',
        location_id: 'loc-old',
        _dirty: 1,
      },
    ]);

    const outbox = await db.getAllAsync<{ entity: string; entity_id: string; op: string }>(
      'select entity, entity_id, op from outbox',
    );
    expect(outbox).toEqual([{ entity: 'fridge_items', entity_id: 'item-1', op: 'move' }]);
  });

  it('rollt den lokalen Bestand zurueck, wenn eine der beiden Ledgerzeilen scheitert', async () => {
    await db.runAsync(
      `insert into fridge_items
         (id, household_id, location_id, name, quantity, unit, created_at,
          opened_at, vacuum_sealed, expiry_user_set, updated_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'item-rollback',
        'hh-1',
        'loc-old',
        'Milch',
        1,
        'piece',
        '2026-09-07T10:00:00Z',
        null,
        0,
        0,
        1,
      ],
    );

    const payload = {
      operation_id: 'operation-rollback',
      item_id: 'item-rollback',
      household_id: 'hh-1',
      expected_location_id: 'loc-old',
      new_location_id: 'loc-new',
      expected_quantity: 1,
      out_transaction_id: 'tx-rollback',
      in_transaction_id: 'tx-rollback',
      created_at: '2026-09-07T10:00:00Z',
    } as const;
    const transaction = {
      id: 'tx-rollback',
      operation_id: payload.operation_id,
      household_id: payload.household_id,
      fridge_item_id: payload.item_id,
      product_id: null,
      actor: 'user-1',
      type: 'out' as const,
      quantity: 1,
      location_id: 'loc-old',
      reason: null,
      previous_expiry_date: null,
      notes: null,
      undone: false,
      created_at: payload.created_at,
    };

    await expect(
      enqueueMutations(db, [
        createInventoryMoveMutation({
          payload,
          outTransaction: transaction,
          inTransaction: { ...transaction, type: 'in', location_id: 'loc-new' },
          nowMs: 2,
        }),
      ]),
    ).rejects.toThrow();

    const item = await db.getFirstAsync<{ location_id: string; _dirty: number }>(
      'select location_id, _dirty from fridge_items where id = ?',
      [payload.item_id],
    );
    expect(item).toEqual({ location_id: 'loc-old', _dirty: 0 });
    expect(await db.getAllAsync('select * from transactions')).toEqual([]);
    expect(await db.getAllAsync('select * from outbox')).toEqual([]);
  });
});
