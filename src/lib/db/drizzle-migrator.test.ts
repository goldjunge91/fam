import {
  DRIZZLE_BASELINE_NAME,
  DRIZZLE_MIGRATIONS_TABLE,
  hashMigrationSource,
} from '@/lib/db/drizzle-baseline';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import localMigrations from '../../../drizzle/local/migrations';
import { createTestDatabase } from '../../../test/node-sqlite-adapter';

describe('Drizzle-Migrationsrunner', () => {
  it('behandelt exakt gleichen Migrationsnamen und Hash idempotent', async () => {
    const db = createTestDatabase();
    const source = 'create table exact_hash (id text primary key)';
    const bundle = { migrations: { [DRIZZLE_BASELINE_NAME]: source } };

    await expect(runDrizzleMigrations(db, bundle)).resolves.toBe(1);
    await expect(
      db.getFirstAsync<{ name: string; hash: string }>(
        `select name, hash from ${DRIZZLE_MIGRATIONS_TABLE}`,
      ),
    ).resolves.toEqual({
      name: DRIZZLE_BASELINE_NAME,
      hash: hashMigrationSource(source),
    });
    await expect(runDrizzleMigrations(db, bundle)).resolves.toBe(0);

    db.close();
  });

  it('weist eine bereits gespeicherte Migration mit abweichendem Hash zurück', async () => {
    const db = createTestDatabase();
    const bundle = {
      migrations: { [DRIZZLE_BASELINE_NAME]: 'create table hash_mismatch (id text primary key)' },
    };

    await runDrizzleMigrations(db, bundle);

    await expect(
      runDrizzleMigrations(db, {
        migrations: {
          [DRIZZLE_BASELINE_NAME]:
            'create table hash_mismatch (id text primary key, label text not null)',
        },
      }),
    ).rejects.toThrow(/Hash/i);

    db.close();
  });

  it('weist gespeicherte Migrationen zurück, die im Bundle unbekannt sind', async () => {
    const db = createTestDatabase();
    const source = 'create table unknown_migration (id text primary key)';
    const bundle = { migrations: { [DRIZZLE_BASELINE_NAME]: source } };

    await runDrizzleMigrations(db, bundle);
    await db.runAsync(
      `insert into ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at, name, applied_at)
       values (?, ?, ?, ?)`,
      ['unknown-hash', 0, '20260909070000_unknown', '2026-09-09T07:00:00.000Z'],
    );

    await expect(runDrizzleMigrations(db, bundle)).rejects.toThrow(/unbekannt/i);

    db.close();
  });

  it('weist doppelte Metadaten für eine Migration zurück', async () => {
    const db = createTestDatabase();
    const source = 'create table duplicate_metadata (id text primary key)';
    const bundle = { migrations: { [DRIZZLE_BASELINE_NAME]: source } };

    await runDrizzleMigrations(db, bundle);
    await db.runAsync(
      `insert into ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at, name, applied_at)
       values (?, ?, ?, ?)`,
      [hashMigrationSource(source), 0, DRIZZLE_BASELINE_NAME, '2026-09-09T07:00:00.000Z'],
    );

    await expect(runDrizzleMigrations(db, bundle)).rejects.toThrow(/doppelt/i);

    db.close();
  });

  it('legt die gebündelte Vollbaseline auf einer frischen Datenbank genau einmal an', async () => {
    const db = createTestDatabase();

    await expect(runDrizzleMigrations(db)).resolves.toBe(1);
    await expect(runDrizzleMigrations(db)).resolves.toBe(0);

    const migrationNames = await db.getAllAsync<{ name: string }>(
      `select name from ${DRIZZLE_MIGRATIONS_TABLE} order by name`,
    );
    expect(migrationNames.map((row) => row.name)).toEqual(
      Object.keys(localMigrations.migrations).sort(),
    );
    expect(migrationNames).toEqual([{ name: DRIZZLE_BASELINE_NAME }]);
    await expect(
      db.getFirstAsync<{ name: string }>(
        `select name from sqlite_schema where name = 'fridge_items'`,
      ),
    ).resolves.toEqual({ name: 'fridge_items' });

    db.close();
  });

  it('führt die gebündelte Baseline auf einer frischen Datenbank atomar aus', async () => {
    const db = createTestDatabase();
    const brokenBaseline = {
      migrations: {
        [DRIZZLE_BASELINE_NAME]:
          'create table should_rollback (id text primary key)\n--> statement-breakpoint\nnot valid sql',
      },
    };

    await expect(runDrizzleMigrations(db, brokenBaseline)).rejects.toThrow();
    await expect(
      db.getFirstAsync("select name from sqlite_schema where name = 'should_rollback'"),
    ).resolves.toBeNull();
    await expect(
      db.getFirstAsync(`select name from sqlite_schema where name = '${DRIZZLE_MIGRATIONS_TABLE}'`),
    ).resolves.toBeNull();

    db.close();
  });

  it('weist ein Bundle ohne die festgelegte Baseline vor jedem Schreibzugriff zurück', async () => {
    const db = createTestDatabase();
    const missingBaseline = {
      migrations: {
        '20260909060454_only_increment': 'create table should_not_apply (id text primary key)',
      },
    };

    await expect(runDrizzleMigrations(db, missingBaseline)).rejects.toThrow(/Baseline/);
    await expect(
      db.getFirstAsync(`select name from sqlite_schema where name = '${DRIZZLE_MIGRATIONS_TABLE}'`),
    ).resolves.toBeNull();
    await expect(
      db.getFirstAsync("select name from sqlite_schema where name = 'should_not_apply'"),
    ).resolves.toBeNull();

    db.close();
  });

  it('bewahrt die Constraints des gebündelten lokalen Schemas', async () => {
    const db = createTestDatabase();
    await runDrizzleMigrations(db);

    await db.runAsync(
      `insert into local_recipe_preferences
         (user_id, recipe_key, is_favorite, rating, note, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      ['alice', 'recipe:1', 1, 9, 'Alice', 1],
    );
    await db.runAsync(
      `insert into local_recipe_preferences
         (user_id, recipe_key, is_favorite, rating, note, updated_at)
       values (?, ?, ?, ?, ?, ?)`,
      ['bob', 'recipe:1', 0, 4, 'Bob', 1],
    );

    await expect(
      db.getAllAsync<{ user_id: string; note: string }>(
        'select user_id, note from local_recipe_preferences order by user_id',
      ),
    ).resolves.toEqual([
      { user_id: 'alice', note: 'Alice' },
      { user_id: 'bob', note: 'Bob' },
    ]);
    await expect(
      db.runAsync(
        `insert into local_recipe_preferences
           (user_id, recipe_key, is_favorite, rating, updated_at)
         values (?, ?, ?, ?, ?)`,
        ['alice', 'recipe:2', 1, 11, 1],
      ),
    ).rejects.toThrow();

    db.close();
  });
});
