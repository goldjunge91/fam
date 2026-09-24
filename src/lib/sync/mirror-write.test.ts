import { toEpochMs } from '@/lib/sync/cursor';
import { applyRemoteRow, upsertMirrorRow } from '@/lib/sync/mirror-write';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

function storageLocationRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'location-1',
    household_id: 'household-1',
    name: 'Kühlschrank',
    kind: 'fridge',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T12:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('applyRemoteRow — bestätigte Remote-Aktualität', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await applyLocalSchema(db);
  });

  afterEach(() => {
    db.close();
  });

  it('verwirft ein älteres Remote-Update unverändert auf einer cleanen mutable Zeile', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      storageLocationRow({ name: 'Lokaler Stand', deleted_at: null }),
      { dirty: 0 },
    );

    const result = await applyRemoteRow(
      db,
      'storage_locations',
      storageLocationRow({
        name: 'Älterer Stand',
        updated_at: '2026-01-01T11:00:00.000Z',
        deleted_at: '2026-01-01T11:00:00.000Z',
      }),
      Date.now(),
    );

    expect(result).toBe('local-wins');
    expect(
      await db.getFirstAsync<{
        name: string;
        updated_at: number;
        deleted_at: number | null;
        dirty: number;
      }>(
        'select name, updated_at, deleted_at, _dirty as dirty from storage_locations where id = ?',
        ['location-1'],
      ),
    ).toEqual({
      name: 'Lokaler Stand',
      updated_at: toEpochMs('2026-01-01T12:00:00.000Z'),
      deleted_at: null,
      dirty: 0,
    });
  });

  it.each([
    ['gleiche', '2026-01-01T12:00:00.000Z'],
    ['neuere', '2026-01-01T13:00:00.000Z'],
  ])('übernimmt eine %s Remote-Version', async (_label, updatedAt) => {
    await upsertMirrorRow(db, 'storage_locations', storageLocationRow({ name: 'Lokaler Stand' }), {
      dirty: 0,
    });

    const remote = storageLocationRow({ name: 'Remote-Stand', updated_at: updatedAt });
    await expect(applyRemoteRow(db, 'storage_locations', remote, Date.now())).resolves.toBe(
      'written',
    );
    await expect(applyRemoteRow(db, 'storage_locations', remote, Date.now())).resolves.toBe(
      'written',
    );

    expect(
      await db.getFirstAsync<{ name: string; updated_at: number; dirty: number }>(
        'select name, updated_at, _dirty as dirty from storage_locations where id = ?',
        ['location-1'],
      ),
    ).toEqual({
      name: 'Remote-Stand',
      updated_at: toEpochMs(updatedAt),
      dirty: 0,
    });
    expect(
      await db.getFirstAsync('select id from outbox where entity_id = ?', ['location-1']),
    ).toBe(null);
  });

  it('entscheidet für Soft-Delete und Restore ebenfalls nur nach dem Remote-Alter', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      storageLocationRow({ deleted_at: '2026-01-01T12:00:00.000Z' }),
      { dirty: 0 },
    );

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        storageLocationRow({
          name: 'Alter Restore',
          updated_at: '2026-01-01T11:00:00.000Z',
          deleted_at: null,
        }),
        Date.now(),
      ),
    ).resolves.toBe('local-wins');

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        storageLocationRow({
          name: 'Neuer Restore',
          updated_at: '2026-01-01T13:00:00.000Z',
          deleted_at: null,
        }),
        Date.now(),
      ),
    ).resolves.toBe('written');

    expect(
      await db.getFirstAsync<{ name: string; deleted_at: number | null; dirty: number }>(
        'select name, deleted_at, _dirty as dirty from storage_locations where id = ?',
        ['location-1'],
      ),
    ).toEqual({ name: 'Neuer Restore', deleted_at: null, dirty: 0 });
  });

  it('lässt ungültige Remote-Zeitstempel als Fehler sichtbar', async () => {
    await upsertMirrorRow(db, 'storage_locations', storageLocationRow(), { dirty: 0 });

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        storageLocationRow({ updated_at: 'kein-gueltiger-cursor' }),
        Date.now(),
      ),
    ).rejects.toThrow('Kein gueltiger Postgres-Zeitstempel');

    expect(
      await db.getFirstAsync<{ name: string; updated_at: number; dirty: number }>(
        'select name, updated_at, _dirty as dirty from storage_locations where id = ?',
        ['location-1'],
      ),
    ).toEqual({
      name: 'Kühlschrank',
      updated_at: toEpochMs('2026-01-01T12:00:00.000Z'),
      dirty: 0,
    });
  });

  it('behält Dirty-Reconciliation und append-only-Duplikat-Upserts bei', async () => {
    await db.runAsync(
      `insert into storage_locations
       (id, household_id, name, kind, sort_order, created_at, updated_at, deleted_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'dirty-location',
        'household-1',
        'Lokaler Stand',
        'fridge',
        0,
        '2026-01-01T00:00:00.000Z',
        toEpochMs('2026-01-01T13:00:00.000Z'),
        null,
        1,
      ],
    );

    await expect(
      applyRemoteRow(
        db,
        'storage_locations',
        storageLocationRow({ id: 'dirty-location', name: 'Älter remote' }),
        Date.now(),
      ),
    ).resolves.toBe('local-wins');

    await upsertMirrorRow(
      db,
      'transactions',
      {
        id: 'transaction-1',
        operation_id: null,
        reversal_of: null,
        household_id: 'household-1',
        fridge_item_id: null,
        product_id: null,
        actor: 'user-1',
        type: 'in',
        quantity: 1,
        location_id: null,
        reason: null,
        previous_expiry_date: null,
        origin_item_id: null,
        origin_quantity: null,
        notes: null,
        undone: false,
        created_at: '2026-01-01T12:00:00.000Z',
        sync_sequence: 1,
      },
      { dirty: 0 },
    );

    await expect(
      applyRemoteRow(
        db,
        'transactions',
        {
          id: 'transaction-1',
          operation_id: null,
          reversal_of: null,
          household_id: 'household-1',
          fridge_item_id: null,
          product_id: null,
          actor: 'user-1',
          type: 'out',
          quantity: 1,
          location_id: null,
          reason: null,
          previous_expiry_date: null,
          origin_item_id: null,
          origin_quantity: null,
          notes: null,
          undone: false,
          created_at: '2026-01-01T11:00:00.000Z',
          sync_sequence: 2,
        },
        Date.now(),
      ),
    ).resolves.toBe('written');

    expect(
      await db.getFirstAsync<{ type: string }>('select type from transactions where id = ?', [
        'transaction-1',
      ]),
    ).toEqual({ type: 'out' });
  });
});
