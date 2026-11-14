import { drizzle as createExpoDrizzleDatabase } from 'drizzle-orm/expo-sqlite';
import { migrate as migrateExpoDatabase } from 'drizzle-orm/expo-sqlite/migrator';
import { FAM_APP_GROUP } from '@/lib/apple/shared-app-group';
import {
  createSharedStoreWriterOwner,
  getSharedStoreLifecycleState,
  type SharedStoreLease,
  type SharedStoreWriterOwner,
} from '@/lib/apple/shared-store-lifecycle';
import { createExpoDatabaseFileOps, DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import { createDrizzleDatabase, type DrizzleDatabase } from '@/lib/db/drizzle-driver';
import {
  deleteDatabaseEncryptionKey,
  getOrCreateDatabaseEncryptionKey,
  keyAndVerifyDatabase,
  openEncryptedDatabaseWithCutover,
} from '@/lib/db/local-database-encryption';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import {
  type SerializedSqlDatabase,
  type SqlStatementDriver,
  serializeDatabase,
} from '@/lib/db/serialize';
import { resetOffDumpAttachment } from '@/lib/off-dump/off-dump-state';
import { measureOperation } from '@/lib/telemetry';
import localMigrations from '../../../drizzle/local/migrations';
import { debugLog, debugWarn } from '../observability/debug-log';

const REBUILD_HINT =
  'expo-sqlite ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt ' +
  'werden (`bunx expo run:ios`).';

function loadSQLite(): typeof import('expo-sqlite') {
  try {
    return require('expo-sqlite') as typeof import('expo-sqlite');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

type DatabaseDirectories = {
  defaultDirectory: string;
  primary: string;
  appGroup?: string;
};

export type DatabaseExecutionContext =
  | { kind: 'foreground'; signal?: AbortSignal }
  | { kind: 'background'; backgroundContext: SharedStoreLease; signal?: AbortSignal };

export type ActiveDatabaseAccount = {
  userId: string | null;
  generation: number;
};

export type DatabaseLifecycleCloseResult =
  | { status: 'closed'; account: ActiveDatabaseAccount }
  | { status: 'not-open' }
  | { status: 'ownership-mismatch'; account: ActiveDatabaseAccount };

const FOREGROUND_CONTEXT: DatabaseExecutionContext = { kind: 'foreground' };
const DATABASE_LIFECYCLE_ERROR =
  'Die lokale Datenbank ist im aktuellen Lifecycle nicht zugelassen.';
const DATABASE_CONTEXT_MISMATCH_ERROR =
  'Die lokale Datenbank ist bereits in einem anderen Ausführungskontext geöffnet.';

function contextKey(context: DatabaseExecutionContext): string {
  return context.kind === 'foreground'
    ? 'foreground'
    : `background:${context.backgroundContext.token}`;
}

function assertDatabaseAdmission(context: DatabaseExecutionContext): void {
  if (context.signal?.aborted) {
    throw new Error('Der Datenbankkontext ist abgelaufen.');
  }

  if (context.kind === 'background') {
    if (
      context.backgroundContext.kind !== 'background' ||
      context.backgroundContext.ended ||
      context.backgroundContext.signal.aborted
    ) {
      throw new Error('Der Datenbankkontext ist abgelaufen.');
    }
    return;
  }

  if (getSharedStoreLifecycleState() !== 'active') {
    throw new Error(DATABASE_LIFECYCLE_ERROR);
  }
}

function createDatabaseWriterOwner(context: DatabaseExecutionContext): SharedStoreWriterOwner {
  return context.kind === 'background'
    ? createSharedStoreWriterOwner(context.backgroundContext)
    : createSharedStoreWriterOwner();
}

function isAppGroupDirectory(directories: DatabaseDirectories, directory: string): boolean {
  return directories.appGroup === directory;
}

function getDatabaseDirectories(SQLite: typeof import('expo-sqlite')): DatabaseDirectories {
  const defaultDirectory = SQLite.defaultDatabaseDirectory;
  if (typeof defaultDirectory !== 'string') {
    throw new Error('Das native SQLite-Datenbankverzeichnis ist nicht verfügbar.');
  }

  try {
    const { Paths } = require('expo-file-system') as typeof import('expo-file-system');
    const sharedContainer = Paths.appleSharedContainers?.[FAM_APP_GROUP];
    const sharedDirectory = sharedContainer?.uri;
    if (typeof sharedDirectory === 'string' && sharedDirectory.length > 0) {
      // The app and Siri must open the same SQLite file in this container.
      return { defaultDirectory, primary: sharedDirectory, appGroup: sharedDirectory };
    }
  } catch (error) {
    debugWarn('[db] App-Group-Container nicht verfügbar; verwende Standardverzeichnis.', error);
  }

  return { defaultDirectory, primary: defaultDirectory };
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
  account: ActiveDatabaseAccount;
};

type PendingDatabaseCleanup = {
  readonly raw: import('expo-sqlite').SQLiteDatabase;
  readonly account: ActiveDatabaseAccount;
  readonly openId: number;
  state: 'opening' | 'unresolved';
  close(): Promise<void>;
};

async function ensureWalJournalMode(db: SerializedSqlDatabase): Promise<void> {
  const current = await db.getFirstAsync<{ journal_mode?: string }>('PRAGMA journal_mode');
  if (current?.journal_mode === 'wal') return;

  // Der Wechsel des Journal-Modus benötigt einen exklusiven SQLite-Zugriff.
  // Nach Fast Refresh kann aber noch eine native Connection aus dem vorherigen
  // JS-Lauf existieren. Auf einer bereits als WAL geöffneten Datei ist dieser
  // lock-sensitive Schreibzugriff nicht nötig.
  try {
    await db.execAsync('PRAGMA journal_mode = WAL');
  } catch (error) {
    throw new Error(
      `SQLite-Journalmodus konnte nicht auf WAL gesetzt werden (beobachtet: ${current?.journal_mode ?? 'unbekannt'}).`,
      { cause: error },
    );
  }

  const verified = await db.getFirstAsync<{ journal_mode?: string }>('PRAGMA journal_mode');
  if (verified?.journal_mode !== 'wal') {
    throw new Error(
      `SQLite-Journalmodus ist nicht WAL (beobachtet: ${verified?.journal_mode ?? 'unbekannt'}).`,
    );
  }
}

// Expo empfiehlt Foreign Keys direkt nach dem Öffnen der SQLite-Verbindung
// zu aktivieren: https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/
async function ensureForeignKeys(db: SerializedSqlDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
}

async function runLocalDrizzleMigrations(
  raw: import('expo-sqlite').SQLiteDatabase,
  db: SerializedSqlDatabase,
): Promise<void> {
  await db.withWriterLeaseAsync('db.migrations', async ({ markConnectionCleanupUnresolved }) => {
    try {
      await migrateExpoDatabase(createExpoDrizzleDatabase(raw), localMigrations);
    } catch (error) {
      // Drizzle runs its own synchronous BEGIN/ROLLBACK against the raw
      // handle. Any migration rejection may therefore leave that handle in
      // an unresolved transaction if its internal ROLLBACK also failed.
      markConnectionCleanupUnresolved(error);
      throw error;
    }
  });
}

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SerializedSqlDatabase | null = null;
let drizzleDatabase: DrizzleDatabase | null = null;
let opening: Promise<SerializedSqlDatabase> | null = null;
let lifecycleClosing: Promise<DatabaseLifecycleCloseResult> | null = null;
let wipeInProgress: Promise<void> | null = null;
let lifecycleGeneration = 0;
let openSequence = 0;
let connectionContextKey: string | null = null;
let connectionAccount: ActiveDatabaseAccount | null = null;
const pendingDatabaseCleanups = new Map<
  import('expo-sqlite').SQLiteDatabase,
  PendingDatabaseCleanup
>();
let openingContextKey: string | null = null;

const NO_ACTIVE_USER_ERROR = 'Ohne angemeldeten Nutzer ist die lokale Datenbank gesperrt.';
const DATABASE_CLOSING_ERROR = 'Die lokale Datenbank wird geschlossen.';

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
/** Für welche Nutzer-Id die geöffnete Datei bereits geprüft wurde. */
let checkedUserId: string | null = null;

export function getActiveDatabaseAccount(): ActiveDatabaseAccount {
  return { userId: activeUserId, generation: lifecycleGeneration };
}

export function setActiveUserId(userId: string | null): void {
  if (activeUserId !== userId) lifecycleGeneration += 1;
  activeUserId = userId;
}

function isVerifiedForActiveUser(): boolean {
  return (
    activeUserId !== null &&
    checkedUserId === activeUserId &&
    connectionAccount !== null &&
    connectionAccount.userId === activeUserId &&
    connectionAccount.generation === lifecycleGeneration
  );
}

function sameAccount(left: ActiveDatabaseAccount, right: ActiveDatabaseAccount): boolean {
  return left.userId === right.userId && left.generation === right.generation;
}

function currentDatabaseConnection(): DatabaseConnection | null {
  if (!database && !rawDatabase) return null;
  if (!database || !rawDatabase || !connectionAccount) {
    throw new Error('Der lokale Datenbankzustand besitzt keine eindeutige Connection-Ownership.');
  }
  return { db: database, raw: rawDatabase, account: connectionAccount };
}

function clearCurrentConnection(raw: import('expo-sqlite').SQLiteDatabase): void {
  if (rawDatabase !== raw) return;
  rawDatabase = null;
  database = null;
  drizzleDatabase = null;
  connectionContextKey = null;
  connectionAccount = null;
  resetOffDumpAttachment();
}

function hasUnresolvedDatabaseCleanup(): boolean {
  for (const pending of pendingDatabaseCleanups.values()) {
    if (pending.state === 'unresolved') return true;
  }
  return false;
}

function registerDatabaseHandle(
  raw: import('expo-sqlite').SQLiteDatabase,
  account: ActiveDatabaseAccount,
  openId: number,
): PendingDatabaseCleanup {
  const existing = pendingDatabaseCleanups.get(raw);
  if (existing) {
    if (existing.openId !== openId || !sameAccount(existing.account, account)) {
      throw new Error('Ein SQLite-Handle besitzt bereits eine andere Lifecycle-Ownership.');
    }
    return existing;
  }

  const pending: PendingDatabaseCleanup = {
    raw,
    account: { ...account },
    openId,
    state: 'opening',
    close: () => raw.closeAsync(),
  };
  pendingDatabaseCleanups.set(raw, pending);
  return pending;
}

function setDatabaseHandleCleanup(
  raw: import('expo-sqlite').SQLiteDatabase,
  close: () => Promise<void>,
  state?: PendingDatabaseCleanup['state'],
): void {
  const pending = pendingDatabaseCleanups.get(raw);
  if (!pending) {
    throw new Error('Ein geöffneter SQLite-Handle besitzt keine Lifecycle-Ownership.');
  }
  pending.close = close;
  if (state) pending.state = state;
}

async function closeRegisteredDatabaseHandle(
  raw: import('expo-sqlite').SQLiteDatabase,
): Promise<void> {
  const pending = pendingDatabaseCleanups.get(raw);
  if (!pending) {
    await raw.closeAsync();
    return;
  }

  try {
    await pending.close();
  } catch (error) {
    pending.state = 'unresolved';
    throw error;
  }
  if (pendingDatabaseCleanups.get(raw) === pending) pendingDatabaseCleanups.delete(raw);
}

async function closeOpeningDatabaseHandles(openId: number): Promise<unknown[]> {
  const errors: unknown[] = [];
  const openingHandles = [...pendingDatabaseCleanups.values()].filter(
    (pending) => pending.openId === openId && pending.state === 'opening',
  );
  for (const pending of openingHandles) {
    try {
      await closeRegisteredDatabaseHandle(pending.raw);
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

async function closePendingDatabaseCleanups(
  expectedAccount?: ActiveDatabaseAccount,
): Promise<DatabaseLifecycleCloseResult | null> {
  const pending = [...pendingDatabaseCleanups.values()];
  if (pending.length === 0) return null;

  if (expectedAccount) {
    const mismatch = pending.find((entry) => !sameAccount(entry.account, expectedAccount));
    if (mismatch) return { status: 'ownership-mismatch', account: mismatch.account };
  }

  const errors: unknown[] = [];
  for (const entry of pending) {
    try {
      await closeRegisteredDatabaseHandle(entry.raw);
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length > 0) throw errors[0];
  return { status: 'closed', account: pending[0].account };
}

function assertLifecycle(
  generation: number,
  userId: string,
  context: DatabaseExecutionContext,
): void {
  assertDatabaseAdmission(context);
  if (hasUnresolvedDatabaseCleanup()) throw new Error(DATABASE_CLOSING_ERROR);
  if (generation !== lifecycleGeneration || activeUserId !== userId || wipeInProgress !== null) {
    throw new Error('Der Datenbankzugriff wurde durch einen Accountwechsel abgebrochen.');
  }
}

async function open(
  openId: number,
  context: DatabaseExecutionContext,
  generation: number,
  userId: string,
): Promise<DatabaseConnection> {
  const assertCurrent = () => assertLifecycle(generation, userId, context);
  assertCurrent();
  dbTrace('OPEN-START', { openId });
  const SQLite = loadSQLite();
  const directories = getDatabaseDirectories(SQLite);
  const databaseDirectory = directories.primary;
  const writerOwner = createDatabaseWriterOwner(context);
  const fileWriterOwner = isAppGroupDirectory(directories, databaseDirectory)
    ? writerOwner
    : undefined;

  assertCurrent();
  const key = await getOrCreateDatabaseEncryptionKey(writerOwner);
  assertCurrent();
  const openingAccount: ActiveDatabaseAccount = { userId, generation };
  const files = fileWriterOwner
    ? createExpoDatabaseFileOps(databaseDirectory, { writerOwner: fileWriterOwner })
    : createExpoDatabaseFileOps(databaseDirectory);
  const openPlaintext = async (fileName: string) => {
    assertCurrent();
    const opened = await SQLite.openDatabaseAsync(
      fileName,
      { useNewConnection: true },
      databaseDirectory,
    );
    registerDatabaseHandle(opened, openingAccount, openId);
    try {
      assertCurrent();
      return opened;
    } catch (error) {
      await closeRegisteredDatabaseHandle(opened);
      throw error;
    }
  };
  const openEncrypted = async (fileName: string, encryptionKey: string) => {
    assertCurrent();
    const opened = await SQLite.openDatabaseAsync(
      fileName,
      {
        useNewConnection: true,
      },
      databaseDirectory,
    );
    registerDatabaseHandle(opened, openingAccount, openId);
    try {
      assertCurrent();
      // Muss das allererste Statement nach openDatabaseAsync bleiben.
      dbTrace('KEY-START', { openId });
      try {
        await keyAndVerifyDatabase(opened, encryptionKey);
        dbTrace('KEY-OK', { openId });
      } catch (error) {
        dbTrace('KEY-FAIL', { error: errorMessage(error), openId });
        throw error;
      }
      assertCurrent();
      return opened;
    } catch (error) {
      await closeRegisteredDatabaseHandle(opened);
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
        closeDatabase: closeRegisteredDatabaseHandle,
        writerOwner,
        assertCurrent,
        retainUnresolvedSourceCleanup: (databaseToClose, close) => {
          registerDatabaseHandle(databaseToClose, openingAccount, openId);
          setDatabaseHandleCleanup(databaseToClose, close, 'unresolved');
        },
      },
      key,
    );
    registerDatabaseHandle(openedDatabase, openingAccount, openId);
    assertCurrent();
    dbTrace('OPEN-CONNECTION-OK', { openId });
  } catch (error) {
    const closeErrors = await closeOpeningDatabaseHandles(openId);
    dbTrace('OPEN-CONNECTION-FAIL', { error: errorMessage(error), openId });
    if (closeErrors.length > 0) {
      throw new Error('Die veraltete Datenbanköffnung konnte nicht geschlossen werden.', {
        cause: new AggregateError([error, ...closeErrors]),
      });
    }
    throw error;
  }
  const db = serializeDatabase(toDriver(openedDatabase), {
    writerOwner,
    signal: context.signal,
    recoverAfterCleanupFailure: async () => {
      try {
        await openedDatabase.closeAsync();
      } catch (error) {
        const pending = pendingDatabaseCleanups.get(openedDatabase);
        if (pending) pending.state = 'unresolved';
        throw error;
      }
      pendingDatabaseCleanups.delete(openedDatabase);
      clearCurrentConnection(openedDatabase);
    },
  });
  setDatabaseHandleCleanup(openedDatabase, () =>
    db.closeForLifecycle(() => openedDatabase.closeAsync()),
  );
  const runOwnedStartupStep = (step: string, operation: () => Promise<unknown>) =>
    runStartupStep(openId, step, async () => {
      assertCurrent();
      await operation();
      assertCurrent();
    });

  try {
    // Netz fuer Connections, die uns nicht gehoeren: die Devtools-Registrierung
    // von `expo-sqlite` im Dev-Build und WAL-Checkpoints. Die Zugriffe der App
    // selbst laufen serialisiert ueber eine Connection und kollidieren nicht mehr
    // (siehe `serialize.ts`) — dieser PRAGMA ersetzt das nicht. Er muss vor dem
    // WAL-Modus gesetzt werden, damit auch der erste potenziell sperrende
    // Schreibzugriff beim Öffnen warten kann. Wert 5000, weil die UI alle 3 s
    // pollt: kuerzer hiesse, mitten im normalen Takt aufzugeben.
    await runOwnedStartupStep('busy_timeout', () => db.execAsync('PRAGMA busy_timeout = 5000'));

    await runOwnedStartupStep('foreign_keys', () => ensureForeignKeys(db));

    // WAL muss ausserhalb jeder Transaktion gesetzt werden — innerhalb lehnt
    // SQLite den Moduswechsel ab. Deshalb hier, vor den Migrationen. Bei einer
    // bereits als WAL geöffneten Datei bleibt der lock-sensitive Wechsel aus.
    await runOwnedStartupStep('journal_mode_wal', () => ensureWalJournalMode(db));

    await runOwnedStartupStep('drizzle_migrations', () =>
      runLocalDrizzleMigrations(openedDatabase, db),
    );
    await runOwnedStartupStep('admission_final', async () => {
      assertDatabaseAdmission(context);
    });
    dbTrace('INIT-OK', { openId });
  } catch (error) {
    // Nie automatisch löschen: In der Datei kann eine nicht synchronisierte
    // Outbox liegen. Insbesondere ein falscher/verlorener Key darf keinen
    // destruktiven "Recovery"-Pfad auslösen.
    dbTrace('INIT-FAIL', { error: errorMessage(error), openId });
    debugWarn('[db] Initialisierung fehlgeschlagen; Datenbank bleibt erhalten:', error);
    try {
      await closeRegisteredDatabaseHandle(openedDatabase);
    } catch (closeError) {
      throw new Error('Die fehlgeschlagene Datenbanköffnung konnte nicht geschlossen werden.', {
        cause: closeError,
      });
    }
    throw error;
  }

  return { raw: openedDatabase, db, account: { userId, generation } };
}

async function openAndVerify(
  openId: number,
  generation: number,
  userId: string,
  context: DatabaseExecutionContext,
): Promise<SerializedSqlDatabase> {
  dbTrace('VERIFY-START', {
    hasCachedConnection: Boolean(database && rawDatabase),
    openId,
  });
  const requestedAccount = { userId, generation };
  let connection = currentDatabaseConnection() ?? (await open(openId, context, generation, userId));

  try {
    assertLifecycle(generation, userId, context);
    if (checkedUserId !== userId || !sameAccount(connection.account, requestedAccount)) {
      const verified = await ensureDatabaseBelongsTo(
        connection.db,
        userId,
        async () => {
          await closeAndDeleteFile(connection, context);
          assertLifecycle(generation, userId, context);
          connection = await open(openId, context, generation, userId);
          assertLifecycle(generation, userId, context);
          return connection.db;
        },
        () => assertLifecycle(generation, userId, context),
      );
      connection = {
        ...connection,
        db: verified as SerializedSqlDatabase,
        account: requestedAccount,
      };
    }

    assertLifecycle(generation, userId, context);
    rawDatabase = connection.raw;
    database = connection.db;
    connectionContextKey = contextKey(context);
    connectionAccount = requestedAccount;
    checkedUserId = userId;
    // Publication and registry release are synchronous, so the raw handle is
    // always owned by either pending cleanup or the active connection.
    pendingDatabaseCleanups.delete(connection.raw);
    dbTrace('READY', { openId });
    return connection.db;
  } catch (error) {
    dbTrace('VERIFY-FAIL', { error: errorMessage(error), openId });
    // Eine noch nicht veröffentlichte Connection gehört ausschließlich diesem
    // fehlgeschlagenen Open-Lauf und darf nicht bis nach dem Wipe offen bleiben.
    if (connection.raw !== rawDatabase) {
      try {
        await closeRegisteredDatabaseHandle(connection.raw);
      } catch (closeError) {
        throw new Error('Eine veraltete Datenbanköffnung konnte nicht geschlossen werden.', {
          cause: closeError,
        });
      }
    }
    throw error;
  }
}

export function getDatabase(
  context: DatabaseExecutionContext = FOREGROUND_CONTEXT,
): Promise<SerializedSqlDatabase> {
  if (activeUserId === null) {
    return Promise.reject(new Error(NO_ACTIVE_USER_ERROR));
  }
  if (wipeInProgress) {
    return Promise.reject(new Error('Die lokale Datenbank wird gerade gelöscht.'));
  }
  if (hasUnresolvedDatabaseCleanup()) {
    return Promise.reject(new Error(DATABASE_CLOSING_ERROR));
  }

  try {
    assertDatabaseAdmission(context);
  } catch (error) {
    return Promise.reject(error);
  }

  const requestedContextKey = contextKey(context);
  if (lifecycleClosing) {
    return lifecycleClosing.then(() => getDatabase(context));
  }
  if (database && isVerifiedForActiveUser()) {
    if (connectionContextKey !== requestedContextKey) {
      return Promise.reject(new Error(DATABASE_CONTEXT_MISMATCH_ERROR));
    }
    return Promise.resolve(database);
  }

  if (opening) {
    if (openingContextKey !== requestedContextKey) {
      return Promise.reject(new Error(DATABASE_CONTEXT_MISMATCH_ERROR));
    }
    dbTrace('REQUEST-JOINED');
    return opening;
  }

  openSequence += 1;
  const openId = openSequence;
  const generation = lifecycleGeneration;
  const userId = activeUserId;
  openingContextKey = requestedContextKey;
  dbTrace('REQUEST-NEW', { generation, openId });
  const pending = measureOperation('db.open', async () => {
    try {
      return await openAndVerify(openId, generation, userId, context);
    } catch (error) {
      dbTrace('REQUEST-FAIL', { error: errorMessage(error), openId });
      throw error;
    }
  }).finally(() => {
    dbTrace('REQUEST-SETTLED', { openId });
    if (opening === pending) {
      opening = null;
      openingContextKey = null;
    }
  });
  opening = pending;

  return opening;
}

export async function getDrizzleDatabase(
  context: DatabaseExecutionContext = FOREGROUND_CONTEXT,
): Promise<DrizzleDatabase> {
  const db = await getDatabase(context);
  drizzleDatabase ??= createDrizzleDatabase(db);
  return drizzleDatabase;
}

/**
 * Runs a retryable, lifecycle-reserved action against the current account.
 * An app-background close can begin between `getDatabase()` and the action's
 * own lifecycle reservation; wait for that close and retry only while the
 * same account generation remains active.
 */
export async function runWithCurrentDatabase<T>(
  action: (db: SerializedSqlDatabase) => Promise<T>,
  context: DatabaseExecutionContext = FOREGROUND_CONTEXT,
): Promise<T> {
  const userId = activeUserId;
  if (userId === null) throw new Error(NO_ACTIVE_USER_ERROR);
  const generation = lifecycleGeneration;

  while (true) {
    assertLifecycle(generation, userId, context);
    const db = await getDatabase(context);
    assertLifecycle(generation, userId, context);

    try {
      return await action(db);
    } catch (error) {
      const closing = lifecycleClosing;
      if (errorMessage(error) !== DATABASE_CLOSING_ERROR) throw error;
      if (closing) {
        await closing;
        continue;
      }

      // A very fast close can settle before this rejection is observed. Retry
      // only if getDatabase has replaced the closed connection successfully.
      assertLifecycle(generation, userId, context);
      const reopenedDb = await getDatabase(context);
      assertLifecycle(generation, userId, context);
      if (reopenedDb === db) throw error;
    }
  }
}

/** Schließt die SQLite-Verbindung nach dem Leeren der serialisierten Query-Warteschlange. */
export function closeDatabaseForLifecycle(
  expectedAccount?: ActiveDatabaseAccount,
): Promise<DatabaseLifecycleCloseResult> {
  if (lifecycleClosing) {
    if (!expectedAccount) return lifecycleClosing;
    return lifecycleClosing.then(() => closeDatabaseForLifecycle(expectedAccount));
  }

  const closing = (async (): Promise<DatabaseLifecycleCloseResult> => {
    if (opening) {
      try {
        await opening;
      } catch {
        // A failed open may have retained a raw handle because its own close
        // failed. Continue and inspect the retained connection directly.
      }
    }

    let pendingCleanupResult: DatabaseLifecycleCloseResult | null = null;
    if (pendingDatabaseCleanups.size > 0) {
      try {
        pendingCleanupResult = await closePendingDatabaseCleanups(expectedAccount);
      } catch (error) {
        debugWarn('[db] Offener SQLite-Handle konnte nicht geschlossen werden:', error);
        throw error;
      }
      if (pendingCleanupResult?.status === 'ownership-mismatch') return pendingCleanupResult;
    }

    const connection = currentDatabaseConnection();
    if (!connection) return pendingCleanupResult ?? { status: 'not-open' };
    if (expectedAccount && !sameAccount(connection.account, expectedAccount)) {
      return { status: 'ownership-mismatch', account: connection.account };
    }

    try {
      await connection.db.closeForLifecycle(() => connection.raw.closeAsync());
      clearCurrentConnection(connection.raw);
      dbTrace('LIFECYCLE-CLOSED');
      return { status: 'closed', account: connection.account };
    } catch (error) {
      debugWarn('[db] Verbindung beim App-Wechsel konnte nicht geschlossen werden:', error);
      throw error;
    }
  })().finally(() => {
    if (lifecycleClosing === closing) lifecycleClosing = null;
  });
  lifecycleClosing = closing;
  return closing;
}

async function closeAndDeleteFile(
  connection: DatabaseConnection | undefined,
  context: DatabaseExecutionContext,
): Promise<void> {
  assertDatabaseAdmission(context);
  const SQLite = loadSQLite();
  const errors: unknown[] = [];
  const connectionToClose = connection ?? currentDatabaseConnection();

  if (connectionToClose) {
    const isPublishedConnection = connectionToClose.raw === rawDatabase;
    if (!isPublishedConnection && !pendingDatabaseCleanups.has(connectionToClose.raw)) {
      registerDatabaseHandle(connectionToClose.raw, connectionToClose.account, openSequence);
      setDatabaseHandleCleanup(connectionToClose.raw, () =>
        connectionToClose.db.closeForLifecycle(() => connectionToClose.raw.closeAsync()),
      );
    }

    try {
      if (pendingDatabaseCleanups.has(connectionToClose.raw)) {
        await closeRegisteredDatabaseHandle(connectionToClose.raw);
      } else {
        await connectionToClose.db.closeForLifecycle(() => connectionToClose.raw.closeAsync());
      }
    } catch (error) {
      throw new Error('Die lokale Datenbank konnte nicht geschlossen werden.', {
        cause: error,
      });
    }
  }

  if (pendingDatabaseCleanups.size > 0) {
    try {
      await closePendingDatabaseCleanups();
    } catch (error) {
      throw new Error('Die lokale Datenbank konnte nicht geschlossen werden.', {
        cause: error,
      });
    }
  }

  // Die geloeschte Datei nimmt jeden bisherigen `ATTACH ... AS off_dump` mit —
  // ohne diesen Reset wuerde `attachOffDump()` faelschlich "schon angehaengt"
  // gegen die naechste, frische Connection melden (siehe off-dump.ts).
  if (connectionToClose) clearCurrentConnection(connectionToClose.raw);
  else resetOffDumpAttachment();

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

  try {
    const directories = getDatabaseDirectories(SQLite);
    const directoriesToDelete = [
      ...new Set([directories.primary, directories.defaultDirectory, directories.appGroup]),
    ].filter((directory): directory is string => directory !== undefined);
    const writerOwner = createDatabaseWriterOwner(context);
    for (const directory of directoriesToDelete) {
      const files = isAppGroupDirectory(directories, directory)
        ? createExpoDatabaseFileOps(directory, { writerOwner })
        : createExpoDatabaseFileOps(directory);
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
  } catch (error) {
    errors.push(error);
  }

  if (errors.length > 0) {
    throw new Error('Der lokale Datenbank-Wipe ist fehlgeschlagen.', {
      cause: errors[0],
    });
  }

  // Den Key nie vor den Dateien löschen. Sonst würde ein fehlgeschlagener Wipe
  // die verbliebene Datenbank nur unlesbar machen, aber nicht entfernen.
  await deleteDatabaseEncryptionKey(createDatabaseWriterOwner(context));
}

export function deleteLocalDatabase(
  context: DatabaseExecutionContext = FOREGROUND_CONTEXT,
): Promise<void> {
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

    await closeAndDeleteFile(undefined, context);
    checkedUserId = null;
  })().finally(() => {
    if (wipeInProgress === wipe) wipeInProgress = null;
  });

  wipeInProgress = wipe;
  return wipe;
}
