import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

type ColumnInfo = {
  name: string;
  notnull: number;
  dflt_value: string | null;
};

type IndexInfo = { name: string };

async function columnsOf(db: TestDatabase, table: string): Promise<ColumnInfo[]> {
  return db.getAllAsync<ColumnInfo>(`pragma table_info(${table})`);
}

describe('GLP-1-Spiegelmigration', () => {
  it('legt Medikations- und Symptom-Logs mit allen Serverfeldern und JSON-Default an', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    try {
      await runDrizzleMigrations(db);

      const medicationColumns = await columnsOf(db, 'medication_logs');
      const symptomColumns = await columnsOf(db, 'symptom_logs');

      expect(medicationColumns.map(({ name }) => name)).toEqual([
        'id',
        'user_id',
        'child_profile_id',
        'medication_name',
        'dose',
        'unit',
        'injection_site',
        'administered_at',
        'notes',
        'created_at',
        'updated_at',
        'deleted_at',
        '_dirty',
      ]);
      expect(symptomColumns.map(({ name }) => name)).toEqual([
        'id',
        'user_id',
        'child_profile_id',
        'logged_at',
        'appetite_level',
        'satiety_level',
        'nausea_level',
        'side_effects',
        'notes',
        'created_at',
        'updated_at',
        'deleted_at',
        '_dirty',
      ]);

      const sideEffects = symptomColumns.find(({ name }) => name === 'side_effects');
      expect(sideEffects).toMatchObject({ notnull: 1, dflt_value: "'[]'" });

      const medicationIndexes = await db.getAllAsync<IndexInfo>(
        'select name from pragma_index_list(?)',
        ['medication_logs'],
      );
      const symptomIndexes = await db.getAllAsync<IndexInfo>(
        'select name from pragma_index_list(?)',
        ['symptom_logs'],
      );
      expect(medicationIndexes.map(({ name }) => name)).toEqual(
        expect.arrayContaining(['medication_logs_user_time_idx', 'medication_logs_dirty_idx']),
      );
      expect(symptomIndexes.map(({ name }) => name)).toEqual(
        expect.arrayContaining(['symptom_logs_user_time_idx', 'symptom_logs_dirty_idx']),
      );
    } finally {
      db.close();
    }
  });
});
