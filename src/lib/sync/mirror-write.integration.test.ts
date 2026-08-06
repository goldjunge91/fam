import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { toEpochMs } from '@/lib/sync/cursor';
import { applyRemoteRow, deleteMirrorRow, upsertMirrorRow } from '@/lib/sync/mirror-write';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

describe('upsertMirrorRow', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('schreibt eine neue storage_locations-Zeile mit korrekten Typen', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-1',
        household_id: 'hh-1',
        name: 'Kühlschrank',
        kind: 'fridge',
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00.123456+00:00',
        deleted_at: null,
      },
      { dirty: 0 },
    );

    const row = await db.getFirstAsync<{
      id: string;
      household_id: string;
      name: string;
      updated_at: number;
      deleted_at: number | null;
      _dirty: number;
    }>('select * from storage_locations where id = ?', ['loc-1']);

    expect(row?.id).toBe('loc-1');
    expect(row?.household_id).toBe('hh-1');
    expect(row?.name).toBe('Kühlschrank');
    expect(typeof row?.updated_at).toBe('number');
    expect(row?.updated_at).toBe(toEpochMs('2024-01-15T10:30:00.123456+00:00'));
    expect(row?.deleted_at).toBeNull();
    expect(row?._dirty).toBe(0);
  });

  it('schreibt einen Tombstone als epoch ms', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-2',
        household_id: 'hh-1',
        name: 'Vorratsschrank',
        kind: 'pantry',
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        deleted_at: '2024-01-16T00:00:00Z',
      },
      { dirty: 0 },
    );

    const row = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from storage_locations where id = ?',
      ['loc-2'],
    );
    expect(row?.deleted_at).toBe(toEpochMs('2024-01-16T00:00:00Z'));
  });

  it('products.deleted_at bleibt immer null, auch wenn die Remote-Zeile einen Wert liefert', async () => {
    await upsertMirrorRow(
      db,
      'products',
      {
        id: 'prod-1',
        barcode: '123',
        name: 'Testprodukt',
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        // products hat serverseitig gar kein deleted_at — dieser Test simuliert
        // trotzdem den fehlerhaften Fall, dass ein Aufrufer einen Wert liefert.
        deleted_at: '2024-01-16T00:00:00Z',
      },
      { dirty: 0 },
    );

    const row = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from products where id = ?',
      ['prod-1'],
    );
    expect(row?.deleted_at).toBeNull();
  });

  it('ist ein upsert: ein zweiter Aufruf mit derselben id aktualisiert die Zeile', async () => {
    const base = {
      id: 'loc-3',
      household_id: 'hh-1',
      kind: 'fridge',
      sort_order: 0,
      created_at: '2024-01-01T00:00:00Z',
    };

    await upsertMirrorRow(
      db,
      'storage_locations',
      { ...base, name: 'Alter Name', updated_at: '2024-01-15T10:00:00Z', deleted_at: null },
      { dirty: 0 },
    );
    await upsertMirrorRow(
      db,
      'storage_locations',
      { ...base, name: 'Neuer Name', updated_at: '2024-01-15T11:00:00Z', deleted_at: null },
      { dirty: 0 },
    );

    const rows = await db.getAllAsync<{ id: string }>(
      'select id from storage_locations where id = ?',
      ['loc-3'],
    );
    expect(rows).toHaveLength(1);

    const row = await db.getFirstAsync<{ name: string; updated_at: number }>(
      'select name, updated_at from storage_locations where id = ?',
      ['loc-3'],
    );
    expect(row?.name).toBe('Neuer Name');
    expect(row?.updated_at).toBe(toEpochMs('2024-01-15T11:00:00Z'));
  });

  it('setzt _dirty gemaess der uebergebenen Option', async () => {
    await upsertMirrorRow(
      db,
      'storage_locations',
      {
        id: 'loc-4',
        household_id: 'hh-1',
        name: 'X',
        kind: 'fridge',
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:30:00Z',
        deleted_at: null,
      },
      { dirty: 1 },
    );

    const row = await db.getFirstAsync<{ _dirty: number }>(
      'select _dirty from storage_locations where id = ?',
      ['loc-4'],
    );
    expect(row?._dirty).toBe(1);
  });

  it('wirft, wenn updated_at kein String ist', async () => {
    await expect(
      upsertMirrorRow(
        db,
        'storage_locations',
        {
          id: 'loc-5',
          household_id: 'hh-1',
          name: 'X',
          kind: 'fridge',
          sort_order: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: null,
          deleted_at: null,
        },
        { dirty: 0 },
      ),
    ).rejects.toThrow(/updated_at/);
  });
});

describe('applyRemoteRow', () => {
  let db: TestDatabase;

  const remoteRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
    id: 'loc-remote-1',
    household_id: 'hh-1',
    name: 'Kühlschrank',
    kind: 'fridge',
    sort_order: 0,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T12:00:00Z',
    deleted_at: null,
    ...overrides,
  });

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it("schreibt eine neue Zeile ohne resolve() aufzurufen (kein lokales Gegenstueck), gibt 'written' zurueck", async () => {
    const result = await applyRemoteRow(db, 'storage_locations', remoteRow(), Date.now());
    expect(result).toBe('written');

    const row = await db.getFirstAsync<{ name: string }>(
      'select name from storage_locations where id = ?',
      ['loc-remote-1'],
    );
    expect(row?.name).toBe('Kühlschrank');
  });

  it("ueberschreibt eine lokale, nicht-dirty Zeile kampflos, gibt 'written' zurueck", async () => {
    await upsertMirrorRow(db, 'storage_locations', remoteRow({ name: 'Alt' }), { dirty: 0 });

    const result = await applyRemoteRow(
      db,
      'storage_locations',
      remoteRow({ name: 'Neu', updated_at: '2024-01-15T13:00:00Z' }),
      Date.now(),
    );
    expect(result).toBe('written');

    const row = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from storage_locations where id = ?',
      ['loc-remote-1'],
    );
    expect(row?.name).toBe('Neu');
    expect(row?._dirty).toBe(0);
  });

  it("bei dirty lokal + neuerer Remote-Zeile gewinnt remote via resolve(), gibt 'written' zurueck", async () => {
    // Lokale, noch nicht gepushte Aenderung — aelter als die eingehende Remote-Zeile.
    await db.runAsync(
      `insert into storage_locations
         (id, household_id, name, kind, sort_order, updated_at, deleted_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, 1)`,
      ['loc-remote-1', 'hh-1', 'Lokal dirty', 'fridge', 0, toEpochMs('2024-01-15T10:00:00Z'), null],
    );

    const result = await applyRemoteRow(
      db,
      'storage_locations',
      remoteRow({ name: 'Von remote', updated_at: '2024-01-15T12:00:00Z' }),
      Date.now(),
    );
    expect(result).toBe('written');

    const row = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from storage_locations where id = ?',
      ['loc-remote-1'],
    );
    expect(row?.name).toBe('Von remote');
    expect(row?._dirty).toBe(0);
  });

  it("bei dirty lokal + aelterer Remote-Zeile gewinnt lokal via resolve(), gibt 'local-wins' zurueck und laesst die Zeile unangetastet", async () => {
    await db.runAsync(
      `insert into storage_locations
         (id, household_id, name, kind, sort_order, updated_at, deleted_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        'loc-remote-1',
        'hh-1',
        'Lokal dirty, neuer',
        'fridge',
        0,
        toEpochMs('2024-01-15T14:00:00Z'),
        null,
      ],
    );

    const result = await applyRemoteRow(
      db,
      'storage_locations',
      remoteRow({ name: 'Von remote, aelter', updated_at: '2024-01-15T12:00:00Z' }),
      Date.now(),
    );
    expect(result).toBe('local-wins');

    const row = await db.getFirstAsync<{ name: string; _dirty: number }>(
      'select name, _dirty from storage_locations where id = ?',
      ['loc-remote-1'],
    );
    expect(row?.name).toBe('Lokal dirty, neuer');
    expect(row?._dirty).toBe(1);
  });

  it('ein Remote-Tombstone schlaegt ein dirty lokales Update, unabhaengig vom Zeitstempel', async () => {
    await db.runAsync(
      `insert into storage_locations
         (id, household_id, name, kind, sort_order, updated_at, deleted_at, _dirty)
       values (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        'loc-remote-1',
        'hh-1',
        'Lokal bearbeitet, neuer',
        'fridge',
        0,
        toEpochMs('2024-01-15T15:00:00Z'),
        null,
      ],
    );

    const result = await applyRemoteRow(
      db,
      'storage_locations',
      remoteRow({ updated_at: '2024-01-15T12:00:00Z', deleted_at: '2024-01-15T12:00:00Z' }),
      Date.now(),
    );
    expect(result).toBe('written');

    const row = await db.getFirstAsync<{ deleted_at: number | null }>(
      'select deleted_at from storage_locations where id = ?',
      ['loc-remote-1'],
    );
    expect(row?.deleted_at).not.toBeNull();
  });
});

describe('deleteMirrorRow', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it('entfernt eine bestehende Zeile hart', async () => {
    await upsertMirrorRow(
      db,
      'fridge_items',
      {
        id: 'fi-1',
        household_id: 'hh-1',
        name: 'Milch',
        quantity: 1,
        unit: 'piece',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        deleted_at: null,
      },
      { dirty: 0 },
    );

    await deleteMirrorRow(db, 'fridge_items', 'fi-1');

    const row = await db.getFirstAsync('select id from fridge_items where id = ?', ['fi-1']);
    expect(row).toBeNull();
  });

  it('ist ein No-Op, wenn keine Zeile mit dieser id existiert', async () => {
    await expect(deleteMirrorRow(db, 'fridge_items', 'nicht-vorhanden')).resolves.toBeUndefined();
  });
});
