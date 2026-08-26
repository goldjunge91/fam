import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  DRIZZLE_BASELINE_FINGERPRINT,
  DRIZZLE_BASELINE_META_KEY,
  DRIZZLE_BASELINE_NAME,
  ensureDrizzleBaseline,
  readLocalSchemaFingerprint,
  readLocalSchemaShape,
} from '@/lib/db/drizzle-baseline';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { createTestDatabase } from '../../../test/node-sqlite-adapter';

describe('Drizzle-Baseline', () => {
  it('erkennt die vollständige alte Migrationskette über einen stabilen Fingerprint', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    expect(await readLocalSchemaFingerprint(db)).toBe(DRIZZLE_BASELINE_FINGERPRINT);
    db.close();
  });

  it('markiert die Startmigration genau einmal, ohne sie erneut auszuführen', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    await expect(ensureDrizzleBaseline(db)).resolves.toBeUndefined();
    await expect(ensureDrizzleBaseline(db)).resolves.toBeUndefined();

    const rows = await db.getAllAsync<{ name: string }>('select name from __drizzle_migrations');
    expect(rows).toEqual([{ name: DRIZZLE_BASELINE_NAME }]);
    await expect(
      db.getFirstAsync<{ value: string }>('select value from app_meta where key = ?', [
        DRIZZLE_BASELINE_META_KEY,
      ]),
    ).resolves.toEqual({
      value: `${DRIZZLE_BASELINE_NAME}:${DRIZZLE_BASELINE_FINGERPRINT}`,
    });
    db.close();
  });

  it('verweigert die Markierung bei Schema-Drift und hinterlässt keinen Marker', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await db.execAsync('drop index products_barcode_idx');

    await expect(ensureDrizzleBaseline(db)).rejects.toThrow(/passt nicht/);
    await expect(
      db.getFirstAsync("select name from sqlite_schema where name = '__drizzle_migrations'"),
    ).resolves.toBeNull();
    db.close();
  });

  it('erzeugt mit der gebündelten Startmigration dieselbe strukturelle Form', async () => {
    const legacy = createTestDatabase();
    await runMigrations(legacy, MIGRATIONS);

    const drizzle = createTestDatabase();
    const migration = readFileSync(
      join(process.cwd(), 'drizzle/local/20260826200344_worthless_celestials/migration.sql'),
      'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')) {
      await drizzle.execAsync(statement);
    }

    expect(await readLocalSchemaShape(drizzle)).toBe(await readLocalSchemaShape(legacy));
    await expect(
      drizzle.runAsync('insert into households (id, name, updated_at) values (?, ?, ?)', [
        null,
        'Unzulässig',
        1,
      ]),
    ).rejects.toThrow();
    drizzle.close();
    legacy.close();
  });
});
