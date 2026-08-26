import {
  DRIZZLE_BASELINE_NAME,
  DRIZZLE_MIGRATIONS_TABLE,
  ensureDrizzleBaseline,
  hashSchemaShape,
} from '@/lib/db/drizzle-baseline';
import type { SqlDatabase } from '@/lib/db/types';
import localMigrations from '../../../drizzle/local/migrations';

type MigrationBundle = {
  migrations: Record<string, string>;
};

function timestampFromMigrationName(name: string): number {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/.exec(name);
  if (!match) throw new Error(`Ungültiger Drizzle-Migrationsname: ${name}`);

  const [, year, month, day, hour, minute, second] = match;
  const timestamp = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  if (!Number.isFinite(timestamp)) throw new Error(`Ungültiger Drizzle-Zeitstempel: ${name}`);
  return timestamp;
}

function migrationEntries(bundle: MigrationBundle): [string, string][] {
  const entries = Object.entries(bundle.migrations).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  if (!entries.some(([name]) => name === DRIZZLE_BASELINE_NAME)) {
    throw new Error(`Gebündelte Drizzle-Baseline ${DRIZZLE_BASELINE_NAME} fehlt.`);
  }
  for (const [name, source] of entries) {
    timestampFromMigrationName(name);
    if (source.trim().length === 0) throw new Error(`Leere Drizzle-Migration: ${name}`);
  }
  return entries;
}

export async function runDrizzleMigrations(
  db: SqlDatabase,
  bundle: MigrationBundle = localMigrations,
): Promise<number> {
  const entries = migrationEntries(bundle);
  await ensureDrizzleBaseline(db);

  let appliedCount = 0;
  for (const [name, source] of entries) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
      const applied = await transaction.getFirstAsync<{ name: string }>(
        `select name from ${DRIZZLE_MIGRATIONS_TABLE} where name = ?`,
        [name],
      );
      if (applied) return;

      for (const statement of source.split('--> statement-breakpoint')) {
        if (statement.trim().length > 0) await transaction.execAsync(statement);
      }
      await transaction.runAsync(
        `insert into ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at, name, applied_at)
         values (?, ?, ?, ?)`,
        [hashSchemaShape(source), timestampFromMigrationName(name), name, new Date().toISOString()],
      );
      appliedCount += 1;
    });
  }

  return appliedCount;
}
