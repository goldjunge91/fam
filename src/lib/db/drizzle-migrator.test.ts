import { DRIZZLE_BASELINE_NAME } from '@/lib/db/drizzle-baseline';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import localMigrations from '../../../drizzle/local/migrations';
import { createTestDatabase } from '../../../test/node-sqlite-adapter';

describe('Drizzle-Migrationsrunner', () => {
  it('baselined V1–V21 und führt danach alle Drizzle-Inkremente genau einmal aus', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    await expect(runDrizzleMigrations(db)).resolves.toBe(
      Object.keys(localMigrations.migrations).length - 1,
    );
    await expect(runDrizzleMigrations(db)).resolves.toBe(0);

    const migrationNames = await db.getAllAsync<{ name: string }>(
      'select name from __drizzle_migrations order by name',
    );
    expect(migrationNames.map((row) => row.name)).toEqual(
      Object.keys(localMigrations.migrations).sort(),
    );
    expect(migrationNames[0]?.name).toBe(DRIZZLE_BASELINE_NAME);
    db.close();
  });

  it('trennt lokale Rezeptpräferenzen nach user_id und erzwingt ihre Constraints', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
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

  it('lehnt ein Bundle ohne die festgelegte Baseline ab', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    await expect(
      runDrizzleMigrations(db, {
        migrations: { '20260826194537_only_increment': 'select 1' },
      }),
    ).rejects.toThrow(/Baseline/);
    db.close();
  });
});
