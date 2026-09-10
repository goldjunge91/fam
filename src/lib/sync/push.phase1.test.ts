import { createClient } from '@supabase/supabase-js';
import { createInsertInventoryOperation } from '@/features/inventory/inventory-lifecycle';
import type { Database } from '@/lib/database.types';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { commitInventoryOperation } from '@/lib/sync/inventory-quantity';
import { pushOutbox } from '@/lib/sync/push';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';
const ITEM_ID = '33333333-3333-4333-8333-333333333333';
const LOCATION_ID = '44444444-4444-4444-8444-444444444444';
const OPERATION_ID = '55555555-5555-4555-8555-555555555555';
const LEDGER_ID = '66666666-6666-4666-8666-666666666666';

function operation() {
  return createInsertInventoryOperation({
    operation_id: OPERATION_ID,
    item_id: ITEM_ID,
    in_transaction_id: LEDGER_ID,
    household_id: HOUSEHOLD_ID,
    created_at: '2026-09-10T10:00:00.000Z',
    quantity: 2.5,
    product_id: null,
    name: 'Milch',
    unit: 'g',
    package_size: null,
    package_size_unit: null,
    location_id: LOCATION_ID,
    expiry_date: null,
  });
}

async function queuedInsert(db: TestDatabase): Promise<void> {
  await commitInventoryOperation(db, operation(), ACTOR_ID);
}

function rpcClient(responses: readonly Record<string, unknown>[]) {
  let responseIndex = 0;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
    const body = responses[responseIndex++];
    if (!body) throw new Error('Kein vorbereiteter RPC-Response.');
    return new Response(JSON.stringify(body), {
      status: 'kind' in body ? 200 : 500,
      headers: { 'content-type': 'application/json' },
    });
  });

  return {
    client: createClient<Database>('http://127.0.0.1:54321', 'test-key', {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    fetchMock,
  };
}

describe('Phase-1 Inventory-Push', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runDrizzleMigrations(db);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    db.close();
  });

  it('sendet eine Operation genau einmal und schließt alle Outbox-Legs gemeinsam ab', async () => {
    await queuedInsert(db);
    const { client, fetchMock } = rpcClient([
      {
        kind: 'applied',
        operation_id: OPERATION_ID,
        lots: [],
        transactions: [],
      },
    ]);

    const result = await pushOutbox({ db, supabase: client, now: () => 1_000 });

    expect(result.outcomes).toEqual([
      { kind: 'pushed', operation_id: OPERATION_ID, sourceIds: [1, 2] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ p_operation: operation() }));
    expect(await db.getAllAsync('select id from outbox')).toEqual([]);
    expect(
      await db.getAllAsync<{ dirty: number }>(
        'select _dirty as dirty from fridge_items where id = ?',
        [ITEM_ID],
      ),
    ).toEqual([{ dirty: 0 }]);
  });

  it('behält dieselbe Operation bei Timeout für den nächsten Versuch', async () => {
    await queuedInsert(db);
    const { client, fetchMock } = rpcClient([
      { code: 'NETWORK', message: 'offline' },
      { kind: 'replayed', operation_id: OPERATION_ID },
    ]);

    const first = await pushOutbox({ db, supabase: client, now: () => 1_000 });
    const second = await pushOutbox({ db, supabase: client, now: () => 3_000 });

    expect(first.outcomes[0]).toMatchObject({ kind: 'failed-transient' });
    expect(second.outcomes[0]).toEqual({
      kind: 'pushed',
      operation_id: OPERATION_ID,
      sourceIds: [1, 2],
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(fetchMock.mock.calls[1]?.[1]?.body);
    expect(await db.getAllAsync('select id from outbox')).toEqual([]);
  });

  it('hält einen serverseitigen Konflikt sichtbar und entfernt ihn nicht still', async () => {
    await queuedInsert(db);
    const { client } = rpcClient([
      { kind: 'conflict', operation_id: OPERATION_ID, code: 'STALE_BASE' },
    ]);

    const result = await pushOutbox({ db, supabase: client, now: () => 1_000 });

    expect(result.outcomes[0]).toEqual({
      kind: 'conflict',
      operation_id: OPERATION_ID,
      code: 'STALE_BASE',
      sourceIds: [1, 2],
    });
    expect(await db.getAllAsync('select id from outbox')).toHaveLength(2);
    expect(
      await db.getAllAsync<{ attempts: number; last_error: string }>(
        'select attempts, last_error from outbox order by id',
      ),
    ).toEqual([
      { attempts: 5, last_error: 'STALE_BASE' },
      { attempts: 5, last_error: 'STALE_BASE' },
    ]);
  });
});
