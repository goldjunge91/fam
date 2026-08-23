import { ALL_ENTITIES, ENTITIES, metaOf } from '@/lib/db/entities';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase, type TestDatabase } from '../../../test/node-sqlite-adapter';

type ColumnInfo = { name: string };

async function columnNamesOf(db: TestDatabase, table: string): Promise<string[]> {
  const rows = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${table})`);
  return rows.map((r) => r.name);
}

describe('entities.ts gegen das echte migrierte Schema', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
  });

  afterEach(() => {
    db.close();
  });

  it.each(ALL_ENTITIES)('jede Spalte von %s existiert wirklich in der Tabelle', async (entity) => {
    const meta = metaOf(entity);
    const realColumns = await columnNamesOf(db, meta.table);

    for (const column of meta.columns) {
      expect(realColumns).toContain(column);
    }
  });

  it.each(ALL_ENTITIES)(
    'die Tabelle %s hat keine Nicht-Sync-Spalte, die entities.ts nicht kennt',
    async (entity) => {
      const meta = metaOf(entity);
      const realColumns = await columnNamesOf(db, meta.table);
      const syncColumns = ['updated_at', 'deleted_at', '_dirty'];
      const realNonSyncColumns = realColumns.filter((c) => !syncColumns.includes(c));

      expect(new Set(realNonSyncColumns)).toEqual(new Set(meta.columns));
    },
  );

  it('households: jede Spalte aus entities.ts existiert wirklich, keine unbekannte Nicht-Sync-Spalte', async () => {
    const meta = ENTITIES.households;
    const realColumns = await columnNamesOf(db, meta.table);

    for (const column of meta.columns) {
      expect(realColumns).toContain(column);
    }

    const syncColumns = ['updated_at', 'deleted_at', '_dirty'];
    const realNonSyncColumns = realColumns.filter((c) => !syncColumns.includes(c));
    expect(new Set(realNonSyncColumns)).toEqual(new Set(meta.columns));
  });
});
