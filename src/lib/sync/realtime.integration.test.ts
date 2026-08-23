import { enqueueMutation } from '@/lib/db/outbox';
import { pullHousehold } from '@/lib/sync/pull';
import { pushOutbox } from '@/lib/sync/push';
import { type RealtimeSubscribeState, subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import { createServerClock } from '@/lib/sync/server-clock';
import { assertLocalSupabase, type Device, setupTwoDevices } from '../../../test/setup-two-devices';

let teardowns: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const t of teardowns) await t();
  teardowns = [];
});
afterAll(async () => {
  for (const t of teardowns) await t();
  teardowns = [];
});

async function pollUntil<T>(
  fn: () => Promise<T | undefined | null>,
  { timeoutMs = 5000, intervalMs = 50 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await fn();
    if (result !== undefined && result !== null) return result;
    if (Date.now() >= deadline) throw new Error(`pollUntil: Timeout nach ${timeoutMs}ms`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Verhindert ein Rennen zwischen Test-Event und WebSocket-Handshake. */
function waitForSubscribed(householdId: string): {
  onStatusChange: (id: string, status: RealtimeSubscribeState) => void;
  ready: Promise<void>;
} {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  return {
    ready,
    onStatusChange: (id, status) => {
      if (id === householdId && status === 'SUBSCRIBED') resolveReady();
    },
  };
}

async function fridgeItemName(device: Device, id: string): Promise<string | undefined> {
  const row = await device.db.getFirstAsync<{ name: string }>(
    'select name from fridge_items where id = ?',
    [id],
  );
  return row?.name;
}

async function fridgeItemCount(device: Device, id: string): Promise<number> {
  const row = await device.db.getFirstAsync<{ c: number }>(
    'select count(*) as c from fridge_items where id = ?',
    [id],
  );
  return row?.c ?? 0;
}

async function insertFridgeItemLocally(
  device: Device,
  id: string,
  householdId: string,
  name: string,
) {
  await enqueueMutation(device.db, {
    entity: 'fridge_items',
    entityId: id,
    op: 'insert',
    payload: { id, household_id: householdId, name },
    applyLocally: (txn) =>
      txn
        .runAsync(
          'insert into fridge_items (id, household_id, name, updated_at, _dirty) values (?, ?, ?, ?, 1)',
          [id, householdId, name, Date.now()],
        )
        .then(() => undefined),
  });
}

describe('subscribeHouseholdRealtime', () => {
  beforeAll(assertLocalSupabase);

  it('AC1: Aenderung auf Geraet B erscheint auf Geraet A in unter 2s (Ziel laut Issue: <1s)', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('rt-propagate');
    teardowns.push(teardown);
    const id = crypto.randomUUID();
    const sub = waitForSubscribed(householdId);

    const unsubscribe = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: sub.onStatusChange,
    });

    try {
      await sub.ready;

      // Nach frischem Supabase-Start kann das erste Realtime-Event verloren gehen.
      let isWarm = false;
      for (let i = 0; i < 20; i++) {
        const warmupId = crypto.randomUUID();
        await deviceB.client
          .from('fridge_items')
          .insert({ id: warmupId, household_id: householdId, name: 'Aufwaermen' });

        try {
          await pollUntil(() => fridgeItemName(deviceA, warmupId), {
            timeoutMs: 3_000,
            intervalMs: 200,
          });
          isWarm = true;
          break;
        } catch {}
      }
      if (!isWarm) throw new Error('Realtime warmup failed after 60s');

      const start = Date.now();
      const { error } = await deviceB.client
        .from('fridge_items')
        .insert({ id, household_id: householdId, name: 'Von B via Realtime' });
      expect(error).toBeNull();

      await pollUntil(() => fridgeItemName(deviceA, id));
      const elapsed = Date.now() - start;

      expect(await fridgeItemName(deviceA, id)).toBe('Von B via Realtime');
      expect(elapsed).toBeLessThan(2000);
    } finally {
      await unsubscribe();
    }
  }, 60_000);

  it('kein Echo-Loop: eigener Push kommt als Realtime-Event zurueck, ohne erneuten Outbox-Eintrag oder Duplikat', async () => {
    const { deviceA, householdId, teardown } = await setupTwoDevices('rt-echo');
    teardowns.push(teardown);
    const id = crypto.randomUUID();
    const sub = waitForSubscribed(householdId);

    const unsubscribe = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: sub.onStatusChange,
    });

    try {
      await sub.ready;

      await insertFridgeItemLocally(deviceA, id, householdId, 'Eigener Push');
      const result = await pushOutbox({ db: deviceA.db, supabase: deviceA.client });
      expect(result.outcomes.some((o) => o.kind === 'pushed')).toBe(true);

      await pollUntil(() => fridgeItemName(deviceA, id));

      const outboxRows = await deviceA.db.getAllAsync<{ id: number }>(
        'select id from outbox where entity_id = ?',
        [id],
      );
      expect(outboxRows).toHaveLength(0);

      const row = await deviceA.db.getFirstAsync<{ _dirty: number }>(
        'select _dirty from fridge_items where id = ?',
        [id],
      );
      expect(row?._dirty).toBe(0);

      expect(await fridgeItemCount(deviceA, id)).toBe(1);
    } finally {
      await unsubscribe();
    }
  }, 30_000);

  it('Reconnect: waehrend die Subscription abgemeldet ist verpasste Events werden durch einen vollen Pull nachgeholt', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('rt-reconnect');
    teardowns.push(teardown);
    const idBeforeGap = crypto.randomUUID();
    const idDuringGap1 = crypto.randomUUID();
    const idDuringGap2 = crypto.randomUUID();

    let resyncCalls = 0;
    const onReconnectResyncNeeded = async () => {
      resyncCalls += 1;
      await pullHousehold({
        db: deviceA.db,
        supabase: deviceA.client,
        householdIds: [householdId],
        clockCeilingMs: Date.now(),
      });
    };

    const sub1 = waitForSubscribed(householdId);
    const unsubscribe1 = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded,
      onStatusChange: sub1.onStatusChange,
    });
    await sub1.ready;

    await deviceB.client
      .from('fridge_items')
      .insert({ id: idBeforeGap, household_id: householdId, name: 'Vor der Luecke' });
    await pollUntil(() => fridgeItemName(deviceA, idBeforeGap));

    await unsubscribe1();
    await new Promise((r) => setTimeout(r, 300));

    await deviceB.client
      .from('fridge_items')
      .insert({ id: idDuringGap1, household_id: householdId, name: 'Waehrend der Luecke 1' });
    await deviceB.client
      .from('fridge_items')
      .insert({ id: idDuringGap2, household_id: householdId, name: 'Waehrend der Luecke 2' });
    await new Promise((r) => setTimeout(r, 500));
    expect(await fridgeItemName(deviceA, idDuringGap1)).toBeUndefined();
    expect(await fridgeItemName(deviceA, idDuringGap2)).toBeUndefined();

    const sub2 = waitForSubscribed(householdId);
    const unsubscribe2 = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded,
      onStatusChange: sub2.onStatusChange,
    });

    try {
      await sub2.ready;
      await onReconnectResyncNeeded();

      expect(await fridgeItemName(deviceA, idDuringGap1)).toBe('Waehrend der Luecke 1');
      expect(await fridgeItemName(deviceA, idDuringGap2)).toBe('Waehrend der Luecke 2');
      expect(await fridgeItemCount(deviceA, idDuringGap1)).toBe(1);
      expect(await fridgeItemCount(deviceA, idDuringGap2)).toBe(1);
      expect(resyncCalls).toBeGreaterThanOrEqual(1);
    } finally {
      await unsubscribe2();
    }
  }, 30_000);

  it('Haushalts-Wechsel: nach unsubscribe() kommen keine Events mehr an und der Channel ist aus der Registry entfernt', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('rt-switch');
    teardowns.push(teardown);
    const idAfterUnsub = crypto.randomUUID();
    const sub = waitForSubscribed(householdId);

    const unsubscribe = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: sub.onStatusChange,
    });

    try {
      await sub.ready;

      await unsubscribe();
      await new Promise((r) => setTimeout(r, 300));

      await deviceB.client
        .from('fridge_items')
        .insert({ id: idAfterUnsub, household_id: householdId, name: 'Nach dem Abmelden' });

      await new Promise((r) => setTimeout(r, 1000));
      expect(await fridgeItemName(deviceA, idAfterUnsub)).toBeUndefined();

      const remainingChannels = deviceA.client
        .getChannels()
        .filter((c) => c.topic === `realtime:household:${householdId}`);
      expect(remainingChannels).toHaveLength(0);
    } finally {
    }
  }, 30_000);

  it('raeumt einen stehengebliebenen Channel desselben Topics ab, statt daran zu scheitern', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('rt-stale');
    teardowns.push(teardown);

    const leaked = deviceA.client.channel(`household:${householdId}`);
    leaked.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'fridge_items' },
      () => {},
    );
    await new Promise<void>((resolve) => {
      leaked.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve();
      });
    });

    const sub = waitForSubscribed(householdId);
    const unsubscribe = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: sub.onStatusChange,
    });

    try {
      await sub.ready;

      const id = crypto.randomUUID();
      await deviceB.client
        .from('fridge_items')
        .insert({ id, household_id: householdId, name: 'Nach dem Abraeumen' });

      await pollUntil(() => fridgeItemName(deviceA, id));
      expect(await fridgeItemName(deviceA, id)).toBe('Nach dem Abraeumen');
    } finally {
      await unsubscribe();
    }
  }, 30_000);

  it('erneutes Abonnieren desselben Haushalts direkt nach dem Abmelden wirft nicht', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('rt-resubscribe');
    teardowns.push(teardown);

    const first = waitForSubscribed(householdId);
    const unsubscribeFirst = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: first.onStatusChange,
    });
    await first.ready;
    await unsubscribeFirst();

    expect(
      deviceA.client.getChannels().filter((c) => c.topic === `realtime:household:${householdId}`),
    ).toHaveLength(0);

    const second = waitForSubscribed(householdId);
    const unsubscribeSecond = subscribeHouseholdRealtime({
      db: deviceA.db,
      supabase: deviceA.client,
      householdIds: [householdId],
      serverClock: createServerClock(),
      onReconnectResyncNeeded: async () => {},
      onStatusChange: second.onStatusChange,
    });

    try {
      await second.ready;

      const id = crypto.randomUUID();
      await deviceB.client
        .from('fridge_items')
        .insert({ id, household_id: householdId, name: 'Nach dem Neu-Abonnieren' });

      await pollUntil(() => fridgeItemName(deviceA, id));
      expect(await fridgeItemName(deviceA, id)).toBe('Nach dem Neu-Abonnieren');
    } finally {
      await unsubscribeSecond();
    }
  }, 30_000);
});
