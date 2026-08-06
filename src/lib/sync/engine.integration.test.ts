import { enqueueMutation } from '@/lib/db/outbox';
import { syncHousehold } from '@/lib/sync/engine';
import { createServerClock } from '@/lib/sync/server-clock';
import { assertLocalSupabase, type Device, setupTwoDevices } from '../../../test/setup-two-devices';

/**
 * Zwei-Geraete-Konvergenztest der Sync-Engine (#47) — der eigentliche
 * Nachweis der Akzeptanzkriterien. Zwei echte lokale SQLite-Datenbanken, zwei
 * echte Supabase-Clients (dieselbe Nutzerin, zwei "Geraete"-Sessions),
 * gegen die echte lokale Supabase-Instanz. Kein Mock.
 *
 * `setupTwoDevices` ist nach `test/setup-two-devices.ts` ausgelagert — wird
 * auch von `realtime.integration.test.ts` (#48) gebraucht.
 */

async function sync(device: Device, householdId: string, now: () => number) {
  return syncHousehold({
    db: device.db,
    supabase: device.client,
    serverClock: createServerClock(),
    householdIds: [householdId],
    now,
  });
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

async function updateFridgeItemLocally(device: Device, id: string, name: string) {
  await enqueueMutation(device.db, {
    entity: 'fridge_items',
    entityId: id,
    op: 'update',
    payload: { id, name },
    applyLocally: (txn) =>
      txn
        .runAsync('update fridge_items set name = ?, _dirty = 1, updated_at = ? where id = ?', [
          name,
          Date.now(),
          id,
        ])
        .then(() => undefined),
  });
}

async function deleteFridgeItemLocally(device: Device, id: string) {
  await enqueueMutation(device.db, {
    entity: 'fridge_items',
    entityId: id,
    op: 'delete',
    payload: { id },
    applyLocally: (txn) =>
      txn
        .runAsync('update fridge_items set deleted_at = ?, _dirty = 1 where id = ?', [
          Date.now(),
          id,
        ])
        .then(() => undefined),
  });
}

async function nameOf(device: Device, id: string): Promise<string | undefined> {
  const row = await device.db.getFirstAsync<{ name: string }>(
    'select name from fridge_items where id = ?',
    [id],
  );
  return row?.name;
}

describe('syncHousehold — Zwei-Geraete-Konvergenz', () => {
  beforeAll(assertLocalSupabase);

  it('AC1: offline auf Geraet A erstellter Artikel erscheint nach Sync auf Geraet B', async () => {
    const { deviceA, deviceB, householdId } = await setupTwoDevices();
    const id = crypto.randomUUID();

    await insertFridgeItemLocally(deviceA, id, householdId, 'Von A offline erstellt');

    await sync(deviceA, householdId, () => 1000);
    await sync(deviceB, householdId, () => 2000);

    expect(await nameOf(deviceB, id)).toBe('Von A offline erstellt');
  }, 30_000);

  it('AC2: gleichzeitige Bearbeitung auf beiden Geraeten endet auf beiden im selben Zustand', async () => {
    const { deviceA, deviceB, householdId } = await setupTwoDevices();
    const id = crypto.randomUUID();

    // Ausgangszustand auf beiden Geraeten herstellen.
    await insertFridgeItemLocally(deviceA, id, householdId, 'Original');
    await sync(deviceA, householdId, () => 1000);
    await sync(deviceB, householdId, () => 1100);
    expect(await nameOf(deviceB, id)).toBe('Original');

    // Beide Geraete bearbeiten offline, unabhaengig voneinander.
    await updateFridgeItemLocally(deviceA, id, 'Von A');
    await updateFridgeItemLocally(deviceB, id, 'Von B');

    // A synct zuerst.
    await sync(deviceA, householdId, () => 2000);
    // B synct danach — B's push gewinnt serverseitig, da spaeter (LWW ueber
    // den server-vergebenen updated_at, nicht ueber die Client-Werte 2000/3000).
    await sync(deviceB, householdId, () => 3000);
    // A synct erneut, um B's spaetere Aenderung zu pullen.
    await sync(deviceA, householdId, () => 4000);

    const finalA = await nameOf(deviceA, id);
    const finalB = await nameOf(deviceB, id);
    expect(finalA).toBe(finalB);
    expect(finalA).toBe('Von B');
  }, 30_000);

  it('AC3: ein offline geloeschter Artikel bleibt nach dem Sync geloescht — auch bei unabhaengiger anstehender Aenderung auf dem anderen Geraet', async () => {
    const { deviceA, deviceB, householdId } = await setupTwoDevices();
    const id = crypto.randomUUID();
    const unrelatedId = crypto.randomUUID();

    await insertFridgeItemLocally(deviceA, id, householdId, 'Wird geloescht');
    await sync(deviceA, householdId, () => 1000);
    await sync(deviceB, householdId, () => 1100);

    // A loescht offline.
    await deleteFridgeItemLocally(deviceA, id);
    // B hat unabhaengig davon eine eigene, noch nicht gesyncte Aenderung an
    // einem ANDEREN Artikel ausstehen — darf A's Loeschung nicht blockieren.
    await insertFridgeItemLocally(deviceB, unrelatedId, householdId, 'B: unabhaengige Aenderung');

    await sync(deviceA, householdId, () => 2000);
    await sync(deviceB, householdId, () => 3000);

    const rowB = await deviceB.db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from fridge_items where id = ?',
      [id],
    );
    expect(rowB?.deleted_at).not.toBeNull();

    // B's unabhaengige Aenderung ist trotzdem angekommen.
    await sync(deviceA, householdId, () => 4000);
    expect(await nameOf(deviceA, unrelatedId)).toBe('B: unabhaengige Aenderung');
  }, 30_000);

  it('AC4: ein doppelter Sync-Lauf erzeugt keine Duplikate', async () => {
    const { deviceA, deviceB, householdId } = await setupTwoDevices();
    const id = crypto.randomUUID();

    await insertFridgeItemLocally(deviceA, id, householdId, 'Einmalig');
    await sync(deviceA, householdId, () => 1000);
    await sync(deviceB, householdId, () => 1100);

    // Zweiter Lauf auf beiden Geraeten, ohne dass sich etwas geaendert hat.
    await sync(deviceA, householdId, () => 2000);
    await sync(deviceB, householdId, () => 2100);

    const countA = await deviceA.db.getFirstAsync<{ c: number }>(
      'select count(*) as c from fridge_items where household_id = ?',
      [householdId],
    );
    const countB = await deviceB.db.getFirstAsync<{ c: number }>(
      'select count(*) as c from fridge_items where household_id = ?',
      [householdId],
    );
    // 3 Standard-Lagerorte sind storage_locations, nicht fridge_items — hier
    // zaehlt nur der eine angelegte Artikel.
    expect(countA?.c).toBe(1);
    expect(countB?.c).toBe(1);
  }, 30_000);
});
