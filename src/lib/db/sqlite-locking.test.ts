import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** Belegt den Unterschied zwischen `busy_timeout` und `BEGIN IMMEDIATE`. */
function connect(path: string, busyTimeoutMs: number): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  return db;
}

describe('SQLite-Sperrverhalten bei zwei Connections', () => {
  let dir: string;
  let path: string;
  const opened: DatabaseSync[] = [];

  function open(busyTimeoutMs: number): DatabaseSync {
    const db = connect(path, busyTimeoutMs);
    opened.push(db);
    return db;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fam-sqlite-'));
    path = join(dir, 'test.db');

    const setup = connect(path, 0);
    setup.exec('create table t (id integer primary key, v text)');
    setup.close();
  });

  afterEach(() => {
    for (const db of opened) db.close();
    opened.length = 0;
    rmSync(dir, { recursive: true, force: true });
  });

  it('deferred BEGIN: der Schreibzugriff scheitert MITTEN in der Transaktion — auch mit busy_timeout', () => {
    const connA = open(5000);
    const connB = open(5000);

    // A haelt einen Lese-Snapshot, aber noch keine Schreibsperre.
    connA.exec('BEGIN');
    connA.prepare('select count(*) as c from t').get();

    connB.prepare('insert into t (v) values (?)').run('von B');

    // Der veraltete Snapshot kann trotz `busy_timeout` nicht hochgestuft werden.
    expect(() => connA.prepare('insert into t (v) values (?)').run('von A')).toThrow(
      /database is locked/i,
    );

    connA.exec('ROLLBACK');
  });

  it('BEGIN IMMEDIATE: die Transaktion scheitert allenfalls beim Start, nie mittendrin', () => {
    const connA = open(0);
    const connB = open(0);

    connA.exec('BEGIN IMMEDIATE');
    connA.prepare('select count(*) as c from t').get();

    // Der Konflikt trifft den Zweitschreiber statt die laufende Transaktion.
    expect(() => connB.prepare('insert into t (v) values (?)').run('von B')).toThrow(
      /database is locked/i,
    );

    connA.prepare('insert into t (v) values (?)').run('von A');
    connA.exec('COMMIT');

    const rows = connA.prepare('select v from t').all() as { v: string }[];
    expect(rows.map((r) => r.v)).toEqual(['von A']);
  });

  it('eine einzige Connection kennt das Problem gar nicht', () => {
    const connA = open(0);

    connA.exec('BEGIN IMMEDIATE');
    connA.prepare('select count(*) as c from t').get();
    connA.prepare('insert into t (v) values (?)').run('erst');
    connA.prepare('select count(*) as c from t').get();
    connA.prepare('insert into t (v) values (?)').run('dann');
    connA.exec('COMMIT');

    const rows = connA.prepare('select v from t').all() as { v: string }[];
    expect(rows.map((r) => r.v)).toEqual(['erst', 'dann']);
  });
});
