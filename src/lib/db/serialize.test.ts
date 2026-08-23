import { DatabaseSync } from 'node:sqlite';

import { type SqlStatementDriver, serializeDatabase } from '@/lib/db/serialize';
import type { SqlParam } from '@/lib/db/types';

/** Protokolliert echte SQLite-Aufrufe und erlaubt Verschachtelung an Mikrotask-Grenzen. */
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

  it('verschachtelt zwei gleichzeitige Transaktionen nicht', async () => {
    const db = serializeDatabase(harness.driver);

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
      // Der Zugriff ueber das aeussere Handle darf erst nach COMMIT laufen.
      readDuringTransaction = db.getFirstAsync<{ c: number }>('select count(*) as c from t');
    });

    expect(await readDuringTransaction).toEqual({ c: 1 });

    expect(harness.log.indexOf('select count(*) as c from t')).toBeGreaterThan(
      harness.log.indexOf('COMMIT'),
    );
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

    // Erzwingt einen BEGIN-Fehler vor dem Eintritt in die Port-Transaktion.
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

    expect(harness.log).toContain('ROLLBACK');
  });

  it('bleibt nach einem Fehler benutzbar', async () => {
    const db = serializeDatabase(harness.driver);

    await expect(
      db.withExclusiveTransactionAsync(async () => {
        throw new Error('erster Lauf scheitert');
      }),
    ).rejects.toThrow('erster Lauf scheitert');

    await db.runAsync('insert into t (v) values (?)', ['danach']);
    const row = await db.getFirstAsync<{ v: string }>('select v from t');
    expect(row).toEqual({ v: 'danach' });
  });
});
