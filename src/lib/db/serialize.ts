import type { SqlDatabase } from '@/lib/db/types';

/** Der Teil des Ports, den ein Treiber direkt erfuellen kann — alles ausser Transaktionen. */
export type SqlStatementDriver = Omit<SqlDatabase, 'withExclusiveTransactionAsync'>;

export type SerializedSqlDatabase = SqlDatabase & {
  /**
   * Schließt den Port exklusiv hinter allen bereits reservierten Operationen.
   * Ab dem synchronen Aufruf werden keine neuen Statements mehr angenommen.
   */
  closeForLifecycle(task: () => Promise<void>): Promise<void>;
};

const NESTED_TRANSACTION_MESSAGE =
  'withExclusiveTransactionAsync ist nicht verschachtelbar: SQLite kennt keine ' +
  'echten verschachtelten Transaktionen.';

export function serializeDatabase(driver: SqlStatementDriver): SerializedSqlDatabase {
  const getAllRawAsync = driver.getAllRawAsync?.bind(driver);
  /**
   * Die Warteschlange. `tail` lehnt nie ab (siehe `withLock`), sonst wuerde ein
   * einzelner Fehler jeden spaeteren Zugriff mitreissen.
   */
  let tail: Promise<void> = Promise.resolve();
  let acceptingStatements = true;
  let lifecycleClose: Promise<void> | null = null;

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
    return enqueue(task);
  }

  const transactionPort: SqlDatabase = {
    execAsync: (source) => driver.execAsync(source),
    runAsync: (source, params) => driver.runAsync(source, params),
    getAllAsync: (source, params) => driver.getAllAsync(source, params),
    getFirstAsync: (source, params) => driver.getFirstAsync(source, params),
    getAllRawAsync,
    withExclusiveTransactionAsync: () => Promise.reject(new Error(NESTED_TRANSACTION_MESSAGE)),
  };

  return {
    execAsync: (source) => withLock(() => driver.execAsync(source)),
    runAsync: (source, params) => withLock(() => driver.runAsync(source, params)),
    getAllAsync: (source, params) => withLock(() => driver.getAllAsync(source, params)),
    getFirstAsync: (source, params) => withLock(() => driver.getFirstAsync(source, params)),
    getAllRawAsync: getAllRawAsync
      ? (source, params) => withLock(() => getAllRawAsync(source, params))
      : undefined,

    withExclusiveTransactionAsync: (task) =>
      withLock(async () => {
        // BEGIN vor dem try, damit ein fehlgeschlagenes BEGIN nicht durch ROLLBACK verdeckt wird.
        await driver.execAsync('BEGIN IMMEDIATE');

        try {
          await task(transactionPort);
          await driver.execAsync('COMMIT');
        } catch (error) {
          try {
            await driver.execAsync('ROLLBACK');
          } catch (rollbackError) {
            // Den ursprünglichen Fehler erhalten; ein Rollback-Fehler wird nur protokolliert.
            console.warn('[db] ROLLBACK fehlgeschlagen:', rollbackError);
          }
          throw error;
        }
      }),
    closeForLifecycle: (task) => {
      if (lifecycleClose) return lifecycleClose;
      // Synchron sperren, bevor der erste await-Zyklus einem neuen Aufrufer
      // Gelegenheit gibt, sich hinter dem Close einzureihen.
      acceptingStatements = false;
      const closing = enqueue(task);
      lifecycleClose = closing;
      void closing.catch(() => {
        // Der Port bleibt für Statements gesperrt, aber ein späterer
        // orphan-cleanup darf den nativen Close erneut versuchen.
        if (lifecycleClose === closing) lifecycleClose = null;
      });
      return closing;
    },
  };
}
