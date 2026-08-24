import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import type { TypedSupabaseClient } from '@/lib/supabase';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';
import { repairFridgeItemForeignKeyViolation } from './repair-fridge-item-push';

function fakeSupabase(insertResponse: { error: { message: string; code?: string } | null }) {
  const select = jest.fn().mockResolvedValue(insertResponse);
  const insert = jest.fn().mockReturnValue({ select });
  const from = jest.fn().mockReturnValue({ insert });
  return { client: { from } as unknown as TypedSupabaseClient, from, insert };
}

const fkError = {
  code: '23503',
  message:
    'insert or update on table "fridge_items" violates foreign key constraint "fridge_items_location_id_fkey"',
};

describe('repairFridgeItemForeignKeyViolation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => db.close());

  it('gibt null zurueck, wenn der Fehler keine location_id-FK-Verletzung ist', async () => {
    const { client } = fakeSupabase({ error: null });
    const result = await repairFridgeItemForeignKeyViolation(
      { db, supabase: client },
      { id: 'item-1', location_id: 'loc-1' },
      { code: '23505', message: 'duplicate key' },
    );
    expect(result).toBeNull();
  });

  it('gibt null zurueck, wenn der Payload keine location_id traegt', async () => {
    const { client } = fakeSupabase({ error: null });
    const result = await repairFridgeItemForeignKeyViolation(
      { db, supabase: client },
      { id: 'item-1', location_id: null },
      fkError,
    );
    expect(result).toBeNull();
  });

  it('pusht den lokal vorhandenen Lagerort nach und liefert den unveraenderten Payload zum Retry', async () => {
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, sort_order, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
      ['loc-1', 'hh-1', 'Kühlschrank', 'fridge', 0, '2026-01-01T00:00:00Z', 0],
    );
    const { client, from, insert } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', location_id: 'loc-1', name: 'Milch' };

    const result = await repairFridgeItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkError,
    );

    expect(from).toHaveBeenCalledWith('storage_locations');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'loc-1', name: 'Kühlschrank' }),
    );
    expect(result).toEqual(payload);
  });

  it('setzt location_id auf null, wenn der Lagerort lokal nicht (mehr) existiert', async () => {
    const { client } = fakeSupabase({ error: null });
    const payload = { id: 'item-1', location_id: 'loc-unbekannt', name: 'Milch' };

    const result = await repairFridgeItemForeignKeyViolation(
      { db, supabase: client },
      payload,
      fkError,
    );

    expect(result).toEqual({ ...payload, location_id: null });
  });
});
