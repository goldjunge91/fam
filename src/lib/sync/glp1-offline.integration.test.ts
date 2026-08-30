import { enqueueMutation } from '@/lib/db/outbox';
import { syncHousehold } from '@/lib/sync/engine';
import { applyLocalMirrorWrite, type LocalMirrorWriteOp } from '@/lib/sync/mirror-write';
import { createServerClock } from '@/lib/sync/server-clock';
import { assertLocalSupabase, type Device, setupTwoDevices } from '../../../test/setup-two-devices';

type Glp1LogEntity = 'medication_logs' | 'symptom_logs';

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

async function enqueueLogMutation(
  device: Device,
  entity: Glp1LogEntity,
  entityId: string,
  op: LocalMirrorWriteOp,
  payload: Record<string, unknown>,
  now: number,
) {
  await enqueueMutation(device.db, {
    entity,
    entityId,
    op,
    payload,
    now,
    applyLocally: (txn) => applyLocalMirrorWrite(txn, entity, op, payload, now),
  });
}

async function localLog<T>(device: Device, entity: Glp1LogEntity, id: string) {
  return device.db.getFirstAsync<T>(`select * from ${entity} where id = ?`, [id]);
}

describe('GLP-1-Outbox — Zwei-Geraete-Sync', () => {
  beforeAll(assertLocalSupabase);

  it('konvergiert Medikations- und Symptom-Logs ueber Create, Update, Delete, Restore und zweiten Pull', async () => {
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

    await enqueueLogMutation(
      deviceA,
      'medication_logs',
      medicationId,
      'insert',
      medicationPayload,
      1,
    );
    await enqueueLogMutation(deviceA, 'symptom_logs', symptomId, 'insert', symptomPayload, 2);

    expect(
      await deviceA.db.getFirstAsync('select id from medication_logs where id = ?', [medicationId]),
    ).toEqual({ id: medicationId });

    await sync(deviceA, householdId);
    await sync(deviceB, householdId);

    expect(await localLog<{ unit: string }>(deviceB, 'medication_logs', medicationId)).toEqual(
      expect.objectContaining({ unit: 'units' }),
    );
    expect(await localLog<{ side_effects: string }>(deviceB, 'symptom_logs', symptomId)).toEqual(
      expect.objectContaining({ side_effects: '["fatigue"]' }),
    );

    const medicationUpdate = {
      id: medicationId,
      dose: 6,
      unit: 'mg',
      injection_site: 'thigh',
      notes: 'auf Geraet B aktualisiert',
    };
    const symptomUpdate = {
      id: symptomId,
      appetite_level: 4,
      nausea_level: 3,
      side_effects: ['headache', 'fatigue'],
      notes: 'auf Geraet B aktualisiert',
    };

    await enqueueLogMutation(
      deviceB,
      'medication_logs',
      medicationId,
      'update',
      medicationUpdate,
      3,
    );
    await enqueueLogMutation(deviceB, 'symptom_logs', symptomId, 'update', symptomUpdate, 4);
    await sync(deviceB, householdId);
    await sync(deviceA, householdId);

    expect(
      await localLog<{ dose: number; injection_site: string; notes: string; unit: string }>(
        deviceA,
        'medication_logs',
        medicationId,
      ),
    ).toEqual(
      expect.objectContaining({
        dose: 6,
        injection_site: 'thigh',
        notes: 'auf Geraet B aktualisiert',
        unit: 'mg',
      }),
    );
    expect(
      await localLog<{
        appetite_level: number;
        nausea_level: number;
        notes: string;
        side_effects: string;
      }>(deviceA, 'symptom_logs', symptomId),
    ).toEqual(
      expect.objectContaining({
        appetite_level: 4,
        nausea_level: 3,
        notes: 'auf Geraet B aktualisiert',
        side_effects: '["headache","fatigue"]',
      }),
    );

    await enqueueLogMutation(
      deviceA,
      'medication_logs',
      medicationId,
      'delete',
      { id: medicationId },
      5,
    );
    await enqueueLogMutation(deviceA, 'symptom_logs', symptomId, 'delete', { id: symptomId }, 6);
    await sync(deviceA, householdId);
    await sync(deviceB, householdId);

    expect(
      await localLog<{ deleted_at: number | null }>(deviceB, 'medication_logs', medicationId),
    ).toEqual(expect.objectContaining({ deleted_at: expect.any(Number) }));
    expect(
      await localLog<{ deleted_at: number | null }>(deviceB, 'symptom_logs', symptomId),
    ).toEqual(expect.objectContaining({ deleted_at: expect.any(Number) }));

    await enqueueLogMutation(
      deviceB,
      'medication_logs',
      medicationId,
      'restore',
      { id: medicationId },
      7,
    );
    await enqueueLogMutation(deviceB, 'symptom_logs', symptomId, 'restore', { id: symptomId }, 8);
    await sync(deviceB, householdId);
    await sync(deviceA, householdId);

    expect(
      await localLog<{ deleted_at: number | null; notes: string }>(
        deviceA,
        'medication_logs',
        medicationId,
      ),
    ).toEqual(expect.objectContaining({ deleted_at: null, notes: 'auf Geraet B aktualisiert' }));
    expect(
      await localLog<{ deleted_at: number | null; notes: string }>(
        deviceA,
        'symptom_logs',
        symptomId,
      ),
    ).toEqual(expect.objectContaining({ deleted_at: null, notes: 'auf Geraet B aktualisiert' }));

    const secondPull = await sync(deviceA, householdId);
    expect(secondPull.pull.find(({ entity }) => entity === 'medication_logs')).toEqual(
      expect.objectContaining({ rowsWritten: 0 }),
    );
    expect(secondPull.pull.find(({ entity }) => entity === 'symptom_logs')).toEqual(
      expect.objectContaining({ rowsWritten: 0 }),
    );
    expect(
      await deviceA.db.getFirstAsync<{ count: number }>(
        'select count(*) as count from medication_logs',
      ),
    ).toEqual({ count: 1 });
    expect(
      await deviceA.db.getFirstAsync<{ count: number }>(
        'select count(*) as count from symptom_logs',
      ),
    ).toEqual({ count: 1 });
  }, 90_000);
});
