import type { SqlDatabase } from '@/lib/db/types';

/**
 * Serialisiert eine SQLite-Connection und nutzt `BEGIN IMMEDIATE`. Dadurch
 * werden `SQLITE_BUSY_SNAPSHOT` und versehentlich in fremde Transaktionen
 * laufende Abfragen vermieden.
 */

export type SqlStatementDriver = Omit<SqlDatabase, 'withExclusiveTransactionAsync'>;

const NESTED_TRANSACTION_MESSAGE =
  'withExclusiveTransactionAsync ist nicht verschachtelbar: SQLite kennt keine ' +
  'echten verschachtelten Transaktionen.';

export function serializeDatabase(driver: SqlStatementDriver): SqlDatabase {
  // `tail` lehnt nie ab, damit Fehler spaetere Aufgaben nicht blockieren.
  let tail: Promise<void> = Promise.resolve();

  function withLock<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  // Innerhalb der Transaktion ist der Mutex bereits gehalten.
  const transactionPort: SqlDatabase = {
    execAsync: (source) => driver.execAsync(source),
    runAsync: (source, params) => driver.runAsync(source, params),
    getAllAsync: (source, params) => driver.getAllAsync(source, params),
    getFirstAsync: (source, params) => driver.getFirstAsync(source, params),
    withExclusiveTransactionAsync: () => Promise.reject(new Error(NESTED_TRANSACTION_MESSAGE)),
  };

  return {
    execAsync: (source) => withLock(() => driver.execAsync(source)),
    runAsync: (source, params) => withLock(() => driver.runAsync(source, params)),
    getAllAsync: (source, params) => withLock(() => driver.getAllAsync(source, params)),
    getFirstAsync: (source, params) => withLock(() => driver.getFirstAsync(source, params)),

    withExclusiveTransactionAsync: (task) =>
      withLock(async () => {
        // Ein fehlgeschlagenes BEGIN darf keinen irrefuehrenden ROLLBACK ausloesen.
        await driver.execAsync('BEGIN IMMEDIATE');

        try {
          await task(transactionPort);
          await driver.execAsync('COMMIT');
        } catch (error) {
          try {
            await driver.execAsync('ROLLBACK');
          } catch (rollbackError) {
            // Der urspruengliche Transaktionsfehler bleibt autoritativ.
            console.warn('[db] ROLLBACK fehlgeschlagen:', rollbackError);
          }
          throw error;
        }
      }),
  };
}
