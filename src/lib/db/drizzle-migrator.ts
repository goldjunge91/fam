import { bugBubbleConsole } from '@/lib/analytics/bug-bubble';
import {
  DRIZZLE_BASELINE_NAME,
  DRIZZLE_MIGRATIONS_TABLE,
  hashMigrationSource,
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
  const baselineIndex = entries.findIndex(([name]) => name === DRIZZLE_BASELINE_NAME);

  if (baselineIndex === -1) {
    throw new Error(`Gebündelte Drizzle-Baseline ${DRIZZLE_BASELINE_NAME} fehlt.`);
  }
  if (baselineIndex !== 0) {
    throw new Error(`Gebündelte Drizzle-Baseline ${DRIZZLE_BASELINE_NAME} muss zuerst kommen.`);
  }

  for (const [name, source] of entries) {
    timestampFromMigrationName(name);
    if (source.trim().length === 0) throw new Error(`Leere Drizzle-Migration: ${name}`);
  }
  return entries;
}

async function createMigrationsTable(db: SqlDatabase): Promise<void> {
  await db.execAsync(`
    create table if not exists ${DRIZZLE_MIGRATIONS_TABLE} (
      id integer primary key,
      hash text not null,
      created_at numeric,
      name text,
      applied_at text
    )
  `);
}

async function appliedMigrationHashes(db: SqlDatabase): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ name: string | null; hash: string | null }>(
    `select name, hash from ${DRIZZLE_MIGRATIONS_TABLE}`,
  );
  const hashes = new Map<string, string>();
  for (const row of rows) {
    if (row.name === null) {
      throw new Error('Die Drizzle-Migrationstabelle enthält einen Eintrag ohne Namen.');
    }
    if (row.hash === null) {
      throw new Error(`Die Drizzle-Migration ${row.name} enthält keinen Hash.`);
    }
    if (hashes.has(row.name)) {
      throw new Error(`Die Drizzle-Migration ${row.name} ist doppelt gespeichert.`);
    }
    hashes.set(row.name, row.hash);
  }
  return hashes;
}

async function applyMigration(db: SqlDatabase, name: string, source: string): Promise<void> {
  for (const statement of source.split('--> statement-breakpoint')) {
    if (statement.trim().length > 0) await db.execAsync(statement);
  }
  await db.runAsync(
    `insert into ${DRIZZLE_MIGRATIONS_TABLE} (hash, created_at, name, applied_at)
     values (?, ?, ?, ?)`,
    [hashMigrationSource(source), timestampFromMigrationName(name), name, new Date().toISOString()],
  );
}

export async function runDrizzleMigrations(
  db: SqlDatabase,
  bundle: MigrationBundle = localMigrations,
): Promise<number> {
  const entries = migrationEntries(bundle);
  bugBubbleConsole('debug', '[drizzle] Migrationslauf gestartet', `${entries.length} bekannt`);

  let appliedCount = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await createMigrationsTable(transaction);
    const applied = await appliedMigrationHashes(transaction);
    if (applied.size > 0 && !applied.has(DRIZZLE_BASELINE_NAME)) {
      throw new Error(`Die lokale Datenbank ist nicht mit der Drizzle-Baseline initialisiert.`);
    }

    const knownNames = new Set(entries.map(([name]) => name));
    for (const name of applied.keys()) {
      if (!knownNames.has(name)) {
        throw new Error(`Die Drizzle-Migration ${name} ist im Bundle unbekannt.`);
      }
    }

    for (const [name, source] of entries) {
      const expectedHash = hashMigrationSource(source);
      const appliedHash = applied.get(name);
      if (appliedHash !== undefined) {
        if (appliedHash !== expectedHash) {
          throw new Error(`Der Hash der Drizzle-Migration ${name} stimmt nicht überein.`);
        }
        continue;
      }
      await applyMigration(transaction, name, source);
      applied.set(name, expectedHash);
      appliedCount += 1;
    }
  });

  bugBubbleConsole('debug', '[drizzle] Migrationslauf abgeschlossen', `${appliedCount} angewendet`);
  return appliedCount;
}
