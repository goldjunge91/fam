import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

/**
 * Die zweite Verteidigungslinie gegen fremde Haushaltsdaten auf demselben
 * Geraet — gegen eine echte SQLite-Engine, mit dem echten Schema.
 *
 * Das Verwerfen selbst ist ein Callback, weil `client.ts` es innerhalb seines
 * Oeffnungs-Mutex ausfuehren muss. Hier steht an seiner Stelle eine zweite
 * echte Datenbank: derselbe Effekt (die alten Zeilen sind weg), ohne
 * `expo-sqlite`.
 */
async function freshDatabase(): Promise<TestDatabase> {
  const db = createTestDatabase();
  await runMigrations(db, MIGRATIONS);
  return db;
}

async function readOwner(db: TestDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'select value from app_meta where key = ?',
    ['user_id'],
  );
  return row?.value ?? null;
}

describe('ensureDatabaseBelongsTo', () => {
  let db: TestDatabase;
  let wiped: TestDatabase | null;
  let wipeCount: number;

  const wipeAndReopen = async () => {
    wipeCount += 1;
    wiped = await freshDatabase();
    return wiped;
  };

  beforeEach(async () => {
    db = await freshDatabase();
    wiped = null;
    wipeCount = 0;
  });

  afterEach(() => {
    db.close();
    wiped?.close();
  });

  it('verwirft die Datenbank, wenn sie einem anderen Nutzer gehoert', async () => {
    await db.runAsync('insert into app_meta (key, value) values (?, ?)', ['user_id', 'user-a']);
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
      ['loc-a', 'hh-a', 'Kühlschrank von A', 'fridge', 1000],
    );

    const result = await ensureDatabaseBelongsTo(db, 'user-b', wipeAndReopen);

    expect(wipeCount).toBe(1);
    expect(result).toBe(wiped);

    // Die Daten des Vornutzers sind weg, und die neue Datei gehoert user-b.
    const leftovers = await result.getAllAsync('select id from storage_locations');
    expect(leftovers).toHaveLength(0);
    expect(await readOwner(result as TestDatabase)).toBe('user-b');
  });

  it('laesst die Datenbank stehen, wenn sie bereits dem Nutzer gehoert', async () => {
    await db.runAsync('insert into app_meta (key, value) values (?, ?)', ['user_id', 'user-a']);
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
      ['loc-a', 'hh-a', 'Kühlschrank von A', 'fridge', 1000],
    );

    const result = await ensureDatabaseBelongsTo(db, 'user-a', wipeAndReopen);

    expect(wipeCount).toBe(0);
    expect(result).toBe(db);
    expect(await db.getAllAsync('select id from storage_locations')).toHaveLength(1);
  });

  it('uebernimmt eine frische Datenbank ohne Eintrag, statt sie wegzuwerfen', async () => {
    // Kein `user_id` in app_meta: Erstinstallation, oder eine Datei aus der
    // Zeit vor dieser Pruefung. Ein Wipe wuerde hier die Daten des
    // rechtmaessigen Nutzers loeschen.
    await db.runAsync(
      'insert into storage_locations (id, household_id, name, kind, updated_at) values (?, ?, ?, ?, ?)',
      ['loc-a', 'hh-a', 'Kühlschrank', 'fridge', 1000],
    );

    const result = await ensureDatabaseBelongsTo(db, 'user-a', wipeAndReopen);

    expect(wipeCount).toBe(0);
    expect(result).toBe(db);
    expect(await readOwner(db)).toBe('user-a');
    expect(await db.getAllAsync('select id from storage_locations')).toHaveLength(1);
  });

  it('ist beim zweiten Aufruf mit demselben Nutzer wirkungslos', async () => {
    await ensureDatabaseBelongsTo(db, 'user-a', wipeAndReopen);
    const result = await ensureDatabaseBelongsTo(db, 'user-a', wipeAndReopen);

    expect(wipeCount).toBe(0);
    expect(result).toBe(db);
    expect(await readOwner(db)).toBe('user-a');
  });
});
