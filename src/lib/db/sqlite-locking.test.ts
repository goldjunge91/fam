import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Warum `serialize.ts` so aussieht, wie es aussieht — als ausfuehrbarer Beleg.
 *
 * Diese Suite prueft keine Projektlogik, sondern das Verhalten von SQLite
 * selbst. Sie steht hier, weil die urspruengliche Diagnose ("ein `PRAGMA
 * busy_timeout` genuegt") plausibel klang und trotzdem falsch war. Ohne einen
 * Test, der den Unterschied zeigt, wandert dieselbe Annahme beim naechsten
 * Sperrproblem zurueck in den Code.
 *
 * Nachgestellt wird exakt das Muster aus `applyRemoteRow`: innerhalb einer
 * Transaktion erst lesen, dann schreiben — waehrend eine zweite Connection
 * dazwischenschreibt. Zwei Connections gibt es in der App, weil
 * `expo-sqlite.withExclusiveTransactionAsync` fuer jede Transaktion eine neue
 * oeffnet.
 */
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

  /** Oeffnet eine Connection und merkt sie fuer den Teardown vor. */
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
    // Grosszuegiges busy_timeout auf beiden Seiten. Wenn Warten helfen wuerde,
    // duerfte hier nichts scheitern.
    const connA = open(5000);
    const connB = open(5000);

    // A liest innerhalb einer deferred Transaktion — ab hier haelt A einen
    // Lese-Snapshot, aber noch keine Schreibsperre.
    connA.exec('BEGIN');
    connA.prepare('select count(*) as c from t').get();

    // B schreibt dazwischen und committet (Autocommit).
    connB.prepare('insert into t (v) values (?)').run('von B');

    // A will jetzt schreiben: Der Snapshot ist veraltet, das Hochstufen der
    // Transaktion ist unmoeglich. SQLite meldet SQLITE_BUSY_SNAPSHOT und ruft
    // den Busy-Handler bewusst NICHT auf — Warten koennte den Konflikt nicht
    // aufloesen. Genau deshalb reicht `busy_timeout` allein nicht.
    expect(() => connA.prepare('insert into t (v) values (?)').run('von A')).toThrow(
      /database is locked/i,
    );

    connA.exec('ROLLBACK');
  });

  it('BEGIN IMMEDIATE: die Transaktion scheitert allenfalls beim Start, nie mittendrin', () => {
    const connA = open(0);
    const connB = open(0);

    // A nimmt die Schreibsperre sofort.
    connA.exec('BEGIN IMMEDIATE');
    connA.prepare('select count(*) as c from t').get();

    // Jetzt kommt B nicht mehr dazwischen — der Konflikt wird an den
    // Zweitschreiber ausgelagert, statt A mitten im Schreiben zu treffen.
    expect(() => connB.prepare('insert into t (v) values (?)').run('von B')).toThrow(
      /database is locked/i,
    );

    // A laeuft ungestoert bis zum COMMIT durch. Das ist die Zusicherung, auf
    // die sich `serialize.ts` stuetzt.
    connA.prepare('insert into t (v) values (?)').run('von A');
    connA.exec('COMMIT');

    const rows = connA.prepare('select v from t').all() as { v: string }[];
    expect(rows.map((r) => r.v)).toEqual(['von A']);
  });

  it('eine einzige Connection kennt das Problem gar nicht', () => {
    // Der Zustand nach dem Fix: alle Zugriffe der App laufen serialisiert ueber
    // dieselbe Connection. Eine Connection kann ihren eigenen Snapshot nicht
    // entwerten.
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
