import { DatabaseSync } from 'node:sqlite';

import {
  isMutatingSql,
  type SharedStoreWriterLease,
  type SharedStoreWriterOwner,
  type SqlStatementDriver,
  serializeDatabase,
} from '@/lib/db/serialize';
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

function createWriterOwner(events: string[] = []) {
  const leases: Array<{
    name: string;
    controller: AbortController;
    lease: SharedStoreWriterLease;
    end: jest.Mock<void, []>;
  }> = [];
  const owner: SharedStoreWriterOwner = {
    beginWriterLease: jest.fn((name: string) => {
      events.push(`acquire:${name}`);
      const controller = new AbortController();
      let ended = false;
      const end = jest.fn(() => {
        ended = true;
        events.push('end');
      });
      const lease: SharedStoreWriterLease = {
        signal: controller.signal,
        get ended() {
          return ended;
        },
        end,
      };
      leases.push({ name, controller, lease, end });
      return lease;
    }),
  };
  return { owner, leases };
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

  it('erwirbt die Writer-Zusicherung vor BEGIN und beendet sie nach COMMIT genau einmal', async () => {
    const events: string[] = [];
    const writer = createWriterOwner(events);
    const db = serializeDatabase(harness.driver, writer.owner);

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('insert into t (v) values (?)', ['owned']);
      events.push('task');
    });

    expect(events).toEqual(['acquire:sqlite.transaction', 'task', 'end']);
    expect(harness.log).toEqual(['BEGIN IMMEDIATE', 'insert into t (v) values (?)', 'COMMIT']);
    expect(writer.leases).toHaveLength(1);
    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
  });

  it('hält eine Writer-Lease bis zum Cleanup nach Expiration', async () => {
    const writer = createWriterOwner();
    const db = serializeDatabase(harness.driver, writer.owner);
    const cleanupEvents: string[] = [];

    await expect(
      db.withWriterLeaseAsync('off.patch', async ({ db: ownedDb, cleanupExecAsync }) => {
        await ownedDb.execAsync("ATTACH DATABASE ':memory:' AS off_patch");
        writer.leases[0]?.controller.abort('expiration');
        cleanupEvents.push('abort');
        await cleanupExecAsync('DETACH DATABASE off_patch');
        cleanupEvents.push('detach');
      }),
    ).rejects.toThrow(/abgelaufen/);

    expect(cleanupEvents).toEqual(['abort', 'detach']);
    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
    expect(harness.log).toEqual([
      "ATTACH DATABASE ':memory:' AS off_patch",
      'DETACH DATABASE off_patch',
    ]);
  });

  it('beendet die Writer-Zusicherung erst nach abgeschlossenem ROLLBACK', async () => {
    const writer = createWriterOwner();
    const db = serializeDatabase(harness.driver, writer.owner);
    const events: string[] = [];
    const originalExecAsync = harness.driver.execAsync;
    harness.driver.execAsync = async (source) => {
      if (source === 'ROLLBACK') events.push('rollback');
      await originalExecAsync(source);
    };

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['rollback']);
        throw new Error('task failed');
      }),
    ).rejects.toThrow('task failed');

    const lease = writer.leases[0];
    expect(lease?.end).toHaveBeenCalledTimes(1);
    expect(harness.log).toEqual(['BEGIN IMMEDIATE', 'insert into t (v) values (?)', 'ROLLBACK']);
    expect(await db.getAllAsync('select v from t')).toHaveLength(0);
  });

  it('behält die Writer-Zusicherung nach fehlgeschlagenem ROLLBACK bis zum bestätigten Close', async () => {
    const events: string[] = [];
    const writer = createWriterOwner(events);
    const originalExecAsync = harness.driver.execAsync;
    harness.driver.execAsync = async (source) => {
      if (source === 'ROLLBACK') {
        events.push('rollback-failed');
        throw new Error('rollback failed');
      }
      await originalExecAsync(source);
    };
    const recoverAfterCleanupFailure = jest.fn(async () => {
      events.push('recovery-failed');
      throw new Error('raw close failed');
    });
    const db = serializeDatabase(harness.driver, {
      writerOwner: writer.owner,
      recoverAfterCleanupFailure,
    });

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['unresolved']);
        throw new Error('task failed');
      }),
    ).rejects.toThrow('task failed');

    expect(recoverAfterCleanupFailure).toHaveBeenCalledTimes(1);
    expect(writer.leases[0]?.end).not.toHaveBeenCalled();
    await expect(db.runAsync('insert into t (v) values (?)', ['too late'])).rejects.toThrow(
      /geschlossen/,
    );

    await db.closeForLifecycle(async () => {
      events.push('raw-close-confirmed');
      await originalExecAsync('ROLLBACK');
    });

    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'acquire:sqlite.transaction',
      'rollback-failed',
      'recovery-failed',
      'raw-close-confirmed',
      'end',
    ]);
    expect(await harness.driver.getAllAsync('select v from t')).toHaveLength(0);
  });

  it('behält die Writer-Zusicherung während einer DETACH-Recovery', async () => {
    const events: string[] = [];
    const writer = createWriterOwner(events);
    const originalExecAsync = harness.driver.execAsync;
    let detachAttempts = 0;
    harness.driver.execAsync = async (source) => {
      if (source === 'DETACH DATABASE off_patch' && detachAttempts++ === 0) {
        events.push('detach-failed');
        throw new Error('detach failed');
      }
      await originalExecAsync(source);
    };

    let announceRecovery: (() => void) | undefined;
    const recoveryStarted = new Promise<void>((resolve) => {
      announceRecovery = resolve;
    });
    let releaseRecovery: (() => void) | undefined;
    const recoveryReleased = new Promise<void>((resolve) => {
      releaseRecovery = resolve;
    });
    const db = serializeDatabase(harness.driver, {
      writerOwner: writer.owner,
      recoverAfterCleanupFailure: async () => {
        events.push('recovery-started');
        announceRecovery?.();
        await recoveryReleased;
        await originalExecAsync('DETACH DATABASE off_patch');
        events.push('recovery-finished');
      },
    });

    const operation = db.withWriterLeaseAsync(
      'off.patch',
      async ({ db: ownedDb, cleanupExecAsync }) => {
        await ownedDb.execAsync("ATTACH DATABASE ':memory:' AS off_patch");
        await cleanupExecAsync('DETACH DATABASE off_patch');
      },
    );

    await recoveryStarted;
    expect(writer.leases[0]?.end).not.toHaveBeenCalled();
    releaseRecovery?.();
    await expect(operation).rejects.toThrow('detach failed');

    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      'acquire:off.patch',
      'detach-failed',
      'recovery-started',
      'recovery-finished',
      'end',
    ]);
  });

  it('rollt nach Ablauf zurück und startet keinen COMMIT-Retry', async () => {
    const writer = createWriterOwner();
    const db = serializeDatabase(harness.driver, writer.owner);

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['expired']);
        writer.leases[0]?.controller.abort('expiration');
      }),
    ).rejects.toThrow(/abgelaufen/);

    expect(harness.log).toEqual(['BEGIN IMMEDIATE', 'insert into t (v) values (?)', 'ROLLBACK']);
    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
    expect(await db.getAllAsync('select v from t')).toHaveLength(0);
  });

  it('bricht einen BEGIN-Retry nach Ablauf ohne Rollback oder zweiten BEGIN ab', async () => {
    const writer = createWriterOwner();
    const originalExecAsync = harness.driver.execAsync;
    let beginAttempts = 0;
    harness.driver.execAsync = async (source) => {
      if (source === 'BEGIN IMMEDIATE' && beginAttempts++ === 0) {
        writer.leases[0]?.controller.abort('expiration');
        throw new Error('database is locked');
      }
      await originalExecAsync(source);
    };
    const db = serializeDatabase(harness.driver, writer.owner);

    await expect(db.withExclusiveTransactionAsync(async () => undefined)).rejects.toThrow(
      /abgelaufen/,
    );

    expect(beginAttempts).toBe(1);
    expect(harness.log).toEqual([]);
    expect(writer.leases[0]?.end).toHaveBeenCalledTimes(1);
  });

  it('schützt nur klassifizierte Mutationen, nicht Reads und read-only PRAGMAs', async () => {
    const writer = createWriterOwner();
    const db = serializeDatabase(harness.driver, writer.owner);

    expect(isMutatingSql('select * from t')).toBe(false);
    expect(isMutatingSql('PRAGMA journal_mode')).toBe(false);
    expect(isMutatingSql('PRAGMA journal_mode = WAL')).toBe(true);
    expect(isMutatingSql("ATTACH DATABASE 'file.db' AS off_dump")).toBe(true);

    await db.getFirstAsync('select count(*) as count from t');
    await db.execAsync('PRAGMA journal_mode');
    await db.runAsync('insert into t (v) values (?)', ['classified']);
    await db.execAsync('PRAGMA foreign_keys = ON');

    expect(writer.owner.beginWriterLease).toHaveBeenCalledTimes(2);
    expect(writer.owner.beginWriterLease).toHaveBeenNthCalledWith(
      1,
      'sqlite.runAsync',
      expect.any(Object),
    );
    expect(writer.owner.beginWriterLease).toHaveBeenNthCalledWith(
      2,
      'sqlite.execAsync',
      expect.any(Object),
    );
  });

  it('hält lokale Entität und Outbox-Eintrag atomar', async () => {
    const writer = createWriterOwner();
    const db = serializeDatabase(harness.driver, writer.owner);
    await harness.driver.execAsync('create table outbox (entity_id text not null)');

    await expect(
      db.withExclusiveTransactionAsync(async (txn) => {
        await txn.runAsync('insert into t (v) values (?)', ['entity']);
        await txn.runAsync('insert into outbox (entity_id) values (?)', ['entity']);
        throw new Error('outbox cancellation');
      }),
    ).rejects.toThrow('outbox cancellation');

    expect(await db.getAllAsync('select v from t')).toHaveLength(0);
    expect(await db.getAllAsync('select entity_id from outbox')).toHaveLength(0);
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
    harness.driver.execAsync = async (source) => {
      if (source === 'BEGIN IMMEDIATE' && beginAttempts++ === 0) {
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
    expect(await db.getAllAsync<{ v: string }>('select v from t')).toEqual([{ v: 'after retry' }]);
  });

  it('rollt bei SQLITE_BUSY beim COMMIT sofort zurueck und gibt die Sperre frei', async () => {
    const originalExecAsync = harness.driver.execAsync;
    let commitAttempts = 0;
    harness.driver.execAsync = async (source) => {
      if (source === 'COMMIT') {
        commitAttempts += 1;
        harness.log.push(source);
        throw new Error('database is locked');
      }
      await originalExecAsync(source);
    };
    const db = serializeDatabase(harness.driver);
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');

    try {
      await expect(
        db.withExclusiveTransactionAsync(async (txn) => {
          await txn.runAsync('insert into t (v) values (?)', ['verworfen']);
        }),
      ).rejects.toThrow('database is locked');

      expect(commitAttempts).toBe(1);
      expect(setTimeoutSpy).not.toHaveBeenCalled();
      expect(harness.log).toEqual([
        'BEGIN IMMEDIATE',
        'insert into t (v) values (?)',
        'COMMIT',
        'ROLLBACK',
      ]);
      expect(await db.getAllAsync('select v from t')).toHaveLength(0);

      await db.runAsync('insert into t (v) values (?)', ['danach']);
      expect(await db.getAllAsync<{ v: string }>('select v from t')).toEqual([{ v: 'danach' }]);
    } finally {
      setTimeoutSpy.mockRestore();
    }
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

  it('stops a reserved lifecycle operation from starting a statement after close admission', async () => {
    const db = serializeDatabase(harness.driver);
    let releaseOperation: (() => void) | undefined;
    const operationReleased = new Promise<void>((resolve) => {
      releaseOperation = resolve;
    });

    const operation = db.withLifecycleOperationAsync(async (operationDb) => {
      await operationDb.runAsync('insert into t (v) values (?)', ['before close']);
      await operationReleased;
      await operationDb.runAsync('insert into t (v) values (?)', ['after close']);
    });
    await Promise.resolve();
    await Promise.resolve();
    const closing = db.closeForLifecycle(jest.fn().mockResolvedValue(undefined));

    releaseOperation?.();
    await expect(operation).rejects.toThrow(/geschlossen/);
    await expect(closing).resolves.toBeUndefined();
    expect(harness.log).toEqual(['insert into t (v) values (?)']);
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
