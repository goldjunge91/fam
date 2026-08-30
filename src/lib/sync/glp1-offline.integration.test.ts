import { enqueueMutation } from '@/lib/db/outbox';
import { syncHousehold } from '@/lib/sync/engine';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';
import { createServerClock } from '@/lib/sync/server-clock';
import { assertLocalSupabase, type Device, setupTwoDevices } from '../../../test/setup-two-devices';

let teardowns: Array<() => Promise<void>> = [];

afterEach(async () => {
  for (const teardown of teardowns) await teardown();
  teardowns = [];
});

async function sync(device: Device, householdId: string) {
  return syncHousehold({
    db: device.db,
    supabase: device.client,
    serverClock: createServerClock(),
    householdIds: [householdId],
  });
}

describe('GLP-1-Outbox — Zwei-Geraete-Sync', () => {
  beforeAll(assertLocalSupabase);

  it('macht offline erfasste Medikations- und Symptom-Logs auf dem zweiten Geraet sichtbar', async () => {
    const { deviceA, deviceB, householdId, teardown } = await setupTwoDevices('glp1-offline');
    teardowns.push(teardown);
    const { data } = await deviceA.client.auth.getUser();
    const userId = data.user?.id;
    if (!userId) throw new Error('Testnutzer fehlt.');

    const medicationId = crypto.randomUUID();
    const symptomId = crypto.randomUUID();
    const medicationPayload = {
      id: medicationId,
      user_id: userId,
      child_profile_id: null,
      medication_name: 'Insulin',
      dose: 4,
      unit: 'units',
      injection_site: 'abdomen',
      administered_at: '2026-08-30T10:00:00.000Z',
      notes: 'offline',
      created_at: '2026-08-30T10:00:00.000Z',
    };
    const symptomPayload = {
      id: symptomId,
      user_id: userId,
      child_profile_id: null,
      logged_at: '2026-08-30T11:00:00.000Z',
      appetite_level: 2,
      satiety_level: 4,
      nausea_level: 1,
      side_effects: ['fatigue'],
      notes: 'offline',
      created_at: '2026-08-30T11:00:00.000Z',
    };

    await enqueueMutation(deviceA.db, {
      entity: 'medication_logs',
      entityId: medicationId,
      op: 'insert',
      payload: medicationPayload,
      now: 1,
      applyLocally: (txn) =>
        applyLocalMirrorWrite(txn, 'medication_logs', 'insert', medicationPayload, 1),
    });
    await enqueueMutation(deviceA.db, {
      entity: 'symptom_logs',
      entityId: symptomId,
      op: 'insert',
      payload: symptomPayload,
      now: 2,
      applyLocally: (txn) =>
        applyLocalMirrorWrite(txn, 'symptom_logs', 'insert', symptomPayload, 2),
    });

    expect(
      await deviceA.db.getFirstAsync('select id from medication_logs where id = ?', [medicationId]),
    ).toEqual({ id: medicationId });

    await sync(deviceA, householdId);
    await sync(deviceB, householdId);

    expect(
      await deviceB.db.getFirstAsync<{ unit: string }>(
        'select unit from medication_logs where id = ?',
        [medicationId],
      ),
    ).toEqual({ unit: 'units' });
    expect(
      await deviceB.db.getFirstAsync<{ side_effects: string }>(
        'select side_effects from symptom_logs where id = ?',
        [symptomId],
      ),
    ).toEqual({ side_effects: '["fatigue"]' });
  }, 45_000);
});
