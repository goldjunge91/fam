import { DatabaseSync } from 'node:sqlite';

import type { SqlDatabase, SqlParam, SqlRunResult } from '@/lib/db/types';

/**
 * Erfuellt den `SqlDatabase`-Port mit `node:sqlite` — fuer Tests.
 *
 * **Das ist kein Mock.** `node:sqlite` ist eine echte, eingebettete
 * SQLite-Engine; die Statements laufen tatsaechlich, Constraints greifen
 * tatsaechlich, ein Rollback dreht tatsaechlich zurueck. Dasselbe Verhaeltnis
 * wie die echte In-Memory-Map, mit der `chunked-storage.test.ts` den
 * `KeyValueStore` erfuellt. Ein Testdouble waere per CLAUDE.md ausgeschlossen —
 * das hier ist der Ersatz des *Treibers*, nicht der Logik.
 *
 * Noetig, weil `expo-sqlite` ein natives Modul ist und weder unter `jest-expo`
 * noch im Node-Setup der Integrationstests laedt. Ohne diesen Adapter waere
 * das lokale Schema nur auf einem Geraet pruefbar.
 *
 * `node:sqlite` ist ab Node 22.5 vorhanden (hier 22.18) und meldet beim Laden
 * eine ExperimentalWarning. Fuer eine CI (#33) heisst das: Node >= 22.5.
 */

/** `run()` liefert je nach Wert number oder bigint — der Port will number. */
function toNumber(value: number | bigint): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/** Der Port erlaubt `readonly SqlParam[]`, node:sqlite will variadische Werte. */
function bind(params: readonly SqlParam[] | undefined): SqlParam[] {
  return params === undefined ? [] : [...params];
}

function wrap(db: DatabaseSync, insideTransaction: boolean): SqlDatabase {
  const self: SqlDatabase = {
    async execAsync(source: string): Promise<void> {
      db.exec(source);
    },

    async runAsync(source: string, params?: readonly SqlParam[]): Promise<SqlRunResult> {
      const result = db.prepare(source).run(...bind(params));
      return {
        lastInsertRowId: toNumber(result.lastInsertRowid),
        changes: toNumber(result.changes),
      };
    },

    async getAllAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T[]> {
      return db.prepare(source).all(...bind(params)) as T[];
    },

    async getFirstAsync<T>(source: string, params?: readonly SqlParam[]): Promise<T | null> {
      const row = db.prepare(source).get(...bind(params));
      return (row as T | undefined) ?? null;
    },

    async withExclusiveTransactionAsync(task: (txn: SqlDatabase) => Promise<void>): Promise<void> {
      // SQLite kennt keine echten verschachtelten Transaktionen. Ein
      // verschachtelter Aufruf wuerde mit "cannot start a transaction within a
      // transaction" scheitern — hier lieber sofort und mit einer Meldung, die
      // die Ursache nennt.
      if (insideTransaction) {
        throw new Error('withExclusiveTransactionAsync ist nicht verschachtelbar.');
      }

      // BEGIN IMMEDIATE statt BEGIN: nimmt die Schreibsperre sofort, statt bis
      // zum ersten Schreibzugriff zu warten. Genau das macht die Transaktion
      // exklusiv — und entspricht dem Verhalten, das der Port zusichert.
      db.exec('BEGIN IMMEDIATE');
      try {
        await task(wrap(db, true));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return self;
}

export type TestDatabase = SqlDatabase & { close(): void };

/**
 * Legt eine echte SQLite-Datenbank an — im Speicher, wenn kein Pfad angegeben
 * ist.
 *
 * Ein Dateipfad ist noetig, um "der zweite App-Start migriert nicht erneut" zu
 * pruefen: Eine In-Memory-Datenbank ist nach dem Schliessen weg und faengt bei
 * `user_version = 0` wieder an.
 */
export function createTestDatabase(path = ':memory:'): TestDatabase {
  const db = new DatabaseSync(path);
  return { ...wrap(db, false), close: () => db.close() };
}

/**
 * Zaehlt ausgefuehrte Statements, indem sie an eine echte Datenbank
 * weitergereicht werden.
 *
 * Ein Dekorator ueber einem echten Treiber, kein Stub: Jedes Statement wird
 * tatsaechlich ausgefuehrt, nur zusaetzlich mitgezaehlt. Damit laesst sich
 * "beim zweiten Start laeuft keine Migration" belegen, statt es aus dem
 * Ergebnis zu erschliessen.
 */
export function countingDatabase(inner: SqlDatabase): SqlDatabase & { executed: string[] } {
  const executed: string[] = [];

  const counted: SqlDatabase = {
    execAsync: (source) => {
      executed.push(source);
      return inner.execAsync(source);
    },
    runAsync: (source, params) => {
      executed.push(source);
      return inner.runAsync(source, params);
    },
    getAllAsync: (source, params) => inner.getAllAsync(source, params),
    getFirstAsync: (source, params) => inner.getFirstAsync(source, params),
    withExclusiveTransactionAsync: (task) =>
      inner.withExclusiveTransactionAsync(async (txn) => {
        await task({
          ...txn,
          execAsync: (source) => {
            executed.push(source);
            return txn.execAsync(source);
          },
          runAsync: (source, params) => {
            executed.push(source);
            return txn.runAsync(source, params);
          },
        });
      }),
  };

  return { ...counted, executed };
}
