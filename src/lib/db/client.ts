import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import { type SqlStatementDriver, serializeDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { resetOffDumpAttachment } from '@/lib/off-dump/off-dump';

// Einziger Importort fuer `expo-sqlite`; der Rest nutzt den testbaren `SqlDatabase`-Port.

const REBUILD_HINT =
  'expo-sqlite ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt ' +
  'werden (scripts/ios-dev.sh oder `bunx expo run:ios`).';

/** Laedt das native Modul erst beim ersten Datenbankzugriff. */
function loadSQLite(): typeof import('expo-sqlite') {
  try {
    return require('expo-sqlite') as typeof import('expo-sqlite');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

/** Passt expo-sqlites Parametersignaturen an den serialisierten Datenbank-Port an. */
function toDriver(db: import('expo-sqlite').SQLiteDatabase): SqlStatementDriver {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, [...(params ?? [])]),
    getAllAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getAllAsync<T>(source, [...(params ?? [])]),
    getFirstAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getFirstAsync<T>(source, [...(params ?? [])]),
  };
}

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SqlDatabase | null = null;
let opening: Promise<SqlDatabase> | null = null;

let activeUserId: string | null = null;
let checkedUserId: string | null = null;

/** Muss vor dem Session-State-Update laufen, damit Re-Renders den richtigen Nutzer pruefen. */
export function setActiveUserId(userId: string | null): void {
  activeUserId = userId;
}

function isVerifiedForActiveUser(): boolean {
  return activeUserId === null || checkedUserId === activeUserId;
}

async function open(): Promise<SqlDatabase> {
  const SQLite = loadSQLite();
  rawDatabase = await SQLite.openDatabaseAsync(DATABASE_FILE_NAMES.main);
  const db = serializeDatabase(toDriver(rawDatabase));

  // SQLite erlaubt den WAL-Moduswechsel nicht innerhalb einer Transaktion.
  await db.execAsync('PRAGMA journal_mode = WAL');

  // Puffer fuer Devtools-Verbindungen und WAL-Checkpoints ausserhalb unserer Serialisierung.
  await db.execAsync('PRAGMA busy_timeout = 5000');

  await runMigrations(db, MIGRATIONS);

  return db;
}

/** Oeffnen und Nutzerpruefung teilen denselben Mutex. */
async function openAndVerify(): Promise<SqlDatabase> {
  let db = database ?? (await open());
  database = db;

  const userId = activeUserId;
  if (userId !== null && checkedUserId !== userId) {
    db = await ensureDatabaseBelongsTo(db, userId, async () => {
      // `opening` bleibt gesetzt, bis dieser Oeffnungslauf abgeschlossen ist.
      await closeAndDeleteFile();
      const fresh = await open();
      database = fresh;
      return fresh;
    });

    database = db;
    checkedUserId = userId;
  }

  return db;
}

/** Teilt einen Oeffnungs- und Migrationslauf zwischen allen parallelen Aufrufern. */
export function getDatabase(): Promise<SqlDatabase> {
  if (database && isVerifiedForActiveUser()) return Promise.resolve(database);

  if (!opening) {
    opening = openAndVerify().finally(() => {
      opening = null;
    });
  }

  return opening;
}

async function closeAndDeleteFile(): Promise<void> {
  const SQLite = loadSQLite();

  if (rawDatabase) {
    try {
      await rawDatabase.closeAsync();
    } catch (e) {
      console.warn('[db] Fehler beim Schließen der Datenbank:', e);
    }
    rawDatabase = null;
  }

  database = null;
  // Der Attach-Status gehoert zur geloeschten Connection.
  resetOffDumpAttachment();

  try {
    await SQLite.deleteDatabaseAsync(DATABASE_FILE_NAMES.main);
  } catch (e) {
    console.warn('[db] Fehler beim Löschen der Datenbank:', e);
  }
}

/** Entfernt beim Logout alle lokalen Daten des bisherigen Nutzers. */
export async function deleteLocalDatabase(): Promise<void> {
  await closeAndDeleteFile();

  opening = null;
  checkedUserId = null;
}
