import type {
  SharedStoreWriterLease,
  SharedStoreWriterOwner,
} from '@/lib/apple/shared-store-lifecycle';
import { sharedStoreWriterOwner } from '@/lib/apple/shared-store-lifecycle';
import type { SqlDatabase } from '@/lib/db/types';
import { debugWarn } from '../observability/debug-log';

/** Der Teil des Ports, den ein Treiber direkt erfuellen kann — alles ausser Transaktionen. */
export type SqlStatementDriver = Omit<SqlDatabase, 'withExclusiveTransactionAsync'>;

export type SerializeDatabaseOptions = {
  writerOwner?: SharedStoreWriterOwner;
  signal?: AbortSignal;
  /** Closes or otherwise releases the raw handle after unresolved rollback/detach cleanup. */
  recoverAfterCleanupFailure?: () => Promise<void>;
};

export type SerializedWriterScope = {
  db: SqlDatabase;
  /** Cleanup for an attached resource; it never starts a new writer. */
  cleanupExecAsync(source: string): Promise<void>;
  /** Records cleanup that may still own a lock so raw recovery runs before lease release. */
  markConnectionCleanupUnresolved(error: unknown): void;
};

export type SerializedSqlDatabase = SqlDatabase & {
  /**
   * Reserviert die Verbindung für einen mehrstufigen Vorgang. Ein bereits
   * angeforderter Lifecycle-Close wartet, bis der Vorgang vollständig beendet
   * ist; neue normale Zugriffe bleiben ab der Close-Anforderung gesperrt.
   */
  withLifecycleOperationAsync<T>(task: (db: SqlDatabase) => Promise<T>): Promise<T>;
  /**
   * Holds one writer lease across a short multi-step database phase. Cleanup
   * for resources acquired by the phase uses the held scope instead of
   * acquiring a new writer after cancellation.
   */
  withWriterLeaseAsync<T>(
    name: string,
    task: (scope: SerializedWriterScope) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T>;
  /**
   * Schließt den Port exklusiv hinter allen bereits reservierten Operationen.
   * Ab dem synchronen Aufruf werden keine neuen Statements mehr angenommen.
   */
  closeForLifecycle(task: () => Promise<void>): Promise<void>;
};

const NESTED_TRANSACTION_MESSAGE =
  'withExclusiveTransactionAsync ist nicht verschachtelbar: SQLite kennt keine ' +
  'echten verschachtelten Transaktionen.';
const WRITER_ADMISSION_ERROR =
  'Der native Schreibzugriff ist im aktuellen Lifecycle nicht zugelassen.';
const WRITER_EXPIRED_ERROR = 'Die native Schreibzusicherung ist abgelaufen.';
const INVALID_CLEANUP_STATEMENT_ERROR =
  'Die Cleanup-Scope darf nur bereits geöffnete SQLite-Aliase detachen.';
const BEGIN_RETRY_DELAYS_MS = [50, 100, 200, 400, 800] as const;

function isSQLiteBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:database(?: table)? is locked|SQLITE_BUSY)/i.test(message);
}

function traceSqlFailure(method: string, source: string, error: unknown): void {
  debugWarn('[DBTRACE:SQL-FAIL]', {
    error: error instanceof Error ? error.message : String(error),
    method,
    source: source.trim().slice(0, 180),
  });
}

function stripSqlComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\r\n]*/g, ' ')
    .trim();
}

/** Classifies SQL without treating read-only queries or PRAGMAs as writers. */
export function isMutatingSql(source: string): boolean {
  const sql = stripSqlComments(source);
  if (sql.length === 0 || /^(?:EXPLAIN|SELECT|VALUES)\b/i.test(sql)) return false;

  if (/^PRAGMA\s+/i.test(sql)) {
    return /\s*=|^PRAGMA\s+wal_checkpoint\b/i.test(sql);
  }

  if (/^(?:ATTACH|DETACH|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|END)\b/i.test(sql)) {
    return true;
  }

  return /\b(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|ALTER|DROP|VACUUM|REINDEX|ANALYZE)\b/i.test(sql);
}

function assertCleanupStatement(source: string): void {
  if (!/^DETACH\s+DATABASE\b/i.test(stripSqlComments(source))) {
    throw new Error(INVALID_CLEANUP_STATEMENT_ERROR);
  }
}

function assertWriterLease(lease: SharedStoreWriterLease): void {
  if (lease.signal.aborted) throw new Error(WRITER_EXPIRED_ERROR);
  if (lease.ended) throw new Error(WRITER_ADMISSION_ERROR);
}

function acquireWriterLease(
  owner: SharedStoreWriterOwner,
  name: string,
  signal?: AbortSignal,
): SharedStoreWriterLease {
  const lease = owner.beginWriterLease(name, { signal });
  if (!lease) throw new Error(`${WRITER_ADMISSION_ERROR} (${name})`);

  try {
    assertWriterLease(lease);
    return lease;
  } catch (error) {
    lease.end();
    throw error;
  }
}

function waitForRetryDelay(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error(WRITER_EXPIRED_ERROR));

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, delay);
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new Error(WRITER_EXPIRED_ERROR));
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

async function execWithBusyRetry(
  driver: SqlStatementDriver,
  source: string,
  lease: SharedStoreWriterLease,
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    assertWriterLease(lease);
    try {
      await driver.execAsync(source);
      return;
    } catch (error) {
      traceSqlFailure('retry', source, error);
      const delay = BEGIN_RETRY_DELAYS_MS[attempt];
      if (!isSQLiteBusyError(error) || delay === undefined) throw error;
      await waitForRetryDelay(delay, lease.signal);
    }
  }
}

async function beginImmediateWithRetry(
  driver: SqlStatementDriver,
  lease: SharedStoreWriterLease,
): Promise<void> {
  await execWithBusyRetry(driver, 'BEGIN IMMEDIATE', lease);
}

async function commitOnce(driver: SqlStatementDriver): Promise<void> {
  try {
    await driver.execAsync('COMMIT');
  } catch (error) {
    traceSqlFailure('commit', 'COMMIT', error);
    throw error;
  }
}

function normalizeOptions(
  options: SerializeDatabaseOptions | SharedStoreWriterOwner,
): SerializeDatabaseOptions {
  if ('beginWriterLease' in options) return { writerOwner: options };
  return options;
}

export function serializeDatabase(
  driver: SqlStatementDriver,
  input: SerializeDatabaseOptions | SharedStoreWriterOwner = {},
): SerializedSqlDatabase {
  const options = normalizeOptions(input);
  const writerOwner = options.writerOwner ?? sharedStoreWriterOwner;
  const writerSignal = options.signal;
  const getAllRawAsync = driver.getAllRawAsync?.bind(driver);

  /**
   * Die Warteschlange. `tail` lehnt nie ab (siehe `withLock`), sonst wuerde ein
   * einzelner Fehler jeden spaeteren Zugriff mitreissen.
   */
  let tail: Promise<void> = Promise.resolve();
  let acceptingStatements = true;
  let lifecycleClose: Promise<void> | null = null;
  let activeLifecycleOperations = 0;
  const lifecycleOperationWaiters = new Set<() => void>();
  let connectionCleanupState: 'usable' | 'unresolved' | 'closed' = 'usable';
  const leasesAwaitingCleanup = new Set<SharedStoreWriterLease>();

  function releaseCleanupLeases(): void {
    for (const lease of leasesAwaitingCleanup) {
      if (!lease.ended) lease.end();
    }
    leasesAwaitingCleanup.clear();
  }

  async function resolveCleanupFailure(
    lease: SharedStoreWriterLease,
    cleanupError: unknown,
  ): Promise<void> {
    if (connectionCleanupState === 'closed') return;

    // No queued or future statement may touch a connection whose transaction
    // or attached alias could still own a file lock.
    acceptingStatements = false;
    connectionCleanupState = 'unresolved';
    leasesAwaitingCleanup.add(lease);

    const recover = options.recoverAfterCleanupFailure;
    if (!recover) return;

    try {
      await recover();
      connectionCleanupState = 'closed';
      releaseCleanupLeases();
    } catch (recoveryError) {
      debugWarn('[db] SQLite-Cleanup und Raw-Close sind fehlgeschlagen:', {
        cleanupError,
        recoveryError,
      });
    }
  }

  function assertConnectionUsable(): void {
    if (connectionCleanupState !== 'usable') {
      throw new Error('Die lokale Datenbank wird geschlossen.');
    }
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  function withLock<T>(task: () => Promise<T>): Promise<T> {
    if (!acceptingStatements) {
      return Promise.reject(new Error('Die lokale Datenbank wird geschlossen.'));
    }
    return enqueue(() => {
      assertConnectionUsable();
      return task();
    });
  }

  function withLifecycleOperationStatement<T>(task: () => Promise<T>): Promise<T> {
    if (!acceptingStatements) {
      return Promise.reject(new Error('Die lokale Datenbank wird geschlossen.'));
    }
    return enqueue(() => {
      assertConnectionUsable();
      return task();
    });
  }

  function waitForLifecycleOperations(): Promise<void> {
    if (activeLifecycleOperations === 0) return Promise.resolve();
    return new Promise((resolve) => lifecycleOperationWaiters.add(resolve));
  }

  function finishLifecycleOperation(): void {
    activeLifecycleOperations -= 1;
    if (activeLifecycleOperations !== 0) return;
    for (const resolve of lifecycleOperationWaiters) resolve();
    lifecycleOperationWaiters.clear();
  }

  async function runMutatingStatement<T>(
    name: string,
    operation: (lease: SharedStoreWriterLease) => Promise<T>,
  ): Promise<T> {
    const lease = acquireWriterLease(writerOwner, name, writerSignal);
    try {
      assertWriterLease(lease);
      return await operation(lease);
    } finally {
      lease.end();
    }
  }

  async function runStatement<T>(
    method: 'execAsync' | 'runAsync',
    source: string,
    operation: (lease?: SharedStoreWriterLease) => Promise<T>,
  ): Promise<T> {
    if (!isMutatingSql(source)) {
      try {
        return await operation();
      } catch (error) {
        traceSqlFailure(method, source, error);
        throw error;
      }
    }

    return runMutatingStatement(`sqlite.${method}`, operation);
  }

  function createTransactionPort(lease: SharedStoreWriterLease): SqlDatabase {
    return {
      execAsync: async (source) => {
        assertWriterLease(lease);
        try {
          await driver.execAsync(source);
        } catch (error) {
          traceSqlFailure('transaction.execAsync', source, error);
          throw error;
        }
      },
      runAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.runAsync(source, params);
      },
      getAllAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.getAllAsync(source, params);
      },
      getFirstAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.getFirstAsync(source, params);
      },
      getAllRawAsync: getAllRawAsync
        ? async (source, params) => {
            assertWriterLease(lease);
            return getAllRawAsync(source, params);
          }
        : undefined,
      withExclusiveTransactionAsync: () => Promise.reject(new Error(NESTED_TRANSACTION_MESSAGE)),
    };
  }

  async function runExclusiveTransaction(
    task: (txn: SqlDatabase) => Promise<void>,
    signal?: AbortSignal,
    existingLease?: SharedStoreWriterLease,
  ): Promise<void> {
    const ownsLease = existingLease === undefined;
    const lease =
      existingLease ??
      acquireWriterLease(writerOwner, 'sqlite.transaction', signal ?? writerSignal);
    let transactionStarted = false;

    try {
      // BEGIN vor dem try, damit ein fehlgeschlagenes BEGIN nicht durch ROLLBACK verdeckt wird.
      await beginImmediateWithRetry(driver, lease);
      transactionStarted = true;
      assertWriterLease(lease);
      await task(createTransactionPort(lease));
      assertWriterLease(lease);
      await commitOnce(driver);
    } catch (error) {
      if (transactionStarted) {
        try {
          // ROLLBACK ist die Ressourcenfreigabe nach Expiration und darf
          // deshalb nicht durch eine neue Writer-Zusicherung verhindert werden.
          await driver.execAsync('ROLLBACK');
        } catch (rollbackError) {
          // Der ursprüngliche Fehler bleibt maßgeblich. Die Lease bleibt aber
          // erhalten, bis ein Raw-Close oder späterer Lifecycle-Close den
          // potenziellen SQLite-Lock nachweislich freigegeben hat.
          debugWarn('[db] ROLLBACK fehlgeschlagen:', rollbackError);
          await resolveCleanupFailure(lease, rollbackError);
        }
      }
      throw error;
    } finally {
      // Erst nach COMMIT, abgeschlossenem ROLLBACK oder bestätigtem Raw-Close
      // darf die Assertion enden.
      if (ownsLease && !leasesAwaitingCleanup.has(lease) && !lease.ended) lease.end();
    }
  }

  function createWriterScopeDatabase(lease: SharedStoreWriterLease): SqlDatabase {
    return {
      execAsync: async (source) => {
        assertWriterLease(lease);
        try {
          await driver.execAsync(source);
        } catch (error) {
          traceSqlFailure('writerScope.execAsync', source, error);
          throw error;
        }
      },
      runAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.runAsync(source, params);
      },
      getAllAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.getAllAsync(source, params);
      },
      getFirstAsync: async (source, params) => {
        assertWriterLease(lease);
        return driver.getFirstAsync(source, params);
      },
      getAllRawAsync: getAllRawAsync
        ? async (source, params) => {
            assertWriterLease(lease);
            return getAllRawAsync(source, params);
          }
        : undefined,
      withExclusiveTransactionAsync: (task, options) =>
        runExclusiveTransaction(task, options?.signal, lease),
    };
  }

  async function runWriterScope<T>(
    name: string,
    task: (scope: SerializedWriterScope) => Promise<T>,
    signal?: AbortSignal,
  ): Promise<T> {
    const lease = acquireWriterLease(writerOwner, name, signal ?? writerSignal);
    let cleanupFailed = false;
    let cleanupFailure: unknown;
    let outcome: { ok: true; value: T } | { ok: false; error: unknown };
    const markConnectionCleanupUnresolved = (error: unknown) => {
      cleanupFailed = true;
      cleanupFailure = error;
    };

    try {
      const value = await task({
        db: createWriterScopeDatabase(lease),
        cleanupExecAsync: async (source) => {
          assertCleanupStatement(source);
          try {
            await driver.execAsync(source);
          } catch (error) {
            markConnectionCleanupUnresolved(error);
            traceSqlFailure('writerScope.cleanupExecAsync', source, error);
            throw error;
          }
        },
        markConnectionCleanupUnresolved,
      });
      assertWriterLease(lease);
      outcome = { ok: true, value };
    } catch (error) {
      outcome = { ok: false, error };
    }

    if (cleanupFailed) {
      await resolveCleanupFailure(lease, cleanupFailure);
      if (outcome.ok) outcome = { ok: false, error: cleanupFailure };
    }

    if (!leasesAwaitingCleanup.has(lease) && !lease.ended) lease.end();
    if (!outcome.ok) throw outcome.error;
    return outcome.value;
  }

  const lifecycleOperationPort: SqlDatabase = {
    execAsync: (source) =>
      withLifecycleOperationStatement(() =>
        runStatement('execAsync', source, () =>
          driver.execAsync(source).catch((error: unknown) => {
            traceSqlFailure('lifecycleOperation.execAsync', source, error);
            throw error;
          }),
        ),
      ),
    runAsync: (source, params) =>
      withLifecycleOperationStatement(() =>
        runStatement('runAsync', source, () => driver.runAsync(source, params)),
      ),
    getAllAsync: (source, params) =>
      withLifecycleOperationStatement(() => driver.getAllAsync(source, params)),
    getFirstAsync: (source, params) =>
      withLifecycleOperationStatement(() => driver.getFirstAsync(source, params)),
    getAllRawAsync: getAllRawAsync
      ? (source, params) => withLifecycleOperationStatement(() => getAllRawAsync(source, params))
      : undefined,
    withExclusiveTransactionAsync: (task, options) =>
      withLifecycleOperationStatement(() => runExclusiveTransaction(task, options?.signal)),
  };

  const serialized: SerializedSqlDatabase = {
    execAsync: (source) =>
      withLock(() =>
        runStatement('execAsync', source, () =>
          driver.execAsync(source).catch((error: unknown) => {
            traceSqlFailure('execAsync', source, error);
            throw error;
          }),
        ),
      ),
    runAsync: (source, params) =>
      withLock(() => runStatement('runAsync', source, () => driver.runAsync(source, params))),
    getAllAsync: (source, params) => withLock(() => driver.getAllAsync(source, params)),
    getFirstAsync: (source, params) => withLock(() => driver.getFirstAsync(source, params)),
    getAllRawAsync: getAllRawAsync
      ? (source, params) => withLock(() => getAllRawAsync(source, params))
      : undefined,
    withExclusiveTransactionAsync: (task, options) =>
      withLock(() => runExclusiveTransaction(task, options?.signal)),
    withWriterLeaseAsync: (name, task, signal) =>
      withLock(() => runWriterScope(name, task, signal)),
    withLifecycleOperationAsync: <T>(task: (db: SqlDatabase) => Promise<T>) => {
      if (!acceptingStatements) {
        return Promise.reject(new Error('Die lokale Datenbank wird geschlossen.'));
      }

      activeLifecycleOperations += 1;
      return Promise.resolve()
        .then(() => task(lifecycleOperationPort))
        .finally(finishLifecycleOperation);
    },
    closeForLifecycle: (task) => {
      if (lifecycleClose) return lifecycleClose;
      // Synchron sperren, bevor der erste await-Zyklus einem neuen Aufrufer
      // Gelegenheit gibt, sich hinter den Close einzureihen.
      acceptingStatements = false;
      const closeRawHandle = async () => {
        if (connectionCleanupState !== 'closed') await task();
        connectionCleanupState = 'closed';
        releaseCleanupLeases();
      };
      const closing =
        activeLifecycleOperations === 0
          ? enqueue(closeRawHandle)
          : waitForLifecycleOperations().then(() => enqueue(closeRawHandle));
      lifecycleClose = closing;
      void closing.catch(() => {
        // Der Port bleibt für Statements gesperrt, aber ein späterer
        // orphan-cleanup darf den nativen Close erneut versuchen. Bis dahin
        // bleiben alle Leases mit unresolved SQLite-Ressourcen erhalten.
        if (lifecycleClose === closing) lifecycleClose = null;
      });
      return closing;
    },
  };

  return serialized;
}

export function isSerializedSqlDatabase(db: SqlDatabase): db is SerializedSqlDatabase {
  return typeof (db as Partial<SerializedSqlDatabase>).withWriterLeaseAsync === 'function';
}

export type { SharedStoreWriterLease, SharedStoreWriterOwner };
export { WRITER_ADMISSION_ERROR, WRITER_EXPIRED_ERROR };
