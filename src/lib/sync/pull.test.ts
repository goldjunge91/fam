jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
}));

jest.mock('@/lib/telemetry', () => ({
  addDiagnosticStep: jest.fn(),
  reportWarning: jest.fn(),
}));

import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { readSyncState } from '@/lib/db/sync-state';
import { buildOrFilter, pullHousehold } from '@/lib/sync/pull';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

const { getNetworkStateAsync } = jest.requireMock('expo-network') as {
  getNetworkStateAsync: jest.Mock;
};
const { addDiagnosticStep, reportWarning } = jest.requireMock('@/lib/telemetry') as {
  addDiagnosticStep: jest.Mock;
  reportWarning: jest.Mock;
};

type PullResponse = {
  data: unknown;
  error: { code?: string; message: string } | null;
};

type QueryCall = {
  select: string;
  inFilters: { column: string; values: readonly string[] }[];
  orFilter: string | null;
  orders: { column: string; ascending: boolean }[];
  limit: number | null;
};

function responseQuery(
  response: PullResponse,
  resolveResponse: () => PullResponse = () => response,
) {
  const call: QueryCall = {
    select: '*',
    inFilters: [],
    orFilter: null,
    orders: [],
    limit: null,
  };

  type Query = {
    select: (columns?: string) => Query;
    in: (column: string, values: readonly string[]) => Query;
    or: (filter: string) => Query;
    order: (column: string, options: { ascending: boolean }) => Query;
    limit: (count: number) => Query;
    then: (
      onfulfilled: (value: PullResponse) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => PromiseLike<unknown>;
  };

  let query: Query;
  query = {
    select(columns = '*') {
      call.select = columns;
      return query;
    },
    in(column, values) {
      call.inFilters.push({ column, values });
      return query;
    },
    or(filter) {
      call.orFilter = filter;
      return query;
    },
    order(column, options) {
      call.orders.push({ column, ascending: options.ascending });
      return query;
    },
    limit(count) {
      call.limit = count;
      return query;
    },
    // biome-ignore lint/suspicious/noThenProperty: Supabase verwendet bewusst einen thenable Query-Builder.
    then(onfulfilled, onrejected) {
      try {
        return Promise.resolve(resolveResponse()).then(onfulfilled, onrejected);
      } catch (error) {
        return Promise.reject(error).then(onfulfilled, onrejected);
      }
    },
  };

  return { call, query };
}

function fakeSupabase(fixtures: ReturnType<typeof responseQuery>[]) {
  const from = jest.fn(() => {
    const fixture = fixtures.shift();
    if (!fixture) throw new Error('Unerwartete Supabase-Abfrage im Unit-Test.');
    return fixture.query;
  });
  const refreshSession = jest.fn().mockResolvedValue({ data: { session: null }, error: null });

  return {
    client: { from, auth: { refreshSession } } as unknown as TypedSupabaseClient,
    from,
    refreshSession,
  };
}

type EvaluatedRemoteRow = Record<string, unknown> & {
  id: string;
  household_id: string;
  updated_at: string;
};

type EvaluatedQueryCall = {
  table: string;
  select: string;
  householdIds: string[];
  orFilter: string | null;
  orders: { column: string; ascending: boolean }[];
  limit: number | null;
};

function evaluatingRemoteSource(
  rows: EvaluatedRemoteRow[],
  errorForHousehold?: (householdId: string) => PullResponse['error'],
) {
  const pullCalls: EvaluatedQueryCall[] = [];
  const from = jest.fn((table: string) => {
    const fixture = responseQuery({ data: null, error: null }, () => {
      const call = fixture.call;
      const householdFilter = call.inFilters.find(({ column }) => column === 'household_id');
      const householdIds = householdFilter ? [...householdFilter.values] : [];
      const householdId = householdIds[0];
      if (call.orFilter !== null) {
        pullCalls.push({
          table,
          select: call.select,
          householdIds,
          orFilter: call.orFilter,
          orders: [...call.orders],
          limit: call.limit,
        });
      }
      const error =
        call.orFilter !== null && householdId !== undefined
          ? errorForHousehold?.(householdId)
          : null;
      if (error) return { data: null, error };

      let result = rows.filter(
        (row) => householdIds.length === 0 || householdIds.includes(row.household_id),
      );

      if (call.orFilter !== null) {
        const cursor = /^([a-z_]+)\.gt\.(.*),and\(\1\.eq\.(.*),id\.gt\.(.*)\)$/.exec(call.orFilter);
        if (!cursor) throw new Error(`Unbekannter Cursorfilter: ${call.orFilter}`);
        const [, column, , equalTo, greaterId] = cursor;
        result = result.filter((row) => {
          const value = String(row[column]);
          return value > equalTo || (value === equalTo && row.id > greaterId);
        });
      }

      result.sort((left, right) => {
        for (const order of call.orders) {
          const leftValue = String(left[order.column]);
          const rightValue = String(right[order.column]);
          if (leftValue === rightValue) continue;
          const comparison = leftValue < rightValue ? -1 : 1;
          return order.ascending ? comparison : -comparison;
        }
        return 0;
      });

      if (call.limit !== null) result = result.slice(0, call.limit);
      const data =
        call.select === 'id' ? result.map(({ id }) => ({ id })) : result.map((row) => ({ ...row }));
      return { data, error: null };
    });

    return fixture.query;
  });

  return {
    client: {
      from,
      auth: {
        refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    } as unknown as TypedSupabaseClient,
    from,
    pullCalls,
  };
}

function productRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'product-1',
    barcode: null,
    name: 'Milch',
    brand: null,
    kcal_per_100: null,
    protein_g_per_100: null,
    carbs_g_per_100: null,
    fat_g_per_100: null,
    fiber_g_per_100: null,
    sugar_g_per_100: null,
    salt_g_per_100: null,
    serving_size_g: null,
    off_category_tags: [],
    off_last_modified_at: null,
    source: 'manual',
    created_by: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function fridgeRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'item-1',
    household_id: 'household-1',
    location_id: null,
    product_id: null,
    name: 'Milch',
    quantity: 1,
    unit: 'piece',
    package_size: null,
    package_size_unit: null,
    expiry_date: null,
    added_by: 'user-1',
    created_at: '2026-01-01T00:00:00.000Z',
    opened_at: null,
    vacuum_sealed: false,
    expiry_user_set: false,
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function storageLocationRow(
  householdId: string,
  id: string,
  updatedAt: string,
  overrides: Partial<Record<string, unknown>> = {},
): EvaluatedRemoteRow {
  return {
    id,
    household_id: householdId,
    name: id,
    kind: 'fridge',
    sort_order: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: updatedAt,
    deleted_at: null,
    ...overrides,
  };
}

async function createSyncDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await applyLocalSchema(db);

  return db;
}

describe('Transaktions-Pull-Cursor', () => {
  it('startet den serverseitigen Sequenzcursor bei null statt bei einer ISO-Zeit', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '0', lastSyncedId: '00000000-0000-0000-0000-000000000000' },
        'sync_sequence',
      ),
    ).toBe('sync_sequence.gt.0,and(sync_sequence.eq.0,id.gt.00000000-0000-0000-0000-000000000000)');
  });

  it('ordnet Transaktionen nach der serverseitigen Sequenz statt nach Eventzeit', () => {
    expect(
      buildOrFilter(
        { lastSyncedAt: '41', lastSyncedId: '00000000-0000-0000-0000-000000000001' },
        'sync_sequence',
      ),
    ).toBe(
      'sync_sequence.gt.41,and(sync_sequence.eq.41,id.gt.00000000-0000-0000-0000-000000000001)',
    );
  });
});

describe('pullHousehold – Fehlerdiagnose', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    getNetworkStateAsync.mockResolvedValue({});
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('persistiert Entity, Error-Code und previous-error-Zustand bei wiederholtem Pull-Fehler', async () => {
    const error = { code: 'PGRST000', message: 'Pull-Netzwerkfehler' };
    const first = fakeSupabase([responseQuery({ data: null, error })]);

    const firstPull = await pullHousehold({
      db,
      supabase: first.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(firstPull).toEqual([
      expect.objectContaining({
        entity: 'products',
        error: error.message,
        errorCode: error.code,
        errorWasPreviouslyRecorded: false,
      }),
    ]);
    expect(await readSyncState(db, 'products')).toEqual({
      cursor: null,
      lastError: error.message,
    });
    expect(reportWarning).toHaveBeenCalledWith(
      expect.stringContaining(error.message),
      expect.objectContaining({
        operation: 'sync.pull',
        entity: 'products',
        error_code: error.code,
      }),
    );

    const second = fakeSupabase([responseQuery({ data: null, error })]);
    const secondPull = await pullHousehold({
      db,
      supabase: second.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(secondPull[0]).toEqual(expect.objectContaining({ errorWasPreviouslyRecorded: true }));
    expect(reportWarning).toHaveBeenCalledTimes(1);
  });
});

describe('pullHousehold – Cursor und JWT-Recovery', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    getNetworkStateAsync.mockResolvedValue({});
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('paginiert und schreibt den Cursor erst nach jeder vollständig angewendeten Seite', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) =>
      productRow({ id: `product-${String(index).padStart(3, '0')}` }),
    );
    const secondPage = [productRow({ id: 'product-500' })];
    const first = responseQuery({ data: firstPage, error: null });
    const second = responseQuery({ data: secondPage, error: null });
    const client = fakeSupabase([first, second]);

    const outcomes = await pullHousehold({
      db,
      supabase: client.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(outcomes).toEqual([
      expect.objectContaining({
        entity: 'products',
        pagesFetched: 2,
        rowsWritten: 501,
        rowsSkippedAsLocalWins: 0,
      }),
    ]);
    expect(first.call.orFilter).toBe(
      buildOrFilter(
        {
          lastSyncedAt: '1970-01-01T00:00:00Z',
          lastSyncedId: '00000000-0000-0000-0000-000000000000',
        },
        'updated_at',
      ),
    );
    expect(second.call.orFilter).toBe(
      buildOrFilter(
        { lastSyncedAt: '2026-01-01T00:00:00.000Z', lastSyncedId: 'product-499' },
        'updated_at',
      ),
    );
    expect(await readSyncState(db, 'products')).toMatchObject({
      cursor: { lastSyncedAt: '2026-01-01T00:00:00.000Z', lastSyncedId: 'product-500' },
      lastError: null,
    });
  });

  it('rollt eine Seite und ihren Cursor gemeinsam zurueck, wenn die Transaktion scheitert', async () => {
    const invalidPage = responseQuery({
      data: [productRow({ updated_at: 'kein-gueltiger-cursor' })],
      error: null,
    });

    await expect(
      pullHousehold({
        db,
        supabase: fakeSupabase([invalidPage]).client,
        householdIds: [],
        clockCeilingMs: 10_000,
        entities: ['products'],
      }),
    ).rejects.toThrow('Kein gueltiger Postgres-Zeitstempel');

    expect(await readSyncState(db, 'products')).toEqual({ cursor: null, lastError: null });
    expect(
      await db.getFirstAsync('select id from products where id = ?', ['product-1']),
    ).toBeNull();
  });

  it('rollt auch bei einem fehlenden Append-only-Cursor die Transaktion zurueck', async () => {
    const invalidTransaction = responseQuery({
      data: [
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
          created_at: '2026-01-01T00:00:00.000Z',
          // sync_sequence fehlt absichtlich: upsert ist noch moeglich,
          // aber der Cursor darf danach nicht fortgeschrieben werden.
        },
      ],
      error: null,
    });

    await expect(
      pullHousehold({
        db,
        supabase: fakeSupabase([invalidTransaction]).client,
        householdIds: ['household-1'],
        clockCeilingMs: 10_000,
        entities: ['transactions'],
      }),
    ).rejects.toThrow('Remote-Zeile hat keinen gültigen sync_sequence-Cursorwert');

    expect(await readSyncState(db, 'transactions', 'household:household-1')).toEqual({
      cursor: null,
      lastError: null,
    });
    expect(
      await db.getFirstAsync('select id from transactions where id = ?', ['transaction-1']),
    ).toBeNull();
  });

  it('unterdrueckt die erste JWT-Warnung, refresht die Session und wiederholt ab der fehlenden Entity', async () => {
    const first = responseQuery({
      data: null,
      error: { code: 'PGRST301', message: 'JWT issued in the future' },
    });
    const retry = responseQuery({ data: [productRow()], error: null });
    const client = fakeSupabase([first, retry]);

    const outcomes = await pullHousehold({
      db,
      supabase: client.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(outcomes).toEqual([expect.objectContaining({ entity: 'products', rowsWritten: 1 })]);
    expect(outcomes[0]).not.toHaveProperty('error');
    expect(client.refreshSession).toHaveBeenCalledTimes(1);
    expect(reportWarning).not.toHaveBeenCalled();
    expect(addDiagnosticStep).toHaveBeenNthCalledWith(
      1,
      'auth.session.refresh_started',
      expect.objectContaining({ error_code: 'jwt_issued_in_future', retry_count: 0 }),
    );
    expect(addDiagnosticStep).toHaveBeenNthCalledWith(
      2,
      'auth.session.refresh_completed',
      expect.objectContaining({ error_code: 'jwt_issued_in_future', retry_count: 1 }),
    );
    expect(await readSyncState(db, 'products')).toMatchObject({
      cursor: { lastSyncedId: 'product-1' },
      lastError: null,
    });
  });

  it('meldet einen persistierenden JWT-Fehler erst beim Retry mit retry_count 1', async () => {
    const jwtError = { code: 'PGRST301', message: 'JWT issued in the future' };
    const client = fakeSupabase([
      responseQuery({ data: null, error: jwtError }),
      responseQuery({ data: null, error: jwtError }),
    ]);

    const outcomes = await pullHousehold({
      db,
      supabase: client.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(outcomes[0]).toEqual(
      expect.objectContaining({
        entity: 'products',
        error: jwtError.message,
        errorCode: jwtError.code,
      }),
    );
    expect(reportWarning).toHaveBeenCalledTimes(1);
    expect(reportWarning).toHaveBeenCalledWith(
      expect.stringContaining(jwtError.message),
      expect.objectContaining({
        error_code: 'jwt_issued_in_future',
        retry_count: 1,
      }),
    );
  });

  it('meldet einen fehlgeschlagenen Session-Refresh und den urspruenglichen JWT-Pull-Fehler', async () => {
    const jwtError = { code: 'PGRST301', message: 'JWT issued in the future' };
    const client = fakeSupabase([responseQuery({ data: null, error: jwtError })]);
    client.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { code: 'AUTH_REFRESH_FAILED', message: 'Session refresh failed' },
    });

    const outcomes = await pullHousehold({
      db,
      supabase: client.client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['products'],
    });

    expect(outcomes[0]).toEqual(expect.objectContaining({ error: jwtError.message }));
    expect(reportWarning).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Session-Aktualisierung fehlgeschlagen'),
      expect.objectContaining({ error_code: 'AUTH_REFRESH_FAILED' }),
    );
    expect(reportWarning).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining(jwtError.message),
      expect.objectContaining({ error_code: 'jwt_issued_in_future', retry_count: 0 }),
    );
  });
});

describe('pullHousehold – isolierte Haushalt-Cursor', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    getNetworkStateAsync.mockResolvedValue({});
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('lädt A und B unabhängig vom alten default-Cursor, dedupliziert und sortiert die Scopes', async () => {
    await db.runAsync(
      `insert into sync_state
       (entity, scope, last_synced_at, last_synced_id, last_run_at, last_error)
       values (?, ?, ?, ?, ?, ?)`,
      ['storage_locations', 'default', '2099-01-01T00:00:00.000Z', 'default-id', 1, null],
    );

    const remote = evaluatingRemoteSource([
      storageLocationRow('household-a', 'location-a', '2026-01-03T00:00:00.000Z'),
      storageLocationRow('household-b', 'location-b', '2026-01-02T00:00:00.000Z'),
    ]);

    const result = await pullHousehold({
      db,
      supabase: remote.client,
      householdIds: ['household-b', 'household-a', 'household-a'],
      clockCeilingMs: 10_000,
      entities: ['storage_locations'],
    });

    expect(result).toEqual([
      expect.objectContaining({
        entity: 'storage_locations',
        pagesFetched: 2,
        rowsWritten: 2,
        rowsSkippedAsLocalWins: 0,
      }),
    ]);
    expect(remote.pullCalls.map((call) => call.householdIds)).toEqual([
      ['household-a'],
      ['household-b'],
    ]);
    expect(
      await db.getAllAsync<{ id: string }>('select id from storage_locations order by id'),
    ).toEqual([{ id: 'location-a' }, { id: 'location-b' }]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toMatchObject({
      cursor: {
        lastSyncedAt: '2026-01-03T00:00:00.000Z',
        lastSyncedId: 'location-a',
      },
      lastError: null,
    });
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toMatchObject({
      cursor: {
        lastSyncedAt: '2026-01-02T00:00:00.000Z',
        lastSyncedId: 'location-b',
      },
      lastError: null,
    });
    expect(await readSyncState(db, 'storage_locations', 'default')).toMatchObject({
      cursor: {
        lastSyncedAt: '2099-01-01T00:00:00.000Z',
        lastSyncedId: 'default-id',
      },
      lastError: null,
    });
  });

  it('schreibt auch für einen leeren Haushaltsscope den eigenen initialen Erfolgscursor', async () => {
    const remote = evaluatingRemoteSource([
      storageLocationRow('household-a', 'location-a', '2026-01-03T00:00:00.000Z'),
    ]);

    const result = await pullHousehold({
      db,
      supabase: remote.client,
      householdIds: ['household-b', 'household-a'],
      clockCeilingMs: 10_000,
      entities: ['storage_locations'],
    });

    expect(result).toEqual([expect.objectContaining({ pagesFetched: 2, rowsWritten: 1 })]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toEqual({
      cursor: {
        lastSyncedAt: '1970-01-01T00:00:00Z',
        lastSyncedId: '00000000-0000-0000-0000-000000000000',
      },
      lastError: null,
    });
    expect(remote.pullCalls.map((call) => call.householdIds)).toEqual([
      ['household-a'],
      ['household-b'],
    ]);
  });

  it('löscht nach B-Fehler und leerem B-Erfolg nur B-last_error', async () => {
    const previousA = {
      lastSyncedAt: '2026-01-03T00:00:00.000Z',
      lastSyncedId: 'location-a',
      lastError: 'A-Fehler bleibt',
    };
    await db.runAsync(
      `insert into sync_state
       (entity, scope, last_synced_at, last_synced_id, last_run_at, last_error)
       values (?, ?, ?, ?, ?, ?)`,
      [
        'storage_locations',
        'household:household-a',
        previousA.lastSyncedAt,
        previousA.lastSyncedId,
        1,
        previousA.lastError,
      ],
    );

    const error = { code: 'PGRST000', message: 'B ist vorübergehend nicht erreichbar' };
    let failHouseholdB = true;
    const remote = evaluatingRemoteSource([], (householdId) =>
      householdId === 'household-b' && failHouseholdB ? error : null,
    );

    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-b'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ error: error.message })]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toEqual({
      cursor: {
        lastSyncedAt: previousA.lastSyncedAt,
        lastSyncedId: previousA.lastSyncedId,
      },
      lastError: previousA.lastError,
    });
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toEqual({
      cursor: null,
      lastError: error.message,
    });

    failHouseholdB = false;
    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-b'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ pagesFetched: 1, rowsWritten: 0 })]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toEqual({
      cursor: {
        lastSyncedAt: '1970-01-01T00:00:00Z',
        lastSyncedId: '00000000-0000-0000-0000-000000000000',
      },
      lastError: null,
    });
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toEqual({
      cursor: {
        lastSyncedAt: previousA.lastSyncedAt,
        lastSyncedId: previousA.lastSyncedId,
      },
      lastError: previousA.lastError,
    });
    expect(remote.pullCalls.map((call) => call.householdIds)).toEqual([
      ['household-b'],
      ['household-b'],
    ]);
  });

  it('behält beim Wechsel A → B → A jeweils den persistierten Scope und lädt B trotz älterer Daten', async () => {
    const remoteRows = [
      storageLocationRow('household-a', 'location-a-old', '2026-01-03T00:00:00.000Z'),
      storageLocationRow('household-b', 'location-b', '2026-01-02T00:00:00.000Z'),
    ];
    const remote = evaluatingRemoteSource(remoteRows);

    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-a'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ rowsWritten: 1 })]);

    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-b'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ rowsWritten: 1 })]);

    remoteRows.push(
      storageLocationRow('household-a', 'location-a-new', '2026-01-04T00:00:00.000Z'),
    );
    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-a'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ rowsWritten: 1 })]);

    expect(
      await db.getAllAsync<{ id: string; household_id: string }>(
        'select id, household_id from storage_locations order by id',
      ),
    ).toEqual([
      { id: 'location-a-new', household_id: 'household-a' },
      { id: 'location-a-old', household_id: 'household-a' },
      { id: 'location-b', household_id: 'household-b' },
    ]);
    expect(remote.pullCalls.map((call) => call.householdIds)).toEqual([
      ['household-a'],
      ['household-b'],
      ['household-a'],
    ]);
  });

  it('verarbeitet gleiche Cursorwerte mit ID-Tiebreaker über mehrere Seiten', async () => {
    const remote = evaluatingRemoteSource(
      Array.from({ length: 501 }, (_, index) =>
        storageLocationRow(
          'household-a',
          `location-${String(index).padStart(3, '0')}`,
          '2026-01-03T00:00:00.000Z',
        ),
      ),
    );

    const result = await pullHousehold({
      db,
      supabase: remote.client,
      householdIds: ['household-a'],
      clockCeilingMs: 10_000,
      entities: ['storage_locations'],
    });

    expect(result).toEqual([expect.objectContaining({ pagesFetched: 2, rowsWritten: 501 })]);
    expect(remote.pullCalls).toHaveLength(2);
    expect(remote.pullCalls[1]?.orFilter).toBe(
      buildOrFilter(
        {
          lastSyncedAt: '2026-01-03T00:00:00.000Z',
          lastSyncedId: 'location-499',
        },
        'updated_at',
      ),
    );
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toMatchObject({
      cursor: {
        lastSyncedAt: '2026-01-03T00:00:00.000Z',
        lastSyncedId: 'location-500',
      },
    });
  });

  it('committet A, isoliert einen Fehler in B und setzt B bei Retry mit seinem Cursor fort', async () => {
    const error = { code: 'PGRST000', message: 'Haushalt B nicht erreichbar' };
    let failHouseholdB = true;
    const remote = evaluatingRemoteSource(
      [
        storageLocationRow('household-a', 'location-a', '2026-01-03T00:00:00.000Z'),
        storageLocationRow('household-b', 'location-b', '2026-01-02T00:00:00.000Z'),
      ],
      (householdId) => (householdId === 'household-b' && failHouseholdB ? error : null),
    );

    const result = await pullHousehold({
      db,
      supabase: remote.client,
      householdIds: ['household-b', 'household-a'],
      clockCeilingMs: 10_000,
      entities: ['storage_locations'],
    });

    expect(result).toEqual([
      expect.objectContaining({
        error: error.message,
        errorCode: error.code,
        rowsWritten: 1,
      }),
    ]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toMatchObject({
      cursor: { lastSyncedId: 'location-a' },
      lastError: null,
    });
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toEqual({
      cursor: null,
      lastError: error.message,
    });
    expect(
      await db.getFirstAsync<{ id: string }>('select id from storage_locations where id = ?', [
        'location-a',
      ]),
    ).toEqual({ id: 'location-a' });
    expect(
      await db.getFirstAsync<{ id: string }>('select id from storage_locations where id = ?', [
        'location-b',
      ]),
    ).toBeNull();

    failHouseholdB = false;
    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-b', 'household-a'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([expect.objectContaining({ rowsWritten: 1 })]);
    expect(await readSyncState(db, 'storage_locations', 'household:household-b')).toMatchObject({
      cursor: { lastSyncedId: 'location-b' },
      lastError: null,
    });
    expect(
      await db.getFirstAsync<{ id: string }>('select id from storage_locations where id = ?', [
        'location-b',
      ]),
    ).toEqual({ id: 'location-b' });
  });

  it('rollt einen fehlerhaften Scoped-Seitencommit mitsamt dem Haushaltcursor zurück', async () => {
    const remote = evaluatingRemoteSource([
      storageLocationRow('household-a', 'location-valid', '2026-01-03T00:00:00.000Z'),
      storageLocationRow('household-a', 'location-invalid', 'kein-gueltiger-cursor'),
    ]);

    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: ['household-a'],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).rejects.toThrow('Kein gueltiger Postgres-Zeitstempel');

    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toEqual({
      cursor: null,
      lastError: null,
    });
    expect(await db.getAllAsync<{ id: string }>('select id from storage_locations')).toEqual([]);
  });

  it('führt für eine leere Haushaltliste keinen Pull, Fehlerwrite, Cursorwrite oder Orphan-Abgleich aus', async () => {
    const remote = evaluatingRemoteSource([]);

    await expect(
      pullHousehold({
        db,
        supabase: remote.client,
        householdIds: [],
        clockCeilingMs: 10_000,
        entities: ['storage_locations'],
      }),
    ).resolves.toEqual([
      {
        entity: 'storage_locations',
        pagesFetched: 0,
        rowsWritten: 0,
        rowsSkippedAsLocalWins: 0,
      },
    ]);
    expect(remote.from).not.toHaveBeenCalled();
    expect(await readSyncState(db, 'storage_locations', 'household:household-a')).toEqual({
      cursor: null,
      lastError: null,
    });
  });
});

describe('pullHousehold – lokale Wins und Reconciliation', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    getNetworkStateAsync.mockResolvedValue({});
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('zaehlt eine aeltere Remote-Zeile als local-win und bewahrt den lokalen Wert', async () => {
    const localUpdatedAt = Date.parse('2026-01-01T00:00:01.000Z');
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['item-1', 'household-1', 'Nur lokal', 1, 'piece', localUpdatedAt, 1],
    );

    const pull = responseQuery({ data: [fridgeRow()], error: null });
    const reconcile = responseQuery({ data: [{ id: 'item-1' }], error: null });
    const result = await pullHousehold({
      db,
      supabase: fakeSupabase([pull, reconcile]).client,
      householdIds: ['household-1'],
      clockCeilingMs: localUpdatedAt + 10_000,
      entities: ['fridge_items'],
    });

    expect(result[0]).toEqual(expect.objectContaining({ rowsSkippedAsLocalWins: 1 }));
    expect(
      await db.getFirstAsync<{ name: string; dirty: number }>(
        'select name, _dirty as dirty from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ name: 'Nur lokal', dirty: 1 });
  });

  it('loescht nur echte Entity-Orphans und bewahrt IDs mit offener Outbox', async () => {
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['orphan-1', 'household-1', 'Remote geloescht', 1, 'piece', 1, 0],
    );
    await db.runAsync(
      `insert into fridge_items
       (id, household_id, name, quantity, unit, updated_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?)`,
      ['pending-1', 'household-1', 'Noch nicht gepusht', 1, 'piece', 1, 1],
    );
    await db.runAsync(
      `insert into outbox (entity, entity_id, op, payload, created_at)
       values (?, ?, ?, ?, ?)`,
      ['fridge_items', 'pending-1', 'update', '{"id":"pending-1","name":"Noch nicht gepusht"}', 1],
    );

    const pull = responseQuery({ data: [], error: null });
    const reconcile = responseQuery({ data: [{ id: 'remote-1' }], error: null });
    await pullHousehold({
      db,
      supabase: fakeSupabase([pull, reconcile]).client,
      householdIds: ['household-1'],
      clockCeilingMs: 10_000,
      entities: ['fridge_items'],
    });

    expect(await db.getAllAsync<{ id: string }>('select id from fridge_items order by id')).toEqual(
      [{ id: 'pending-1' }],
    );
    expect(
      await db.getFirstAsync('select entity_id from outbox where entity_id = ?', ['pending-1']),
    ).not.toBeNull();
  });

  it('reconciliert households und entfernt nur lokal verwaiste Haushalte', async () => {
    await db.runAsync(`insert into households (id, name, updated_at, _dirty) values (?, ?, ?, ?)`, [
      'keep-household',
      'Behalten',
      1,
      0,
    ]);
    await db.runAsync(`insert into households (id, name, updated_at, _dirty) values (?, ?, ?, ?)`, [
      'orphan-household',
      'Entfernt',
      1,
      0,
    ]);

    const pull = responseQuery({ data: [], error: null });
    const reconcile = responseQuery({ data: [{ id: 'keep-household' }], error: null });
    await pullHousehold({
      db,
      supabase: fakeSupabase([pull, reconcile]).client,
      householdIds: [],
      clockCeilingMs: 10_000,
      entities: ['households'],
    });

    expect(await db.getAllAsync<{ id: string }>('select id from households')).toEqual([
      { id: 'keep-household' },
    ]);
  });
});

describe('pullHousehold – Netzwerkdiagnose', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it.each([
    ['offline', { isConnected: false, isInternetReachable: false }],
    ['unknown', new Error('Netzwerkstatus nicht verfuegbar')],
  ])(
    'meldet einen %s Pull-Fehler als Diagnose und nicht als Erfolg',
    async (label, networkState) => {
      if (networkState instanceof Error) {
        getNetworkStateAsync.mockRejectedValue(networkState);
      } else {
        getNetworkStateAsync.mockResolvedValue(networkState);
      }

      const error = { code: 'PGRST000', message: `Pull ${label} fehlgeschlagen` };
      const result = await pullHousehold({
        db,
        supabase: fakeSupabase([responseQuery({ data: null, error })]).client,
        householdIds: [],
        clockCeilingMs: 10_000,
        entities: ['products'],
      });

      expect(result[0]).toEqual(expect.objectContaining({ error: error.message }));
      expect(await readSyncState(db, 'products')).toMatchObject({
        cursor: null,
        lastError: error.message,
      });
      expect(reportWarning).toHaveBeenCalledWith(
        expect.stringContaining(error.message),
        expect.objectContaining({
          entity: 'products',
          network_state: label,
        }),
      );
    },
  );
});
