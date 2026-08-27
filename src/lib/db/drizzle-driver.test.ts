import { DatabaseSync } from 'node:sqlite';

import { createDrizzleDatabase } from '@/lib/db/drizzle-driver';
import { localRecipePreferences } from '@/lib/db/schemas';
import type { SqlDatabase, SqlParam } from '@/lib/db/types';

function createDatabase() {
  const raw = new DatabaseSync(':memory:');

  const db: SqlDatabase = {
    async execAsync(source) {
      raw.exec(source);
    },
    async runAsync(source, params) {
      const result = raw.prepare(source).run(...(params ?? []));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getAllAsync<T>(source: string, params?: readonly SqlParam[]) {
      return raw.prepare(source).all(...(params ?? [])) as T[];
    },
    async getFirstAsync<T>(source: string, params?: readonly SqlParam[]) {
      return (raw.prepare(source).get(...(params ?? [])) as T | undefined) ?? null;
    },
    async getAllRawAsync(source, params) {
      const statement = raw.prepare(source);
      statement.setReturnArrays(true);
      const rows: unknown[] = statement.all(...(params ?? []));
      return rows.map((row) => {
        if (!Array.isArray(row)) throw new Error('node:sqlite lieferte keine Raw-Zeile.');
        return row.map((value) => {
          if (value === null || typeof value === 'string' || typeof value === 'number')
            return value;
          throw new Error('node:sqlite lieferte einen nicht unterstützten Wert.');
        });
      });
    },
    async withExclusiveTransactionAsync(task) {
      raw.exec('BEGIN IMMEDIATE');
      try {
        await task(db);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return { db, close: () => raw.close() };
}

describe('Drizzle-Adapter', () => {
  it('liest und schreibt typisiert über denselben SqlDatabase-Port', async () => {
    const { db, close } = createDatabase();
    await db.execAsync(`
      create table local_recipe_preferences (
        user_id text not null,
        recipe_key text not null,
        is_favorite integer not null default 0,
        rating integer,
        note text,
        updated_at integer not null,
        primary key (user_id, recipe_key)
      )
    `);
    const drizzleDb = createDrizzleDatabase(db);

    await drizzleDb.insert(localRecipePreferences).values({
      userId: 'user-1',
      recipeKey: 'recipe:1',
      isFavorite: true,
      rating: 9,
      note: 'Sehr gut',
      updatedAt: 123,
    });

    await expect(drizzleDb.select().from(localRecipePreferences)).resolves.toEqual([
      {
        userId: 'user-1',
        recipeKey: 'recipe:1',
        isFavorite: true,
        rating: 9,
        note: 'Sehr gut',
        updatedAt: 123,
      },
    ]);
    close();
  });

  it('lehnt Ports ohne positionsstabile Rohzeilen ab', () => {
    const { db, close } = createDatabase();
    const { getAllRawAsync: _, ...withoutRawRows } = db;

    expect(() => createDrizzleDatabase(withoutRawRows)).toThrow(/positionsstabilen/);
    close();
  });
});
