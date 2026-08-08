import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import type { SqlDatabase } from '@/lib/db/types';

/**
 * Der einzige Ort im Projekt, der `expo-sqlite` benutzen darf.
 *
 * Alles andere spricht gegen den Port `SqlDatabase` aus `types.ts`. Der Grund
 * ist nicht Geschmack: `expo-sqlite` ist ein natives Modul und laedt weder
 * unter `jest-expo` noch im Node-Setup der Integrationstests. Waere es von
 * `index.ts` aus erreichbar, stuerbe jeder Unit-Test, der den Barrel transitiv
 * importiert — mit einer Meldung, die auf die falsche Datei zeigt. Genau diese
 * Kaskade beschreibt der Kopf von `src/lib/supabase.ts`.
 *
 * **Diese Datei wird deshalb nicht aus `index.ts` re-exportiert.**
 */

const REBUILD_HINT =
  'expo-sqlite ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt ' +
  'werden (scripts/ios-dev.sh oder `bunx expo run:ios`).';

/**
 * Laedt das native Modul erst beim ersten Zugriff.
 *
 * Wie `loadSecureStore()` in `supabase.ts`: Ein fehlendes Modul soll nicht beim
 * Import der Datei die halbe App mitreissen, sondern dann auffallen, wenn es
 * gebraucht wird — mit einer Meldung, die den naechsten Schritt nennt.
 */
function loadSQLite(): typeof import('expo-sqlite') {
  try {
    return require('expo-sqlite') as typeof import('expo-sqlite');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

const DATABASE_NAME = 'fam.db';

/**
 * Uebersetzt eine `SQLiteDatabase` in den Port.
 *
 * Noetig, weil `expo-sqlite` die Parameter als Pflichtargument fuehrt (und
 * zusaetzlich variadisch ueberlaedt), der Port sie aber optional macht. Ohne
 * diese duenne Schicht passt die Signatur nicht — und ein `as`-Cast wuerde die
 * Unstimmigkeit nur verstecken.
 *
 * Nebeneffekt, der uns entgegenkommt: Der Adapter reicht in
 * `withExclusiveTransactionAsync` das Transaktions-Handle weiter, sodass der
 * Aufrufer gar nicht erst versucht ist, auf das aeussere Handle zuzugreifen.
 */
function toPort(db: import('expo-sqlite').SQLiteDatabase): SqlDatabase {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, [...(params ?? [])]),
    getAllAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getAllAsync<T>(source, [...(params ?? [])]),
    getFirstAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getFirstAsync<T>(source, [...(params ?? [])]),
    withExclusiveTransactionAsync: (task) =>
      db.withExclusiveTransactionAsync((txn) => task(toPort(txn))),
  };
}

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SqlDatabase | null = null;
let opening: Promise<SqlDatabase> | null = null;

async function open(): Promise<SqlDatabase> {
  const SQLite = loadSQLite();
  rawDatabase = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const db = toPort(rawDatabase);

  // WAL muss ausserhalb jeder Transaktion gesetzt werden — innerhalb lehnt
  // SQLite den Moduswechsel ab. Deshalb hier, vor den Migrationen.
  await db.execAsync('PRAGMA journal_mode = WAL');

  await runMigrations(db, MIGRATIONS);

  return db;
}

/**
 * Gibt die lokale Datenbank zurueck und legt sie beim ersten Aufruf an.
 *
 * Das `opening`-Promise ist kein Detail: Beim Start koennen mehrere Aufrufer
 * gleichzeitig hier landen, und zwei parallele Migrationslaeufe auf derselben
 * Datei enden in `database is locked`.
 */
export function getDatabase(): Promise<SqlDatabase> {
  if (database) return Promise.resolve(database);

  if (!opening) {
    opening = open()
      .then((db) => {
        database = db;
        return db;
      })
      .finally(() => {
        opening = null;
      });
  }

  return opening;
}

/**
 * Loescht die lokale Datenbank vollstaendig.
 *
 * Beim Logout Pflicht, nicht Kosmetik: Ohne diesen Schritt saehe der naechste
 * Nutzer auf demselben Geraet den Kuehlschrank und die Einkaufsliste des
 * vorigen. Bei lokal persistierten Haushaltsdaten ist das ein Datenleck.
 */
export async function deleteLocalDatabase(): Promise<void> {
  const SQLite = loadSQLite();

  if (rawDatabase) {
    try {
      await rawDatabase.closeAsync();
    } catch (e) {
      console.warn('[db] Fehler beim Schließen der Datenbank:', e);
    }
    rawDatabase = null;
  }

  database = null;
  opening = null;

  try {
    await SQLite.deleteDatabaseAsync(DATABASE_NAME);
  } catch (e) {
    console.warn('[db] Fehler beim Löschen der Datenbank:', e);
  }
}

/**
 * Stellt sicher, dass die lokale Datenbank zum angemeldeten Nutzer gehoert.
 *
 * Meldet sich auf demselben Geraet ein anderer Nutzer an, wird alles Lokale
 * verworfen und neu aufgebaut. Zweite Verteidigungslinie hinter dem Logout:
 * Ein abgebrochener oder fehlgeschlagener Logout darf nicht dazu fuehren, dass
 * fremde Haushaltsdaten stehen bleiben.
 */
export async function ensureDatabaseBelongsTo(userId: string): Promise<SqlDatabase> {
  let db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string }>(
    'select value from app_meta where key = ?',
    ['user_id'],
  );

  if (row?.value === userId) return db;

  if (row?.value !== undefined && row.value !== userId) {
    await deleteLocalDatabase();
    db = await getDatabase();
  }

  await db.runAsync('insert or replace into app_meta (key, value) values (?, ?)', [
    'user_id',
    userId,
  ]);

  return db;
}
