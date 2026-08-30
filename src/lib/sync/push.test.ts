import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { enqueueMutation } from '@/lib/db/outbox';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { pushOutbox } from '@/lib/sync/push';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Generischer Dispatch-Test fuer `EntityMeta.onForeignKeyViolation` (#192):
 * belegt, dass `push.ts` bei einem Fehler ausschliesslich den registrierten
 * Resolver befragt und dessen Antwort fuer den Retry uebernimmt — ohne
 * irgendein Wissen ueber Tabellennamen oder Fehlercodes der konkreten
 * Entitaet. Nutzt `fridge_items` als real registrierte Entitaet (der einzige
 * aktuell registrierte Resolver), pruefend also gleichzeitig, dass die
 * Registrierung in `entities.ts` tatsaechlich greift.
 */
function fridgeItemsUpdateResponses(
  responses: {
    data: Record<string, unknown>[] | null;
    error: { code?: string; message: string } | null;
  }[],
) {
  const select = jest.fn();
  for (const response of responses)
    select.mockResolvedValueOnce({ ...response, status: response.error ? 409 : 200 });
  const eq = jest.fn().mockReturnValue({ select });
  return jest.fn().mockReturnValue({ eq });
}

function storageLocationsInsertOk() {
  const select = jest.fn().mockResolvedValue({ data: null, error: null, status: 201 });
  return jest.fn().mockReturnValue({ select });
}

describe('pushOutbox — generischer onForeignKeyViolation-Dispatch', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await db.runAsync(
      'insert into fridge_items (id, household_id, location_id, name, quantity, unit, added_by, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ['item-1', 'hh-1', 'loc-1', 'Milch', 1, 'stk', 'user-1', '2026-01-01T00:00:00Z', 0],
    );
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
      ['loc-1', 'hh-1', 'Kühlschrank', 'fridge', 0, '2026-01-01T00:00:00Z', 0],
    );
    await enqueueMutation(db, {
      entity: 'fridge_items',
      entityId: 'item-1',
      op: 'update',
      payload: {
        id: 'item-1',
        location_id: 'loc-1',
        location_kind: 'fridge',
        location_name: 'Kühlschrank',
        quantity: 2,
      },
      now: 10,
      applyLocally: async () => {},
    });
  });

  afterEach(() => db.close());

  it('ruft den registrierten Resolver bei einem Fehler auf und uebernimmt den reparierten Payload fuer den Retry', async () => {
    const fkError = { code: '23503', message: 'violates foreign key constraint' };
    const update = fridgeItemsUpdateResponses([
      { data: null, error: fkError },
      {
        data: [
          {
            id: 'item-1',
            household_id: 'hh-1',
            location_id: 'loc-1',
            name: 'Milch',
            quantity: 2,
            unit: 'stk',
            added_by: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:01Z',
            deleted_at: null,
          },
        ],
        error: null,
      },
    ]);
    const insert = storageLocationsInsertOk();
    const from = jest.fn((table: string) =>
      table === 'storage_locations' ? { insert } : { update },
    );
    const client = { from } as unknown as TypedSupabaseClient;

    const result = await pushOutbox({ db, supabase: client, now: () => 12_345 });

    expect(result.outcomes[0]).toMatchObject({ kind: 'pushed', entity: 'fridge_items' });
    // Resolver hat den lokal vorhandenen Lagerort nachgepusht, dann wurde
    // fridge_items ein zweites Mal versucht (Repair + Retry).
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ id: 'loc-1' }));
    expect(update).toHaveBeenCalledTimes(2);
    expect(update.mock.calls[0][0]).not.toHaveProperty('location_kind');
    expect(update.mock.calls[0][0]).not.toHaveProperty('location_name');
  });

  it('klassifiziert den Fehler wie gewohnt, wenn der Resolver nicht reparieren kann (kein FK-Fehler)', async () => {
    const otherError = { code: '23505', message: 'duplicate key' };
    const update = fridgeItemsUpdateResponses([{ data: null, error: otherError }]);
    const from = jest.fn().mockReturnValue({ update });
    const client = { from } as unknown as TypedSupabaseClient;

    const result = await pushOutbox({ db, supabase: client, now: () => 12_345 });

    expect(result.outcomes[0]).toMatchObject({ kind: 'failed-permanent', entity: 'fridge_items' });
    // Resolver wurde aufgerufen (jeder Fehler geht an ihn), hat aber nicht
    // reparieren koennen -> keinen zweiten Versuch ausgeloest.
    expect(update).toHaveBeenCalledTimes(1);
  });
});

describe('pushOutbox — medizinische Einheiten', () => {
  it('sendet unit "units" unveraendert an Supabase', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);

    const remoteRow = {
      id: 'med-1',
      user_id: 'user-1',
      child_profile_id: null,
      medication_name: 'Insulin',
      dose: 4,
      unit: 'units',
      injection_site: null,
      administered_at: '2026-08-30T10:00:00.000Z',
      notes: null,
      created_at: '2026-08-30T10:00:00.000Z',
      updated_at: '2026-08-30T10:00:01.000Z',
      deleted_at: null,
    };
    const select = jest.fn().mockResolvedValue({ data: [remoteRow], error: null, status: 201 });
    const insert = jest.fn().mockReturnValue({ select });
    const client = {
      from: jest.fn().mockReturnValue({ insert }),
    } as unknown as TypedSupabaseClient;

    await enqueueMutation(db, {
      entity: 'medication_logs',
      entityId: 'med-1',
      op: 'insert',
      payload: remoteRow,
      now: 1,
      applyLocally: async () => {},
    });

    try {
      await pushOutbox({ db, supabase: client, now: () => 2 });

      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ unit: 'units' }));
    } finally {
      db.close();
    }
  });
});
