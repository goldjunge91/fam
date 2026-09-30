import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Warum die Siri-Extension ihre PRAGMAs so und nicht anders ausfuehrt.
 *
 * Der native Schreibpfad in `targets/siri/_shared/siri-shopping-list-intents.swift`
 * umschliesst exsqlite3 direkt: `prepare`, einzelnes `step`, Ergebnis gegen
 * SQLITE_DONE (101) pruefen. Das war plausibel und fuehrte dazu, dass
 * `PRAGMA busy_timeout = 5000` — die ERSTE Anweisung des Schreibpfads — einen
 * Fehler warf und der gesamte Pfad toter Code blieb.
 *
 * Diese Suite prueft keine Projektlogik, sondern das Verhalten von SQLite
 * selbst. Sie steht hier, weil `bun run typecheck` (tsc) Swift nicht sieht und
 * die bestehende Siri-Convention-Suite den Swift-Quelltext nur auf Klassennamen
 * prueft. Ohne diesen Test wandert dieselbe Annahme beim naechsten
 * Sperrproblem zurueck in den Code.
 *
 * Die Swift-Seite kann hier nicht ausgefuehrt werden; `node:sqlite` bildet
 * exakt die Schritt-Semantik ab, die der Swift-Wrapper nachbildet.
 */
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SHARED_INTENT_PATH = path.join(
  REPO_ROOT,
  'targets',
  'siri',
  '_shared',
  'siri-shopping-list-intents.swift',
);

const SQLITE_ROW = 100;
const SQLITE_DONE = 101;

/** Bildet `SiriSQLiteStatement` nach: prepare, ein `step`, Ergebnis einordnen. */
function firstStepResult(db: DatabaseSync, sql: string): number {
  return db.prepare(sql).get() !== undefined ? SQLITE_ROW : SQLITE_DONE;
}

/** Die Zusicherung, auf die der urspruengliche Wrapper sich verliess. */
function singleStepIsDone(db: DatabaseSync, sql: string): boolean {
  return firstStepResult(db, sql) === SQLITE_DONE;
}

describe('Siri native Schreibpfad: PRAGMA-Semantik', () => {
  describe('execute() darf sich nicht auf SQLITE_DONE verlassen', () => {
    it('PRAGMA busy_timeout liefert eine Zeile und bricht eine DONE-Pruefung', () => {
      const db = new DatabaseSync(':memory:');

      // Genau die Zusicherung, auf die der urspruengliche Wrapper sich verliess:
      // die erste Anweisung des Schreibpfads muss mit DONE antworten.
      expect(singleStepIsDone(db, 'PRAGMA busy_timeout = 5000')).toBe(false);
    });

    it('PRAGMA foreign_keys liefert keine Zeile und besteht die DONE-Pruefung', () => {
      const db = new DatabaseSync(':memory:');

      // Nicht PRAGMA-spezifisch: die meisten PRAGMAs antworten mit DONE. Wer
      // nur busy_timeout kennt, schliesst faelschlich auf die Regel.
      expect(singleStepIsDone(db, 'PRAGMA foreign_keys = ON')).toBe(true);
    });

    it('Transaktionssteuerung antwortet durchgaengig mit DONE', () => {
      const db = new DatabaseSync(':memory:');

      expect(singleStepIsDone(db, 'BEGIN IMMEDIATE')).toBe(true);
      expect(singleStepIsDone(db, 'COMMIT')).toBe(true);
    });
  });

  describe('Transaktionssteuerung und PRAGMA-Reihenfolge', () => {
    it('PRAGMA foreign_keys ist innerhalb einer Transaktion wirkungslos', () => {
      const db = new DatabaseSync(':memory:');
      // `node:sqlite` startet mit foreign_keys=1, das echte `exsqlite3_open_v2`
      // der Extension dagegen aus. Erst der Ausgangszustand ist die Beobachtung.
      db.exec('PRAGMA foreign_keys = OFF');
      expect(db.prepare('PRAGMA foreign_keys').get()).toEqual({ foreign_keys: 0 });

      db.exec('BEGIN');
      db.exec('PRAGMA foreign_keys = ON');
      // Ohne Fehler, ohne Wirkung — die Transaktion haelt die FK-Option fest.
      const insideTransaction = db.prepare('PRAGMA foreign_keys').get();
      db.exec('COMMIT');

      expect(insideTransaction).toEqual({ foreign_keys: 0 });
    });
  });

  describe('Konvention: execute() muss zeilenliefernde PRAGMAs vertragen', () => {
    it('verlangt nicht mehr, dass die ERSTE Anweisung mit DONE endet', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // Der urspruengliche `guard step() == 101` warf bei `PRAGMA busy_timeout`
      // (liefert eine Zeile) und hat damit den gesamten Schreibpfad blockiert.
      // Geprueft wird der Rumpf von `execute`, nicht die ganze Datei: sonst
      // koennte derselbe Ausdruck in einem anderen Kontext das Ergebnis tragen.
      const body = source.slice(
        source.indexOf('private func execute(_ sql: String'),
        source.indexOf('private static func decodeRecipeNames'),
      );

      expect(body).not.toMatch(/step\(\) == 101/u);
      expect(body).toMatch(/step\(\) == 100/u);
    });

    it('haelt busy_timeout und foreign_keys oberhalb der Transaktionsoeffnung', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');
      // Nur die Aufrufstellen zaehlen, nicht Kommentare: `indexOf` faende sonst
      // die Erklaerung im Docstring und pruefte die falsche Zeile.
      const callSites = [...source.matchAll(/execute\("PRAGMA (\w+)/gu)].map((m) => m[1]);

      expect(callSites).toEqual(expect.arrayContaining(['busy_timeout', 'foreign_keys']));

      const begin = source.indexOf('execute("BEGIN IMMEDIATE"');
      // Innerhalb einer Transaktion waere foreign_keys ein stiller No-Op.
      expect(source.indexOf('execute("PRAGMA foreign_keys')).toBeLessThan(begin);
    });
  });

  describe('Konvention: updated_at folgt dem Spaltentyp', () => {
    it('schreibt Epoch-Millisekunden in die lokale integer-Spalte', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // Drizzle: `updatedAt: integer('updated_at').notNull()`. Ein ISO-String
      // landet sonst unauffaellig als TEXT darin und vergiftet ORDER BY.
      // Beide Schreibstellen (insert und update) sind einzeln abgesichert.
      expect(source).toMatch(/try statement\.bind\(\d+, integer: updatedAtMs\)/gu);
      expect(source).not.toMatch(/try statement\.bind\(\d+, text: timestamp\)/u);
    });

    it('haelt created_at als ISO-Text, weil die Spalte text ist', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      expect(source).toMatch(/try statement\.bind\(\d+, text: createdAt\)/u);
    });

    it('traegt im Outbox-Payload weiterhin ISO fuer Supabase timestamptz', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // Der Payload geht unveraendert an den Server und erwartet ISO — nur die
      // lokale Spalte ist Integer. Diese Trennung ist Absicht, kein Zufall.
      expect(source).toMatch(/"updated_at": timestamp/u);
      expect(source).toMatch(/"created_at": timestamp/u);
    });
  });

  describe('Konvention: Schreibvorgaenge muessen eine Zeile wirklich treffen', () => {
    it('ein UPDATE auf null Zeilen ist von step() nicht unterscheidbar', () => {
      const db = new DatabaseSync(':memory:');
      db.exec('create table t(id text primary key, q integer)');
      db.prepare('insert into t values (?, ?)').run('a', 1);

      const hitsOne = db.prepare('update t set q = ? where id = ?').run(2, 'a');
      const hitsNone = db.prepare('update t set q = ? where id = ?').run(2, 'fehlt');

      // Beide melden dieselbe Fertigmeldung. Nur `changes` trennt sie.
      expect(hitsOne.changes).toBe(1);
      expect(hitsNone.changes).toBe(0);
    });

    it('prueft die Aeffektivitaet ueber exsqlite3_changes statt nur step', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // Ohne `changes` kann ein stiller Null-Treffer nicht vom Erfolg
      // unterschieden werden — `guard step() == 101` feuert nie. Geprueft wird
      // je Rumpf: ein blosses Vorkommen von `exsqlite3_changes` im File wuerde
      // auch bestehen, wenn update() wieder auf `step()` zurueckfaellt.
      const updateBody = source.slice(
        source.indexOf('private func update('),
        source.indexOf('/// `created_at` ist laut Schema'),
      );
      const insertBody = source.slice(
        source.indexOf('private func insert('),
        source.indexOf('/// `step()` meldet auch dann DONE'),
      );

      expect(updateBody).toMatch(
        /requireExactlyOneRow\(statement, on: database, operation: "update"\)/u,
      );
      expect(insertBody).toMatch(
        /requireExactlyOneRow\(statement, on: database, operation: "insert"\)/u,
      );

      // Und die Helferfunktion muss beide Schreibvorgaenge absichern.
      const helper = source.slice(source.indexOf('private func requireExactlyOneRow'));
      expect(helper).toMatch(/exsqlite3_changes\(database\) == 1/u);
    });
  });

  describe('Konvention: ROLLBACK-Fehler bleiben sichtbar', () => {
    it('schluckt keinen Rollback-Fehler und prueft das Schliessen', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // `try?` auf ROLLBACK verbarg genau den Fall, in dem die Transaktion
      // offen bleibt und nur `sqlite3_close` noch zurueckrollt.
      expect(source).not.toMatch(/try\? execute\("ROLLBACK"/u);
      expect(source).toMatch(/rollback failed/u);
      // `defer { exsqlite3_close(...) }` muss den Rueckgabewert auswerten.
      expect(source).not.toMatch(/defer \{ exsqlite3_close\(database\) \}/u);
    });

    it('sichert jeden Schreibvorgang mit requireExactlyOneRow ab', () => {
      const source = fs.readFileSync(SHARED_INTENT_PATH, 'utf8');

      // Ein `guard step() == 101` bei INSERT kann nie feuern: SQLite liefert
      // bei einer Constraint-Verletzung einen Fehlercode, den `step()` selbst
      // wirft. Solche Guards sind toter Code und wurden entfernt.
      // Nur echte Aufrufe zaehlen: Definition und Erklaerung im Kommentar nicht.
      const callSites = [...source.matchAll(/^ {8}try requireExactlyOneRow\(/gmu)];
      expect(callSites).toHaveLength(4);
      expect(source).toMatch(
        /private func requireExactlyOneRow\(\n {8}_ statement: SiriSQLiteStatement/u,
      );

      expect(source).not.toMatch(/guard try (outboxStatement|historyStatement)\.step\(\) == 101/u);
    });
  });
});
