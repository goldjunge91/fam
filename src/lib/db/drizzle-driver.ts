import type { SQLiteExecuteMethod } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import type { SqlDatabase, SqlParam } from '@/lib/db/types';

type DrizzleCapableDatabase = SqlDatabase & {
  getAllRawAsync(source: string, params?: readonly SqlParam[]): Promise<SqlParam[][]>;
};

function hasRawRows(db: SqlDatabase): db is DrizzleCapableDatabase {
  return typeof db.getAllRawAsync === 'function';
}

function toSqlParams(params: readonly unknown[]): SqlParam[] {
  return params.map((param) => {
    if (param === null || typeof param === 'string' || typeof param === 'number') return param;
    throw new TypeError(`Nicht unterstützter SQLite-Parameter: ${typeof param}`);
  });
}

async function execute(
  db: DrizzleCapableDatabase,
  source: string,
  params: readonly unknown[],
  method: SQLiteExecuteMethod,
): Promise<{ rows: unknown[] }> {
  const sqlParams = toSqlParams(params);

  if (method === 'run') {
    const result = await db.runAsync(source, sqlParams);
    return { rows: [result] };
  }

  const rows = await db.getAllRawAsync(source, sqlParams);
  return { rows: method === 'get' ? (rows[0] ?? []) : rows };
}

export function createDrizzleDatabase(db: SqlDatabase) {
  if (!hasRawRows(db)) {
    throw new Error('Der SQLite-Treiber unterstützt keine positionsstabilen Drizzle-Zeilen.');
  }

  const client = drizzle((source, params, method) => execute(db, source, params, method));

  return client as Omit<typeof client, 'batch' | 'transaction'>;
}

export type DrizzleDatabase = ReturnType<typeof createDrizzleDatabase>;
