import type { Migration, SqlDatabase } from '@/lib/db/types';

/** Verhindert, dass Luecken oder Duplikate dauerhaft uebersprungen werden. */
export function assertMigrationSequence(migrations: readonly Migration[]): void {
  migrations.forEach((migration, index) => {
    const expected = index + 1;

    if (!Number.isInteger(migration.version)) {
      throw new Error(`Migration an Position ${index} hat keine ganzzahlige Version.`);
    }

    if (migration.version !== expected) {
      throw new Error(
        `Migrationen muessen luecken- und duplikatfrei bei 1 beginnen. ` +
          `An Position ${index} wurde Version ${expected} erwartet, gefunden: ${migration.version}.`,
      );
    }
  });
}

export function planMigrations(
  currentVersion: number,
  migrations: readonly Migration[],
): readonly Migration[] {
  return migrations.filter((migration) => migration.version > currentVersion);
}

export async function readUserVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/** Schema und `user_version` werden gemeinsam pro Migration committet. */
export async function runMigrations(
  db: SqlDatabase,
  migrations: readonly Migration[],
): Promise<number> {
  assertMigrationSequence(migrations);

  const currentVersion = await readUserVersion(db);
  const pending = planMigrations(currentVersion, migrations);

  for (const migration of pending) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const statement of migration.statements) {
        await txn.execAsync(statement);
      }
      await txn.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }

  return pending.length === 0 ? currentVersion : pending[pending.length - 1].version;
}
