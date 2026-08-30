import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

type ColumnInfo = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
};

async function columnsOf(db: TestDatabase): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>('pragma table_info(injection_plans)');
}

describe('lokales Injektionsplan-Schema', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await runDrizzleMigrations(db);
  });

  afterEach(() => {
    db.close();
  });

  it('spiegelt den privaten Planvertrag ohne Kindprofil-Spalte', async () => {
    const columns = await columnsOf(db);

    expect(columns.map(({ name }) => name)).toEqual([
      'id',
      'user_id',
      'medication_name',
      'dose',
      'unit',
      'cadence_days',
      'anchor_at',
      'reminder_enabled',
      'created_at',
      'updated_at',
    ]);
    expect(columns.find(({ name }) => name === 'child_profile_id')).toBeUndefined();
    expect(columns.find(({ name }) => name === 'reminder_enabled')).toMatchObject({
      notnull: 1,
      dflt_value: 'true',
    });
  });

  it('erzwingt positive Kadenz und den gemeinsamen Einheitenvertrag lokal', async () => {
    const insert = (unit: string, cadenceDays: number) =>
      db.runAsync(
        `insert into injection_plans
           (id, user_id, medication_name, dose, unit, cadence_days, anchor_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
        ['plan-1', 'user-1', 'Semaglutid', 0.5, unit, cadenceDays, '2026-08-31T08:00:00.000Z'],
      );

    await expect(insert('drops', 7)).rejects.toThrow();
    await expect(insert('mg', 0)).rejects.toThrow();
  });

  it('behält pro Nutzer höchstens einen Plan', async () => {
    const insert = (id: string) =>
      db.runAsync(
        `insert into injection_plans
           (id, user_id, medication_name, dose, unit, cadence_days, anchor_at)
         values (?, ?, ?, ?, ?, ?, ?)`,
        [id, 'user-1', 'Semaglutid', 0.5, 'mg', 7, '2026-08-31T08:00:00.000Z'],
      );

    await insert('plan-1');
    await expect(insert('plan-2')).rejects.toThrow();
  });
});
