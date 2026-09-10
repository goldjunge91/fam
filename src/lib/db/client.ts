import {
  deleteDatabaseEncryptionKey,
  getOrCreateDatabaseEncryptionKey,
  keyAndVerifyDatabase,
  openEncryptedDatabaseWithCutover,
} from '@/lib/db/database-encryption';
import { createExpoDatabaseFileOps, DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import { createDrizzleDatabase, type DrizzleDatabase } from '@/lib/db/drizzle-driver';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import {
  type SerializedSqlDatabase,
  type SqlStatementDriver,
  serializeDatabase,
} from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { resetOffDumpAttachment } from '@/lib/off-dump/off-dump-state';
import { measureOperation } from '@/lib/telemetry';

const REBUILD_HINT =
  'expo-sqlite ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt ' +
  'werden (scripts/ios-dev.sh oder `bunx expo run:ios`).';

function loadSQLite(): typeof import('expo-sqlite') {
  try {
    return require('expo-sqlite') as typeof import('expo-sqlite');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

function toDriver(db: import('expo-sqlite').SQLiteDatabase): SqlStatementDriver {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, [...(params ?? [])]),
    getAllAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getAllAsync<T>(source, [...(params ?? [])]),
    getFirstAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getFirstAsync<T>(source, [...(params ?? [])]),
    getAllRawAsync: async (source, params) => {
      const statement = await db.prepareAsync(source);
      try {
        const result = await statement.executeForRawResultAsync<
          Record<string, string | number | null>
        >([...(params ?? [])]);
        return await result.getAllAsync();
      } finally {
        await statement.finalizeAsync();
      }
    },
  };
}

type DatabaseConnection = {
  raw: import('expo-sqlite').SQLiteDatabase;
  db: SerializedSqlDatabase;
};

async function ensureWalJournalMode(db: SerializedSqlDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ journal_mode?: string }>('PRAGMA journal_mode');
  if (current?.journal_mode?.toLowerCase() === 'wal') return;

  // Der Wechsel des Journal-Modus benötigt einen exklusiven SQLite-Zugriff.
  // Nach Fast Refresh kann aber noch eine native Connection aus dem vorherigen
  // JS-Lauf existieren. Auf einer bereits als WAL geöffneten Datei ist dieser
  // lock-sensitive Schreibzugriff nicht nötig.
  await db.execAsync('PRAGMA journal_mode = WAL');
}

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SerializedSqlDatabase | null = null;
let drizzleDatabase: DrizzleDatabase | null = null;
let opening: Promise<SqlDatabase> | null = null;
let wipeInProgress: Promise<void> | null = null;
let lifecycleGeneration = 0;
let openSequence = 0;

type DbTraceDetails = Record<string, boolean | number | string | undefined>;

function dbTrace(code: string, details: DbTraceDetails = {}): void {
  if (__DEV__) {
    console.log(`[DBTRACE:${code}]`, JSON.stringify(details));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runStartupStep(
  openId: number,
  step: string,
  operation: () => Promise<unknown>,
): Promise<void> {
  dbTrace('STEP-START', { openId, step });
  try {
    await operation();
    dbTrace('STEP-OK', { openId, step });
  } catch (error) {
    dbTrace('STEP-FAIL', { error: errorMessage(error), openId, step });
    throw error;
  }
}

/** Der zuletzt gemeldete angemeldete Nutzer. `null` = noch unbekannt oder abgemeldet. */
let activeUserId: string | null = null;
/** Fuer welche Nutzer-Id die geoeffnete Datei bereits geprueft wurde. */
let checkedUserId: string | null = null;

export function setActiveUserId(userId: string | null): void {
  if (activeUserId !== userId) lifecycleGeneration += 1;
  activeUserId = userId;
}

function isVerifiedForActiveUser(): boolean {
  return activeUserId !== null && checkedUserId === activeUserId;
}

function assertLifecycle(generation: number, userId: string): void {
  if (generation !== lifecycleGeneration || activeUserId !== userId || wipeInProgress !== null) {
    throw new Error('Der Datenbankzugriff wurde durch einen Accountwechsel abgebrochen.');
  }
}

async function open(openId: number): Promise<DatabaseConnection> {
  dbTrace('OPEN-START', { openId });
  const SQLite = loadSQLite();
  const databaseDirectory = SQLite.defaultDatabaseDirectory;
  if (typeof databaseDirectory !== 'string') {
    throw new Error('Das native SQLite-Datenbankverzeichnis ist nicht verfügbar.');
  }

  const key = await getOrCreateDatabaseEncryptionKey();
  const files = createExpoDatabaseFileOps(databaseDirectory);
  const openPlaintext = (fileName: string) =>
    SQLite.openDatabaseAsync(fileName, { useNewConnection: true });
  const openEncrypted = async (fileName: string, encryptionKey: string) => {
    const opened = await SQLite.openDatabaseAsync(fileName, {
      useNewConnection: true,
    });
    try {
      // Muss das allererste Statement nach openDatabaseAsync bleiben.
      dbTrace('KEY-START', { openId });
      try {
        await keyAndVerifyDatabase(opened, encryptionKey);
        dbTrace('KEY-OK', { openId });
      } catch (error) {
        dbTrace('KEY-FAIL', { error: errorMessage(error), openId });
        throw error;
      }
      return opened;
    } catch (error) {
      await opened.closeAsync();
      throw error;
    }
  };

  let openedDatabase: import('expo-sqlite').SQLiteDatabase;
  try {
    openedDatabase = await openEncryptedDatabaseWithCutover(
      {
        files,
        mainFileName: DATABASE_FILE_NAMES.main,
        encryptedNextFileName: DATABASE_FILE_NAMES.encryptedNext,
        plaintextRecoveryFileName: DATABASE_FILE_NAMES.plaintextRecovery,
        openPlaintext,
        openEncrypted,
      },
      key,
    );
    dbTrace('OPEN-CONNECTION-OK', { openId });
  } catch (error) {
    dbTrace('OPEN-CONNECTION-FAIL', { error: errorMessage(error), openId });
    throw error;
  }
  const db = serializeDatabase(toDriver(openedDatabase));

  try {
    // Netz fuer Connections, die uns nicht gehoeren: die Devtools-Registrierung
    // von `expo-sqlite` im Dev-Build und WAL-Checkpoints. Die Zugriffe der App
    // selbst laufen serialisiert ueber eine Connection und kollidieren nicht mehr
    // (siehe `serialize.ts`) — dieser PRAGMA ersetzt das nicht. Er muss vor dem
    // WAL-Modus gesetzt werden, damit auch der erste potenziell sperrende
    // Schreibzugriff beim Öffnen warten kann. Wert 5000, weil die UI alle 3 s
    // pollt: kuerzer hiesse, mitten im normalen Takt aufzugeben.
    await runStartupStep(openId, 'busy_timeout', () => db.execAsync('PRAGMA busy_timeout = 5000'));

    // WAL muss ausserhalb jeder Transaktion gesetzt werden — innerhalb lehnt
    // SQLite den Moduswechsel ab. Deshalb hier, vor den Migrationen. Bei einer
    // bereits als WAL geöffneten Datei bleibt der lock-sensitive Wechsel aus.
    await runStartupStep(openId, 'journal_mode_wal', () => ensureWalJournalMode(db));

    await runStartupStep(openId, 'legacy_migrations', () => runMigrations(db, MIGRATIONS));
    await runStartupStep(openId, 'drizzle_migrations', () => runDrizzleMigrations(db));
    dbTrace('INIT-OK', { openId });
  } catch (error) {
    // Nie automatisch löschen: In der Datei kann eine nicht synchronisierte
    // Outbox liegen. Insbesondere ein falscher/verlorener Key darf keinen
    // destruktiven "Recovery"-Pfad auslösen.
    dbTrace('INIT-FAIL', { error: errorMessage(error), openId });
    console.warn('[db] Initialisierung fehlgeschlagen; Datenbank bleibt erhalten:', error);
    try {
      await db.closeForLifecycle(() => openedDatabase.closeAsync());
    } catch (closeError) {
      rawDatabase = openedDatabase;
      database = db;
      throw new Error('Die fehlgeschlagene Datenbanköffnung konnte nicht geschlossen werden.', {
        cause: closeError,
      });
    }
    throw error;
  }

  return { raw: openedDatabase, db };
}

async function openAndVerify(
  openId: number,
  generation: number,
  userId: string,
): Promise<SqlDatabase> {
  dbTrace('VERIFY-START', { hasCachedConnection: Boolean(database && rawDatabase), openId });
  let connection =
    database && rawDatabase ? { db: database, raw: rawDatabase } : await open(openId);

  try {
    assertLifecycle(generation, userId);
    if (checkedUserId !== userId) {
      const verified = await ensureDatabaseBelongsTo(
        connection.db,
        userId,
        async () => {
          await closeAndDeleteFile(connection);
          assertLifecycle(generation, userId);
          connection = await open(openId);
          assertLifecycle(generation, userId);
          return connection.db;
        },
        () => assertLifecycle(generation, userId),
      );
      connection = { ...connection, db: verified as SerializedSqlDatabase };
    }

    assertLifecycle(generation, userId);
    rawDatabase = connection.raw;
    database = connection.db;
    checkedUserId = userId;
    dbTrace('READY', { openId });
    return connection.db;
  } catch (error) {
    dbTrace('VERIFY-FAIL', { error: errorMessage(error), openId });
    // Eine noch nicht veröffentlichte Connection gehört ausschließlich diesem
    // fehlgeschlagenen Open-Lauf und darf nicht bis nach dem Wipe offen bleiben.
    if (connection.raw !== rawDatabase) {
      try {
        await connection.db.closeForLifecycle(() => connection.raw.closeAsync());
      } catch (closeError) {
        // Auch eine stale, noch nicht veröffentlichte Connection muss für den
        // Retry erreichbar bleiben. `activeUserId === null` blockiert Zugriffe.
        rawDatabase = connection.raw;
        database = connection.db;
        drizzleDatabase = null;
        throw new Error('Eine veraltete Datenbanköffnung konnte nicht geschlossen werden.', {
          cause: closeError,
        });
      }
    }
    throw error;
  }
}

export function getDatabase(): Promise<SqlDatabase> {
  if (activeUserId === null) {
    return Promise.reject(new Error('Ohne angemeldeten Nutzer ist die lokale Datenbank gesperrt.'));
  }
  if (wipeInProgress) {
    return Promise.reject(new Error('Die lokale Datenbank wird gerade gelöscht.'));
  }
  if (database && isVerifiedForActiveUser()) {
    dbTrace('REQUEST-CACHED');
    return Promise.resolve(database);
  }

  if (!opening) {
    openSequence += 1;
    const openId = openSequence;
    const generation = lifecycleGeneration;
    const userId = activeUserId;
    dbTrace('REQUEST-NEW', { generation, openId });
    const pending = measureOperation('db.open', async () => {
      try {
        return await openAndVerify(openId, generation, userId);
      } catch (error) {
        dbTrace('REQUEST-FAIL', { error: errorMessage(error), openId });
        throw error;
      }
    }).finally(() => {
      dbTrace('REQUEST-SETTLED', { openId });
      if (opening === pending) opening = null;
    });
    opening = pending;
  } else {
    dbTrace('REQUEST-JOINED');
  }

  return opening;
}

export async function getDrizzleDatabase(): Promise<DrizzleDatabase> {
  const db = await getDatabase();
  drizzleDatabase ??= createDrizzleDatabase(db);
  return drizzleDatabase;
}

async function closeAndDeleteFile(connection?: DatabaseConnection): Promise<void> {
  const SQLite = loadSQLite();
  const errors: unknown[] = [];
  const connectionToClose =
    connection ?? (database && rawDatabase ? { db: database, raw: rawDatabase } : null);

  if (connectionToClose) {
    try {
      await connectionToClose.db.closeForLifecycle(() => connectionToClose.raw.closeAsync());
    } catch (error) {
      // Den Handle für einen späteren orphan-cleanup behalten. Der serialisierte
      // Port nimmt keine Statements mehr an, kann den nativen Close nach einem
      // Fehler aber erneut versuchen.
      rawDatabase = connectionToClose.raw;
      database = connectionToClose.db;
      drizzleDatabase = null;
      throw new Error('Die lokale Datenbank konnte nicht geschlossen werden.', { cause: error });
    }
  }

  if (!connection || rawDatabase === connection.raw) {
    rawDatabase = null;
    database = null;
    drizzleDatabase = null;
  }
  // Die geloeschte Datei nimmt jeden bisherigen `ATTACH ... AS off_dump` mit —
  // ohne diesen Reset wuerde `attachOffDump()` faelschlich "schon angehaengt"
  // gegen die naechste, frische Connection melden (siehe off-dump.ts).
  resetOffDumpAttachment();

  const filesToDelete = [
    DATABASE_FILE_NAMES.main,
    DATABASE_FILE_NAMES.encryptedNext,
    DATABASE_FILE_NAMES.plaintextRecovery,
    `${DATABASE_FILE_NAMES.main}-wal`,
    `${DATABASE_FILE_NAMES.main}-shm`,
    `${DATABASE_FILE_NAMES.main}-journal`,
    `${DATABASE_FILE_NAMES.encryptedNext}-wal`,
    `${DATABASE_FILE_NAMES.encryptedNext}-shm`,
    `${DATABASE_FILE_NAMES.encryptedNext}-journal`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-wal`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-shm`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-journal`,
  ];

  const databaseDirectory = SQLite.defaultDatabaseDirectory;
  if (typeof databaseDirectory !== 'string') {
    errors.push(new Error('Das native SQLite-Datenbankverzeichnis ist nicht verfügbar.'));
  } else {
    const files = createExpoDatabaseFileOps(databaseDirectory);
    for (const fileName of filesToDelete) {
      try {
        await files.delete(fileName);
      } catch (error) {
        errors.push(error);
      }
    }

    const remainingFiles = filesToDelete.filter((fileName) => files.exists(fileName));
    if (remainingFiles.length > 0) {
      errors.push(
        new Error(
          `Sensitive Datenbankdateien konnten nicht gelöscht werden: ${remainingFiles.join(', ')}`,
        ),
      );
    }
  }

  if (errors.length > 0) {
    throw new Error('Der lokale Datenbank-Wipe ist fehlgeschlagen.', { cause: errors[0] });
  }

  // Den Key nie vor den Dateien löschen. Sonst würde ein fehlgeschlagener Wipe
  // die verbliebene Datenbank nur unlesbar machen, aber nicht entfernen.
  await deleteDatabaseEncryptionKey();
}

export function deleteLocalDatabase(): Promise<void> {
  if (wipeInProgress) return wipeInProgress;

  // Synchronous barrier: Jeder bereits gestartete Open-Lauf wird stale, und
  // jeder neue Aufruf sieht `wipeInProgress`, bevor der erste await erreicht ist.
  lifecycleGeneration += 1;
  const pendingOpening = opening;
  const wipe = (async () => {
    if (pendingOpening) {
      try {
        await pendingOpening;
      } catch {
        // Ein durch die Generation absichtlich abgebrochener Open-Lauf ist hier
        // erwartbar. Der anschließende Datei-Check entscheidet über den Wipe.
      }
    }

    await closeAndDeleteFile();
    checkedUserId = null;
  })().finally(() => {
    if (wipeInProgress === wipe) wipeInProgress = null;
  });

  wipeInProgress = wipe;
  return wipe;
}
