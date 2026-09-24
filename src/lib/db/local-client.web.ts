import { drizzle as createExpoDrizzleDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate as migrateExpoDatabase } from 'drizzle-orm/expo-sqlite/migrator';
import { createDrizzleDatabase, type DrizzleDatabase } from '@/lib/db/drizzle-driver';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import {
  type SerializedSqlDatabase,
  type SqlStatementDriver,
  serializeDatabase,
} from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { resetOffDumpAttachment } from '@/lib/off-dump/off-dump-state';
import { measureOperation } from '@/lib/telemetry';
import localMigrations from '../../../drizzle/local/migrations';
import { debugLog, debugWarn } from '../observability/debug-log';

// Web SQLite uses Expo's WASM worker and persistent IndexedDB-backed VFS.
// Native SQLCipher and file-cutover logic stay in local-client.ts.
const WEB_DATABASE_FILE_NAME = 'fam-v2.web.db';

const WEB_SQLITE_HINT =
  'expo-sqlite konnte für Web nicht geladen werden. Prüfe die WASM-Konfiguration ' +
  'in metro.config.js und starte Metro anschließend neu.';

function loadSQLite(): typeof import('expo-sqlite') {
  try {
    return require('expo-sqlite') as typeof import('expo-sqlite');
  } catch {
    throw new Error(WEB_SQLITE_HINT);
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

// Expo recommends enabling foreign keys directly after opening a SQLite connection:
// https://docs.expo.dev/versions/latest/sdk/sqlite/index.md
async function ensureForeignKeys(db: SerializedSqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
}

async function runLocalDrizzleMigrations(db: import('expo-sqlite').SQLiteDatabase): Promise<void> {
  await migrateExpoDatabase(createExpoDrizzleDatabase(db), localMigrations);
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
  debugLog(`[DBTRACE:${code}]`, details);
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
  const openedDatabase = await SQLite.openDatabaseAsync(WEB_DATABASE_FILE_NAME, {
    useNewConnection: true,
  });
  const db = serializeDatabase(toDriver(openedDatabase));

  try {
    await runStartupStep(openId, 'foreign_keys', () => ensureForeignKeys(db));
    await runStartupStep(openId, 'drizzle_migrations', () =>
      runLocalDrizzleMigrations(openedDatabase),
    );
    dbTrace('INIT-OK', { openId, platform: 'web' });
  } catch (error) {
    dbTrace('INIT-FAIL', { error: errorMessage(error), openId, platform: 'web' });
    debugWarn('[db] Web-Initialisierung fehlgeschlagen; Datenbank bleibt erhalten:', error);
    try {
      await db.closeForLifecycle(() => openedDatabase.closeAsync());
    } catch (closeError) {
      rawDatabase = openedDatabase;
      database = db;
      throw new Error('Die fehlgeschlagene Web-Datenbanköffnung konnte nicht geschlossen werden.', {
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
  const connectionToClose =
    connection ?? (database && rawDatabase ? { db: database, raw: rawDatabase } : null);

  if (connectionToClose) {
    try {
      await connectionToClose.db.closeForLifecycle(() => connectionToClose.raw.closeAsync());
    } catch (error) {
      // Den Handle für einen späteren orphan-cleanup behalten. Der serialisierte
      // Port nimmt keine Statements mehr an, kann den Close nach einem Fehler aber erneut versuchen.
      rawDatabase = connectionToClose.raw;
      database = connectionToClose.db;
      drizzleDatabase = null;
      throw new Error('Die lokale Web-Datenbank konnte nicht geschlossen werden.', {
        cause: error,
      });
    }
  }

  if (!connection || rawDatabase === connection.raw) {
    rawDatabase = null;
    database = null;
    drizzleDatabase = null;
  }

  resetOffDumpAttachment();

  try {
    await SQLite.deleteDatabaseAsync(WEB_DATABASE_FILE_NAME);
  } catch (error) {
    throw new Error('Die lokale Web-Datenbank konnte nicht gelöscht werden.', { cause: error });
  }
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
