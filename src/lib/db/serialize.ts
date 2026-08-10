import type { SqlDatabase } from '@/lib/db/types';

/**
 * Macht aus einem Statement-Treiber einen `SqlDatabase`-Port mit echten,
 * serialisierten Transaktionen.
 *
 * Diese Datei importiert — wie `types.ts` — absichtlich nichts Natives. Die
 * gesamte Logik ist damit unter Jest gegen `node:sqlite` pruefbar; `client.ts`
 * verdrahtet sie nur noch mit `expo-sqlite`.
 *
 * ## Warum es diese Schicht ueberhaupt gibt
 *
 * `expo-sqlite` bringt ein `withExclusiveTransactionAsync` mit, das nach Namen
 * genau das tut, was der Port zusichert. Tatsaechlich tut es etwas anderes
 * (nachgelesen in `expo-sqlite@57.0.1`, `build/SQLiteDatabase.js:155-175`):
 *
 * 1. Es oeffnet fuer **jede** Transaktion eine **neue native Connection**
 *    (`useNewConnection: true`), statt die bestehende zu benutzen.
 * 2. Es setzt ein einfaches `BEGIN` ab — eine *deferred* Transaktion, kein
 *    `BEGIN EXCLUSIVE`.
 *
 * Beides zusammen erzeugt genau den Fehler, den wir gesehen haben. In WAL darf
 * connection-uebergreifend nur einer schreiben. Und weil unsere Transaktionen
 * erst lesen und dann schreiben (`applyRemoteRow`), muss eine deferred
 * Transaktion die Lesesperre unterwegs zur Schreibsperre hochstufen — findet
 * sie dabei fremde Schreibzugriffe vor, liefert SQLite `SQLITE_BUSY_SNAPSHOT`.
 * Ein `busy_timeout` hilft dort nicht: Der Busy-Handler wird fuer diesen Fall
 * bewusst nicht aufgerufen, weil Warten den Konflikt nicht aufloesen koennte.
 * Die SQLite-Doku nennt eine einzige Abhilfe — `BEGIN IMMEDIATE`, das die
 * Schreibsperre sofort nimmt und danach bis zum COMMIT kein `SQLITE_BUSY` mehr
 * zulaesst.
 *
 * Deshalb hier: **eine** Connection, `BEGIN IMMEDIATE`, und alle Zugriffe
 * nacheinander.
 *
 * ## Warum zusaetzlich serialisiert wird
 *
 * Auf einer einzigen Connection gibt es keine Sperrkonkurrenz mehr — dafuer
 * einen anderen Fallstrick: Eine Abfrage, die waehrend `BEGIN IMMEDIATE … COMMIT`
 * hereinkommt, laeuft auf derselben Connection und wird damit ungewollt Teil
 * der Transaktion. Ein Rollback wuerde sie mitnehmen. Genau das beschreibt der
 * Kommentar an `withExclusiveTransactionAsync` in `types.ts` als Grund gegen
 * `withTransactionAsync`. Der Mutex stellt sicher, dass es nicht passieren
 * kann: Waehrend einer Transaktion wartet jeder andere Zugriff.
 *
 * Praktisch kostet das nichts. Die Statements sind kurz (Zaehlabfragen,
 * Einzelzeilen); der groesste Block ist eine Pull-Seite, und die lief auch
 * vorher schon am Stueck.
 */

/** Der Teil des Ports, den ein Treiber direkt erfuellen kann — alles ausser Transaktionen. */
export type SqlStatementDriver = Omit<SqlDatabase, 'withExclusiveTransactionAsync'>;

const NESTED_TRANSACTION_MESSAGE =
  'withExclusiveTransactionAsync ist nicht verschachtelbar: SQLite kennt keine ' +
  'echten verschachtelten Transaktionen.';

export function serializeDatabase(driver: SqlStatementDriver): SqlDatabase {
  /**
   * Die Warteschlange. `tail` lehnt nie ab (siehe `withLock`), sonst wuerde ein
   * einzelner Fehler jeden spaeteren Zugriff mitreissen.
   */
  let tail: Promise<void> = Promise.resolve();

  function withLock<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  /**
   * Das Handle *innerhalb* einer Transaktion.
   *
   * Nimmt den Mutex nicht — der wird vom umgebenden
   * `withExclusiveTransactionAsync` bereits gehalten, ein zweiter Versuch waere
   * ein Deadlock gegen sich selbst.
   */
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
        // Bewusst VOR dem try: Scheitert schon das BEGIN, ist keine Transaktion
        // offen, und ein ROLLBACK im catch wuerde mit "cannot rollback - no
        // transaction is active" die eigentliche Ursache ueberschreiben. Genau
        // diesen Fehler hat die Implementierung in `expo-sqlite`.
        await driver.execAsync('BEGIN IMMEDIATE');

        try {
          await task(transactionPort);
          await driver.execAsync('COMMIT');
        } catch (error) {
          try {
            await driver.execAsync('ROLLBACK');
          } catch (rollbackError) {
            // Nicht werfen: Der urspruengliche Fehler ist der interessante,
            // ein Rollback-Fehler wuerde ihn nur verdecken. Protokolliert wird
            // er trotzdem — er bedeutet, dass die Transaktion offen geblieben
            // sein koennte.
            console.warn('[db] ROLLBACK fehlgeschlagen:', rollbackError);
          }
          throw error;
        }
      }),
  };
}
