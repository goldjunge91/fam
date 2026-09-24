import {
  REALTIME_SUBSCRIBE_STATES,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';

jest.mock('@/lib/telemetry', () => ({
  reportError: jest.fn(),
  reportWarning: jest.fn(),
}));

import type { TypedSupabaseClient } from '@/lib/backend/supabase/remote-client';
import { toEpochMs } from '@/lib/sync/cursor';
import { upsertMirrorRow } from '@/lib/sync/mirror-write';
import { type RealtimeSubscribeState, subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import {
  applyLocalSchema,
  createTestDatabase,
  type TestDatabase,
} from '../../../test/node-sqlite-adapter';

const { reportError, reportWarning } = jest.requireMock('@/lib/telemetry') as {
  reportError: jest.Mock;
  reportWarning: jest.Mock;
};

type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>;
type PayloadHandler = (payload: Payload) => void;

type HandlerRegistration = {
  config: { event: string; schema: string; table: string; filter: string };
  callback: PayloadHandler;
};

type FakeChannel = {
  channel: RealtimeChannel;
  registrations: HandlerRegistration[];
  emitPayload: (payload: Payload, table: string) => void;
  emitStatus: (status: RealtimeSubscribeState) => void;
};

function fakeChannel(topic: string): FakeChannel {
  const registrations: HandlerRegistration[] = [];
  let statusCallback: ((status: RealtimeSubscribeState) => void) | undefined;
  let channel: RealtimeChannel;

  channel = {
    topic: `realtime:${topic}`,
    on: jest.fn(
      (
        _event: 'postgres_changes',
        config: HandlerRegistration['config'],
        callback: PayloadHandler,
      ) => {
        registrations.push({ config, callback });
        return channel;
      },
    ),
    subscribe: jest.fn((callback: (status: RealtimeSubscribeState) => void) => {
      statusCallback = callback;
      return channel;
    }),
  } as unknown as RealtimeChannel;

  return {
    channel,
    registrations,
    emitPayload(payload, table) {
      for (const registration of registrations) {
        if (registration.config.table === table) registration.callback(payload);
      }
    },
    emitStatus(status) {
      statusCallback?.(status);
    },
  };
}

function fakeSupabase(
  existing: FakeChannel[] = [],
  options: {
    removeChannel?: (
      candidate: RealtimeChannel,
      registry: FakeChannel[],
    ) => Promise<{ error: null }>;
  } = {},
) {
  const registry = [...existing];
  const created: FakeChannel[] = [];
  const channel = jest.fn((topic: string) => {
    const next = fakeChannel(topic);
    created.push(next);
    registry.push(next);
    return next.channel;
  });
  const removeChannel = jest.fn((candidate: RealtimeChannel) => {
    const index = registry.findIndex((entry) => entry.channel === candidate);
    if (index >= 0) registry.splice(index, 1);
    return options.removeChannel?.(candidate, registry) ?? Promise.resolve({ error: null });
  });

  return {
    client: {
      channel,
      getChannels: jest.fn(() => registry.map((entry) => entry.channel)),
      removeChannel,
    } as unknown as TypedSupabaseClient,
    channel,
    created,
    removeChannel,
  };
}

function serverClock() {
  return { fetch, serverNowMs: () => null };
}

async function createSyncDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await applyLocalSchema(db);

  return db;
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
    updated_at: '2026-01-01T00:00:01.500Z',
    deleted_at: null,
    ...overrides,
  };
}

function realtimePayload(
  eventType: Payload['eventType'],
  newRow: Record<string, unknown>,
  oldRow: Record<string, unknown>,
  errors: string[] = [],
): Payload {
  return {
    schema: 'public',
    table: 'fridge_items',
    commit_timestamp: '2026-01-01T00:00:02.000Z',
    eventType,
    errors,
    new: newRow,
    old: oldRow,
  };
}

async function flushRealtimeWork(): Promise<void> {
  // `handlePayload` wird vom echten Channel-Callback bewusst fire-and-forget
  // gestartet. Mehrere Microtask-Runden warten deterministisch auf den
  // Abschluss der SQLite-Transaktion, ohne einen künstlichen Zeitverzug.
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

describe('subscribeHouseholdRealtime — Lifecycle und Resync', () => {
  it('registriert alle Entity-Handler und entfernt stale Channels desselben Topics', async () => {
    const stale = fakeChannel('household:household-1');
    const supabase = fakeSupabase([stale]);
    expect(stale.channel.topic).toBe('realtime:household:household-1');
    expect(supabase.client.getChannels()).toEqual([stale.channel]);

    const unsubscribe = subscribeHouseholdRealtime({
      db: {} as never,
      supabase: supabase.client,
      householdIds: ['household-1', 'household-2'],
      serverClock: serverClock(),
      onReconnectResyncNeeded: async () => {},
    });

    expect(supabase.removeChannel).toHaveBeenCalledWith(stale.channel);
    expect(supabase.created).toHaveLength(2);
    expect(
      supabase.created.map((entry) => entry.registrations.map(({ config }) => config)),
    ).toEqual([
      [
        {
          event: '*',
          schema: 'public',
          table: 'fridge_items',
          filter: 'household_id=eq.household-1',
        },
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: 'household_id=eq.household-1',
        },
        {
          event: '*',
          schema: 'public',
          table: 'shopping_category_preferences',
          filter: 'household_id=eq.household-1',
        },
        {
          event: '*',
          schema: 'public',
          table: 'purchase_receipts',
          filter: 'household_id=eq.household-1',
        },
        {
          event: '*',
          schema: 'public',
          table: 'purchase_receipt_items',
          filter: 'household_id=eq.household-1',
        },
      ],
      [
        {
          event: '*',
          schema: 'public',
          table: 'fridge_items',
          filter: 'household_id=eq.household-2',
        },
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: 'household_id=eq.household-2',
        },
        {
          event: '*',
          schema: 'public',
          table: 'shopping_category_preferences',
          filter: 'household_id=eq.household-2',
        },
        {
          event: '*',
          schema: 'public',
          table: 'purchase_receipts',
          filter: 'household_id=eq.household-2',
        },
        {
          event: '*',
          schema: 'public',
          table: 'purchase_receipt_items',
          filter: 'household_id=eq.household-2',
        },
      ],
    ]);

    expect(
      supabase.created.flatMap((entry) => entry.registrations.map(({ config }) => config.table)),
    ).not.toContain('receipt_assets');

    await unsubscribe();
    expect(supabase.removeChannel).toHaveBeenLastCalledWith(supabase.created[1]?.channel);
  });

  it('resynct nicht beim initialen SUBSCRIBED, aber nach Fehler und erfolgreicher Wiederanmeldung', async () => {
    const supabase = fakeSupabase();
    const onReconnectResyncNeeded = jest.fn().mockResolvedValue(undefined);
    const onStatusChange = jest.fn();

    const unsubscribe = subscribeHouseholdRealtime({
      db: {} as never,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      onReconnectResyncNeeded,
      onStatusChange,
    });
    const channel = supabase.created[0];

    channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    await Promise.resolve();
    expect(onReconnectResyncNeeded).not.toHaveBeenCalled();

    channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
    channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    await Promise.resolve();

    expect(onStatusChange).toHaveBeenNthCalledWith(
      2,
      'household-1',
      REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR,
    );
    expect(onReconnectResyncNeeded).toHaveBeenCalledTimes(1);

    await unsubscribe();
  });

  it.each([REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR, REALTIME_SUBSCRIBE_STATES.TIMED_OUT])(
    'resynct auch nach %s und anschliessendem SUBSCRIBED',
    async (failureStatus) => {
      const supabase = fakeSupabase();
      const onReconnectResyncNeeded = jest.fn().mockResolvedValue(undefined);

      const unsubscribe = subscribeHouseholdRealtime({
        db: {} as never,
        supabase: supabase.client,
        householdIds: ['household-1'],
        serverClock: serverClock(),
        onReconnectResyncNeeded,
      });
      const channel = supabase.created[0];

      channel?.emitStatus(failureStatus);
      channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
      await Promise.resolve();

      expect(onReconnectResyncNeeded).toHaveBeenCalledTimes(1);
      await unsubscribe();
    },
  );
});

describe('subscribeHouseholdRealtime — Payload-Verarbeitung', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    jest.clearAllMocks();
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db?.close();
  });

  it('schreibt INSERT und UPDATE in den Mirror und meldet die berechnete Latenz', async () => {
    const supabase = fakeSupabase();
    const onRowApplied = jest.fn();
    const nowMs = Date.parse('2026-01-01T00:00:02.000Z');
    const unsubscribe = subscribeHouseholdRealtime({
      db,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      now: () => nowMs,
      onReconnectResyncNeeded: async () => {},
      onRowApplied,
    });
    const channel = supabase.created[0];

    channel?.emitPayload(realtimePayload('INSERT', fridgeRow(), {}), 'fridge_items');
    await flushRealtimeWork();

    expect(
      await db.getFirstAsync<{ name: string; dirty: number }>(
        'select name, _dirty as dirty from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({ name: 'Milch', dirty: 0 });
    expect(onRowApplied).toHaveBeenCalledWith({
      entity: 'fridge_items',
      op: 'insert',
      id: 'item-1',
      latencyMs: 500,
    });

    channel?.emitPayload(
      realtimePayload(
        'UPDATE',
        fridgeRow({ name: 'Hafermilch', updated_at: '2026-01-01T00:00:01.750Z' }),
        fridgeRow({ name: 'Milch' }),
      ),
      'fridge_items',
    );
    await flushRealtimeWork();

    expect(
      await db.getFirstAsync<{ name: string }>('select name from fridge_items where id = ?', [
        'item-1',
      ]),
    ).toEqual({ name: 'Hafermilch' });
    expect(onRowApplied).toHaveBeenLastCalledWith({
      entity: 'fridge_items',
      op: 'update',
      id: 'item-1',
      latencyMs: 250,
    });

    await unsubscribe();
  });

  it('löscht bei einem DELETE die lokale Spiegelzeile und meldet keine Latenz', async () => {
    const supabase = fakeSupabase();
    const onRowApplied = jest.fn();
    const unsubscribe = subscribeHouseholdRealtime({
      db,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      onReconnectResyncNeeded: async () => {},
      onRowApplied,
    });
    const channel = supabase.created[0];

    channel?.emitPayload(realtimePayload('INSERT', fridgeRow(), {}), 'fridge_items');
    await flushRealtimeWork();

    channel?.emitPayload(realtimePayload('DELETE', {}, { id: 'item-1' }), 'fridge_items');
    await flushRealtimeWork();

    expect(
      await db.getFirstAsync('select id from fridge_items where id = ?', ['item-1']),
    ).toBeNull();
    expect(onRowApplied).toHaveBeenLastCalledWith({
      entity: 'fridge_items',
      op: 'delete',
      id: 'item-1',
      latencyMs: null,
    });

    await unsubscribe();
  });

  it('meldet Payload-Fehler einmal und fordert genau einen Resync an', async () => {
    const supabase = fakeSupabase();
    const onReconnectResyncNeeded = jest.fn().mockResolvedValue(undefined);
    const unsubscribe = subscribeHouseholdRealtime({
      db,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      onReconnectResyncNeeded,
    });
    const channel = supabase.created[0];

    channel?.emitPayload(
      realtimePayload('UPDATE', fridgeRow(), fridgeRow(), ['replica identity error']),
      'fridge_items',
    );
    await flushRealtimeWork();

    expect(reportWarning).toHaveBeenCalledTimes(1);
    expect(reportWarning).toHaveBeenCalledWith(
      'Realtime-Payload enthielt Fehler.',
      expect.objectContaining({
        operation: 'realtime.payload',
        entity: 'fridge_items',
        error_code: 'realtime_payload_error',
      }),
    );
    expect(onReconnectResyncNeeded).toHaveBeenCalledTimes(1);
    expect(
      await db.getFirstAsync('select id from fridge_items where id = ?', ['item-1']),
    ).toBeNull();

    await unsubscribe();
  });

  it('diagnostiziert einen fehlgeschlagenen Reconnect-Resync ohne unhandled rejection', async () => {
    const supabase = fakeSupabase();
    const onReconnectResyncNeeded = jest.fn().mockRejectedValue(new Error('Resync unavailable'));
    const unsubscribe = subscribeHouseholdRealtime({
      db,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      onReconnectResyncNeeded,
    });
    const channel = supabase.created[0];

    channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR);
    channel?.emitStatus(REALTIME_SUBSCRIBE_STATES.SUBSCRIBED);
    await flushRealtimeWork();

    expect(reportError).toHaveBeenCalledWith(
      new Error('Resync unavailable'),
      expect.objectContaining({
        operation: 'realtime.reconnect_sync',
        error_code: 'realtime_reconnect_sync_failed',
      }),
    );

    await unsubscribe();
  });
});

describe('subscribeHouseholdRealtime — Cleanup', () => {
  it('wartet beim Cleanup sequenziell auf removeChannel für alle Haushalte', async () => {
    const release: Array<() => void> = [];
    const supabase = fakeSupabase([], {
      removeChannel: () =>
        new Promise<{ error: null }>((resolve) => {
          release.push(() => resolve({ error: null }));
        }),
    });
    const unsubscribe = subscribeHouseholdRealtime({
      db: {} as never,
      supabase: supabase.client,
      householdIds: ['household-1', 'household-2'],
      serverClock: serverClock(),
      onReconnectResyncNeeded: async () => {},
    });

    let cleanupFinished = false;
    const cleanup = unsubscribe().then(() => {
      cleanupFinished = true;
    });
    await Promise.resolve();

    expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    expect(cleanupFinished).toBe(false);

    release[0]?.();
    await Promise.resolve();
    expect(supabase.removeChannel).toHaveBeenCalledTimes(2);
    expect(cleanupFinished).toBe(false);

    release[1]?.();
    await cleanup;
    expect(cleanupFinished).toBe(true);
  });
});

describe('subscribeHouseholdRealtime — bestätigte Remote-Aktualität', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await createSyncDatabase();
  });

  afterEach(() => {
    db.close();
  });

  it('wendet ältere Updates über den echten registrierten Callback nicht an', async () => {
    await upsertMirrorRow(
      db,
      'fridge_items',
      fridgeRow({
        name: 'Neuer Stand',
        quantity: 2_000,
        updated_at: '2026-01-01T12:00:00.000Z',
      }),
      { dirty: 0 },
    );

    const supabase = fakeSupabase();
    const unsubscribe = subscribeHouseholdRealtime({
      db,
      supabase: supabase.client,
      householdIds: ['household-1'],
      serverClock: serverClock(),
      onReconnectResyncNeeded: async () => {},
    });

    supabase.created[0]?.emitPayload(
      realtimePayload(
        'UPDATE',
        fridgeRow({
          name: 'Älterer Stand',
          quantity: 3_000,
          updated_at: '2026-01-01T11:00:00.000Z',
        }),
        fridgeRow({ updated_at: '2026-01-01T12:00:00.000Z' }),
      ),
      'fridge_items',
    );
    await flushRealtimeWork();

    expect(
      await db.getFirstAsync<{
        name: string;
        quantity: number;
        updated_at: number;
        deleted_at: number | null;
        dirty: number;
      }>(
        'select name, quantity, updated_at, deleted_at, _dirty as dirty from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({
      name: 'Neuer Stand',
      quantity: 2_000,
      updated_at: toEpochMs('2026-01-01T12:00:00.000Z'),
      deleted_at: null,
      dirty: 0,
    });

    supabase.created[0]?.emitPayload(
      realtimePayload(
        'UPDATE',
        fridgeRow({
          name: 'Neuester Stand',
          quantity: 4_000,
          updated_at: '2026-01-01T13:00:00.000Z',
        }),
        fridgeRow({ updated_at: '2026-01-01T12:00:00.000Z' }),
      ),
      'fridge_items',
    );
    await flushRealtimeWork();

    expect(
      await db.getFirstAsync<{ name: string; quantity: number; updated_at: number }>(
        'select name, quantity, updated_at from fridge_items where id = ?',
        ['item-1'],
      ),
    ).toEqual({
      name: 'Neuester Stand',
      quantity: 4_000,
      updated_at: toEpochMs('2026-01-01T13:00:00.000Z'),
    });

    await unsubscribe();
  });
});
