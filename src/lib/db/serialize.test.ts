import { DatabaseSync } from 'node:sqlite';

import { type SqlStatementDriver, serializeDatabase } from '@/lib/db/serialize';
import type { SqlParam } from '@/lib/db/types';

/**
 * `serializeDatabase` gegen eine echte SQLite-Engine (#-Fix "database is locked").
 *
 * Kein Testdouble: `node:sqlite` fuehrt die Statements tatsaechlich aus, ein
 * Rollback dreht tatsaechlich zurueck. Der Treiber hier ist nur die rohe,
 * mitschreibende Statement-Schicht darunter — dieselbe Rolle, die in der App
 * `expo-sqlite` spielt.
 *
 * Die Treibermethoden sind echt asynchron (`await Promise.resolve()`). Ohne
 * diese Mikrotask-Grenze koennte sich in diesen Tests gar nichts verschachteln,
 * und die Serialisierung waere nicht pruefbar — sie waere nur zufaellig richtig.
 */
function createRecordingDriver() {
  const db = new DatabaseSync(':memory:');
  const log: string[] = [];

  const driver: SqlStatementDriver = {
    async execAsync(source: string) {
      await Promise.resolve();
      log.push(source);
      db.exec(source);
    },
    async runAsync(source: string, params?: readonly SqlParam[]) {
      await Promise.resolve();
      log.push(source);
      const result = db.prepare(source).run(...(params ?? []));
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    async getAllAsync<T>(source: string, params?: readonly SqlParam[]) {
      await Promise.resolve();
      log.push(source);
      return db.prepare(source).all(...(params ?? [])) as T[];
    },
    async getFirstAsync<T>(source: string, params?: readonly SqlParam[]) {
      await Promise.resolve();
      log.push(source);
      return (db.prepare(source).get(...(params ?? [])) as T | undefined) ?? null;
    },
    async getAllRawAsync(source: string, params?: readonly SqlParam[]) {
      await Promise.resolve();
      log.push(source);
      const statement = db.prepare(source);
      statement.setReturnArrays(true);
      const rows: unknown[] = statement.all(...(params ?? []));
      return rows.map((row) => {
        if (!Array.isArray(row)) throw new Error('node:sqlite lieferte keine Raw-Zeile.');
        return row.map((value) => {
          if (value === null || typeof value === 'string' || typeof value === 'number')
            return value;
          throw new Error('node:sqlite lieferte einen nicht unterstützten Wert.');
        });
      });
    },
  };

  return { driver, log, close: () => db.close() };
}

describe('serializeDatabase', () => {
  let harness: ReturnType<typeof createRecordingDriver>;

  beforeEach(async () => {
    harness = createRecordingDriver();
    await harness.driver.execAsync('create table t (id integer primary key, v text)');
    harness.log.length = 0;
  });

  afterEach(() => {
    harness.close();
  });

  it('oeffnet die Transaktion mit BEGIN IMMEDIATE, nicht mit BEGIN', async () => {
    const db = serializeDatabase(harness.driver);

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('insert into t (v) values (?)', ['a']);
    });

    expect(harness.log[0]).toBe('BEGIN IMMEDIATE');
    expect(harness.log).toContain('COMMIT');
    expect(harness.log).not.toContain('ROLLBACK');
  });

  it('retryt einen kurzzeitigen Lock beim Transaktionsstart', async () => {
    const originalExecAsync = harness.driver.execAsync;
    let beginAttempts = 0;
    let commitAttempts = 0;
    harness.driver.execAsync = async (source) => {
      if (source === 'BEGIN IMMEDIATE' && beginAttempts++ === 0) {
        throw new Error('database is locked');
      }
      if (source === 'COMMIT' && commitAttempts++ === 0) {
        throw new Error('database is locked');
      }
      await originalExecAsync(source);
    };
    const db = serializeDatabase(harness.driver);

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['after retry']);
      }),
    ).resolves.toBeUndefined();

    expect(beginAttempts).toBe(2);
    expect(commitAttempts).toBe(2);
    expect(await db.getAllAsync<{ v: string }>('select v from t')).toEqual([{ v: 'after retry' }]);
  });

  it('verschachtelt zwei gleichzeitige Transaktionen nicht', async () => {
    const db = serializeDatabase(harness.driver);

    // Bewusst NICHT einzeln awaiten: beide starten, bevor die erste fertig ist.
    await Promise.all([
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['a1']);
        await txn.runAsync('insert into t (v) values (?)', ['a2']);
      }),
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['b1']);
        await txn.runAsync('insert into t (v) values (?)', ['b2']);
      }),
    ]);

    // Jede Transaktion muss als geschlossener Block BEGIN…COMMIT erscheinen.
    const blocks = harness.log.filter((s) => s === 'BEGIN IMMEDIATE' || s === 'COMMIT');
    expect(blocks).toEqual(['BEGIN IMMEDIATE', 'COMMIT', 'BEGIN IMMEDIATE', 'COMMIT']);

    const rows = await db.getAllAsync<{ v: string }>('select v from t order by id');
    expect(rows.map((r) => r.v)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });

  it('laesst eine gleichzeitige Leseabfrage warten statt sie in die Transaktion zu ziehen', async () => {
    const db = serializeDatabase(harness.driver);
    let readDuringTransaction: Promise<{ c: number } | null> | null = null;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('insert into t (v) values (?)', ['x']);
      // Zugriff auf das AEUSSERE Handle waehrend der Transaktion. Hier bewusst
      // nicht awaitet — er darf erst nach dem COMMIT drankommen.
      readDuringTransaction = db.getFirstAsync<{ c: number }>('select count(*) as c from t');
    });

    expect(await readDuringTransaction).toEqual({ c: 1 });

    // Die Leseabfrage lief nach COMMIT, nicht dazwischen.
    expect(harness.log.indexOf('select count(*) as c from t')).toBeGreaterThan(
      harness.log.indexOf('COMMIT'),
    );
  });

  it('serialisiert auch die Raw-Zeilen des Drizzle-Adapters', async () => {
    const db = serializeDatabase(harness.driver);
    let readDuringTransaction: Promise<SqlParam[][]> | undefined;

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('insert into t (v) values (?)', ['drizzle']);
      readDuringTransaction = db.getAllRawAsync?.('select v from t');
    });

    await expect(readDuringTransaction).resolves.toEqual([['drizzle']]);
    expect(harness.log.indexOf('select v from t')).toBeGreaterThan(harness.log.indexOf('COMMIT'));
  });

  it('rollt bei einem werfenden Task zurueck und reicht den Fehler durch', async () => {
    const db = serializeDatabase(harness.driver);

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['verworfen']);
        throw new Error('Task ist gescheitert');
      }),
    ).rejects.toThrow('Task ist gescheitert');

    expect(harness.log).toContain('ROLLBACK');
    expect(harness.log).not.toContain('COMMIT');

    const rows = await db.getAllAsync('select v from t');
    expect(rows).toHaveLength(0);
  });

  it('verdeckt einen fehlgeschlagenen BEGIN nicht durch einen ROLLBACK-Fehler', async () => {
    const db = serializeDatabase(harness.driver);

    // Am Port vorbei eine Transaktion oeffnen: das BEGIN IMMEDIATE des Ports
    // scheitert dann zwangslaeufig. Ohne die Sonderbehandlung wuerde der
    // anschliessende ROLLBACK mit "no transaction is active" die eigentliche
    // Ursache ueberschreiben — genau der Fehler in `expo-sqlite`.
    await harness.driver.execAsync('BEGIN');
    harness.log.length = 0;

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error('darf nie laufen');
      }),
    ).rejects.toThrow(/within a transaction/i);

    expect(harness.log).not.toContain('ROLLBACK');
    expect(harness.log).not.toContain('COMMIT');

    await harness.driver.execAsync('ROLLBACK');
  });

  it('weist eine verschachtelte Transaktion mit klarer Meldung ab', async () => {
    const db = serializeDatabase(harness.driver);

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.withExclusiveTransactionAsync(async () => {});
      }),
    ).rejects.toThrow(/nicht verschachtelbar/);

    // Der abgebrochene Versuch darf die Transaktion nicht offen lassen.
    expect(harness.log).toContain('ROLLBACK');
  });

  it('bleibt nach einem Fehler benutzbar', async () => {
    const db = serializeDatabase(harness.driver);

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error('erster Lauf scheitert');
      }),
    ).rejects.toThrow('erster Lauf scheitert');

    // Waere die Warteschlange nach einer Rejection vergiftet, bliebe dieser
    // Aufruf fuer immer haengen.
    await db.runAsync('insert into t (v) values (?)', ['danach']);
    const row = await db.getFirstAsync<{ v: string }>('select v from t');
    expect(row).toEqual({ v: 'danach' });
  });

  it('drained reservierte Abfragen und blockiert neue Zugriffe vor dem Close', async () => {
    let releaseQuery: (() => void) | undefined;
    const queryFinished = new Promise<void>((resolve) => {
      releaseQuery = resolve;
    });
    const close = jest.fn().mockResolvedValue(undefined);
    const driver: SqlStatementDriver = {
      execAsync: jest.fn(() => queryFinished),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    };
    const db = serializeDatabase(driver);

    const query = db.execAsync('select slow');
    await Promise.resolve();
    const closing = db.closeForLifecycle(close);

    expect(close).not.toHaveBeenCalled();
    await expect(db.getAllAsync('select too late')).rejects.toThrow(/geschlossen/);

    releaseQuery?.();
    await query;
    await closing;
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('erlaubt nach einem fehlgeschlagenen nativen Close einen erneuten Close-Versuch', async () => {
    const db = serializeDatabase({
      execAsync: jest.fn(),
      runAsync: jest.fn(),
      getAllAsync: jest.fn(),
      getFirstAsync: jest.fn(),
    });
    const close = jest
      .fn()
      .mockRejectedValueOnce(new Error('native close failed'))
      .mockResolvedValueOnce(undefined);

    await expect(db.closeForLifecycle(close)).rejects.toThrow('native close failed');
    await expect(db.closeForLifecycle(close)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledTimes(2);
    await expect(db.execAsync('select too late')).rejects.toThrow(/geschlossen/);
  });
});
