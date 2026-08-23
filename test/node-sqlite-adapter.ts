import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlParam, SqlRunResult } from '@/lib/db/types';

/** Echter SQLite-Treiber fuer Node-Tests; benoetigt Node 22.5 oder neuer. */

function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function bind(params: readonly SqlParam[] | undefined): SqlParam[] {
  return params === undefined ? [] : [...params];
}

function wrap(db: DatabaseSync, insideTransaction: boolean): SqlDatabase {
  const self: SqlDatabase = {
    async execAsync(source: string): Promise<void> {
      db.exec(source);
    },

    async runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult> {
      const result = db.prepare(source).run(...bind(params));
      return {
        lastInsertRowId: toNumber(result.lastInsertRowid),
        changes: toNumber(result.changes),
      };
    },

    async getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]> {
      return db.prepare(source).all(...bind(params)) as T[];
    },

    async getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null> {
      const row = db.prepare(source).get(...bind(params));
      return (row as T | undefined) ?? null;
    },

    async withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void> {
      if (insideTransaction) {
        throw new Error('withExclusiveTransactionAsync ist nicht verschachtelbar.');
      }

      // Entspricht der Produktionsserialisierung und reserviert den Writer sofort.
      db.exec('BEGIN IMMEDIATE');
      try {
        await task(wrap(db, true));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return self;
}

export type TestDatabase = SqlDatabase & { close(): void };

/** Verwendet ohne Pfad eine In-Memory-Datenbank. */
export function createTestDatabase(path = ':memory:'): TestDatabase {
  const db = new DatabaseSync(path);
  return { ...wrap(db, false), close: () => db.close() };
}

/** Zaehlt Statements, waehrend sie weiterhin gegen echte SQLite laufen. */
export function countingDatabase(inner: SqlDatabase): SqlDatabase & { executed: string[] } {
  const executed: string[] = [];

  const counted: SqlDatabase = {
    execAsync: (source) => {
      executed.push(source);
      return inner.execAsync(source);
    },
    runAsync: (source, params) => {
      executed.push(source);
      return inner.runAsync(source, params);
    },
    getAllAsync: (source, params) => inner.getAllAsync(source, params),
    getFirstAsync: (source, params) => inner.getFirstAsync(source, params),
    withExclusiveTransactionAsync: (task) =>
      inner.withExclusiveTransactionAsync(async (txn) => {
        await task({
          ...txn,
          execAsync: (source) => {
            executed.push(source);
            return txn.execAsync(source);
          },
          runAsync: (source, params) => {
            executed.push(source);
            return txn.runAsync(source, params);
          },
        });
      }),
  };

  return { ...counted, executed };
}
