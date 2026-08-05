import type { Migration, SqlDatabase } from '@/lib/db/types';

/**
 * Migrations-Runner ueber `PRAGMA user_version` (#45).
 *
 * Die Entscheidung *welche* Migrationen anstehen ist als reine Funktion
 * herausgezogen. Genau daran haengen die beiden Akzeptanzkriterien
 * ("Migrationen laufen genau einmal", "erneuter App-Start migriert nicht
 * erneut") — und so sind sie ohne Datenbank und ohne Testdouble pruefbar.
 */

/**
 * Prueft die Migrationsliste auf Luecken, Duplikate und ungueltige Nummern.
 *
 * Laeuft bei jedem Start. Der Aufwand ist vernachlaessigbar, der Fehler, den es
 * verhindert, dagegen teuer: Eine uebersprungene Nummer wuerde auf einem Geraet
 * mit hoeherem `user_version` still nie angewandt, und der Unterschied faellt
 * erst auf, wenn eine Query eine Spalte nicht findet.
 */
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

/**
 * Die noch nicht angewandten Migrationen, in aufsteigender Reihenfolge.
 *
 * Rein: keine Datenbank, keine Uhr. Bei `currentVersion >= letzte Version` ist
 * das Ergebnis leer — das *ist* das Kriterium "migriert beim zweiten Start
 * nicht erneut".
 */
export function planMigrations(
  currentVersion: number,
  migrations: readonly Migration[],
): readonly Migration[] {
  return migrations.filter((migration) => migration.version > currentVersion);
}

/** Liest `PRAGMA user_version`. Eine frische Datenbank meldet 0. */
export async function readUserVersion(db: SqlDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Wendet alle ausstehenden Migrationen an.
 *
 * Jede Migration laeuft in ihrer eigenen exklusiven Transaktion und setzt
 * `user_version` **innerhalb derselben** Transaktion. `user_version` steht im
 * Datei-Header der Datenbank und wird bei einem Rollback mit zurueckgedreht —
 * eine Migration, die auf halber Strecke wirft, hinterlaesst dadurch weder
 * halbe Tabellen noch eine hochgezaehlte Version.
 *
 * `PRAGMA user_version` nimmt keinen Parameter, deshalb wird die Zahl in den
 * String interpoliert. Das ist hier unbedenklich: Der Wert stammt aus der
 * Migrationsliste im Quelltext, nie aus einer Eingabe, und
 * `assertMigrationSequence` hat ihn zuvor als Ganzzahl bestaetigt.
 */
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
