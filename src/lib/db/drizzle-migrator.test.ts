import { DRIZZLE_BASELINE_NAME } from '@/lib/db/drizzle-baseline';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import localMigrations from '../../../drizzle/local/migrations';
import { createTestDatabase } from '../../../test/node-sqlite-adapter';

describe('Drizzle-Migrationsrunner', () => {
  it('baselined V1–V22 und führt danach alle Drizzle-Inkremente genau einmal aus', async () => {
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

  it('legt neue lokale Spiegel nach der festen V22-Baseline über Drizzle an', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);

    await runDrizzleMigrations(db);

    await expect(
      db.getFirstAsync<{ name: string }>(
        "select name from sqlite_schema where type = 'table' and name = 'recipe_step_images'",
      ),
    ).resolves.toEqual({ name: 'recipe_step_images' });
    await expect(
      db.getFirstAsync<{ name: string }>(
        "select name from sqlite_schema where type = 'index' and name = 'recipe_step_images_storage_path_idx'",
      ),
    ).resolves.toEqual({ name: 'recipe_step_images_storage_path_idx' });
    db.close();
  });

  it('übernimmt eine bereits auf das fehlerhafte Legacy-V23 angehobene Datenbank', async () => {
    const db = createTestDatabase();
    await runMigrations(db, MIGRATIONS);
    await db.execAsync(`
      create table recipe_step_images (
        id text primary key not null,
        step_id text not null,
        recipe_id text not null,
        household_id text not null,
        storage_path text not null,
        position integer not null default 0,
        created_at text,
        updated_at integer not null,
        deleted_at integer,
        _dirty integer not null default 0
      );
      create unique index recipe_step_images_storage_path_idx
        on recipe_step_images (storage_path);
      create index recipe_step_images_step_idx
        on recipe_step_images (step_id, position, deleted_at);
      create index recipe_step_images_recipe_idx
        on recipe_step_images (recipe_id, position, deleted_at);
      create index recipe_step_images_dirty_idx
        on recipe_step_images (_dirty) where _dirty = 1;
      pragma user_version = 23;
    `);

    await expect(runDrizzleMigrations(db)).resolves.toBe(
      Object.keys(localMigrations.migrations).length - 1,
    );
    await expect(runDrizzleMigrations(db)).resolves.toBe(0);
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
