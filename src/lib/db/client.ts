import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import { type SqlStatementDriver, serializeDatabase } from '@/lib/db/serialize';
import type { SqlDatabase } from '@/lib/db/types';
import { resetOffDumpAttachment } from '@/lib/off-dump/off-dump-state';

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

/**
 * Uebersetzt eine `SQLiteDatabase` in die rohe Statement-Schicht.
 *
 * Noetig, weil `expo-sqlite` die Parameter als Pflichtargument fuehrt (und
 * zusaetzlich variadisch ueberlaedt), der Port sie aber optional macht. Ohne
 * diese duenne Schicht passt die Signatur nicht — und ein `as`-Cast wuerde die
 * Unstimmigkeit nur verstecken.
 *
 * Transaktionen fehlen hier bewusst: Die kommen aus `serialize.ts`, nicht von
 * `expo-sqlite`. Dessen `withExclusiveTransactionAsync` oeffnet pro Aufruf eine
 * eigene Connection und faehrt ein deferred `BEGIN` — die Kombination, die zu
 * "database is locked" gefuehrt hat. Die Begruendung steht ausfuehrlich im Kopf
 * von `serialize.ts`.
 */
function toDriver(db: import('expo-sqlite').SQLiteDatabase): SqlStatementDriver {
  return {
    execAsync: (source) => db.execAsync(source),
    runAsync: (source, params) => db.runAsync(source, [...(params ?? [])]),
    getAllAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getAllAsync<T>(source, [...(params ?? [])]),
    getFirstAsync: <T>(source: string, params?: readonly (string | number | null)[]) =>
      db.getFirstAsync<T>(source, [...(params ?? [])]),
  };
}

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SqlDatabase | null = null;
let opening: Promise<SqlDatabase> | null = null;

/** Der zuletzt gemeldete angemeldete Nutzer. `null` = noch unbekannt oder abgemeldet. */
let activeUserId: string | null = null;
/** Fuer welche Nutzer-Id die geoeffnete Datei bereits geprueft wurde. */
let checkedUserId: string | null = null;

/**
 * Meldet den angemeldeten Nutzer an die Datenbankschicht.
 *
 * Wird vom `SessionProvider` aufgerufen, und zwar **synchron vor** dessen
 * `setState`: Sonst koennte eine Komponente durch das Re-Render schon
 * `getDatabase()` aufrufen, waehrend hier noch der vorige Nutzer steht — und
 * genau dieser Aufruf wuerde die Pruefung ueberspringen.
 */
export function setActiveUserId(userId: string | null): void {
  activeUserId = userId;
}

/**
 * Ist die geoeffnete Datei fuer den aktuell bekannten Nutzer freigegeben?
 *
 * Bei `activeUserId === null` gibt es nichts zu vergleichen — beim App-Start,
 * bevor die Session gelesen ist, und nach dem Abmelden. Der Preis dafuer ist
 * bewusst klein gehalten: In diesem Fenster laeuft nur die Outbox-Zaehlung des
 * `SyncStatusBanner`, also eine Zahl, kein Inhalt. Sobald die Session da ist,
 * prueft der naechste Aufruf.
 */
function isVerifiedForActiveUser(): boolean {
  return activeUserId === null || checkedUserId === activeUserId;
}

async function open(): Promise<SqlDatabase> {
  const SQLite = loadSQLite();
  rawDatabase = await SQLite.openDatabaseAsync(DATABASE_FILE_NAMES.main);
  const db = serializeDatabase(toDriver(rawDatabase));

  try {
    // WAL muss ausserhalb jeder Transaktion gesetzt werden — innerhalb lehnt
    // SQLite den Moduswechsel ab. Deshalb hier, vor den Migrationen.
    await db.execAsync('PRAGMA journal_mode = WAL');

    // Netz fuer Connections, die uns nicht gehoeren: die Devtools-Registrierung
    // von `expo-sqlite` im Dev-Build und WAL-Checkpoints. Die Zugriffe der App
    // selbst laufen serialisiert ueber eine Connection und kollidieren nicht mehr
    // (siehe `serialize.ts`) — dieser PRAGMA ersetzt das nicht, er sichert nur
    // den Rest ab. Wert 5000, weil die UI alle 3 s pollt: kuerzer hiesse, mitten
    // im normalen Takt aufzugeben.
    await db.execAsync('PRAGMA busy_timeout = 5000');

    await runMigrations(db, MIGRATIONS);
  } catch (error) {
    console.warn('[db] Initialisierung fehlgeschlagen, setze Datenbank zurück:', error);
    await closeAndDeleteFile();
    rawDatabase = await SQLite.openDatabaseAsync(DATABASE_FILE_NAMES.main);
    const freshDb = serializeDatabase(toDriver(rawDatabase));
    await freshDb.execAsync('PRAGMA journal_mode = WAL');
    await freshDb.execAsync('PRAGMA busy_timeout = 5000');
    await runMigrations(freshDb, MIGRATIONS);
    return freshDb;
  }

  return db;
}

/**
 * Oeffnet — falls noetig — und prueft die Zugehoerigkeit zum angemeldeten Nutzer.
 *
 * Beides in einem Durchlauf, weil beides unter denselben Mutex gehoert: Ein
 * Wipe mitten im Betrieb loescht die Datei, auf der ein paralleler Aufrufer
 * gerade arbeiten wuerde.
 */
async function openAndVerify(): Promise<SqlDatabase> {
  let db = database ?? (await open());
  database = db;

  const userId = activeUserId;
  if (userId !== null && checkedUserId !== userId) {
    db = await ensureDatabaseBelongsTo(db, userId, async () => {
      // Nur schliessen und loeschen — `opening` bleibt stehen, denn wir sind
      // gerade selbst dieses Promise. Wuerde es hier zurueckgesetzt, koennte
      // ein zweiter Aufrufer daneben einen zweiten Oeffnungslauf starten.
      await closeAndDeleteFile();
      const fresh = await open();
      database = fresh;
      return fresh;
    });

    database = db;
    checkedUserId = userId;
  }

  return db;
}

/**
 * Gibt die lokale Datenbank zurueck und legt sie beim ersten Aufruf an.
 *
 * Das `opening`-Promise ist kein Detail: Beim Start koennen mehrere Aufrufer
 * gleichzeitig hier landen, und zwei parallele Migrationslaeufe auf derselben
 * Datei enden in `database is locked`.
 *
 * Die Nutzerpruefung sitzt bewusst hier drin und nicht in einem Effekt weiter
 * oben im Komponentenbaum: Der `SyncStatusBanner` haengt im Root-Layout und
 * ruft `getDatabase()` unabhaengig von jedem Auth- oder Onboarding-Zustand auf.
 * Ein Gate, das nur innerhalb von `(app)/_layout.tsx` sitzt, wuerde ihn
 * strukturell uebersehen. So wartet jeder Aufrufer auf denselben Lauf.
 */
export function getDatabase(): Promise<SqlDatabase> {
  if (database && isVerifiedForActiveUser()) return Promise.resolve(database);

  if (!opening) {
    opening = openAndVerify().finally(() => {
      opening = null;
    });
  }

  return opening;
}

/**
 * Schliesst die Connection und loescht die Datei — ohne `opening` anzufassen.
 *
 * Getrennt von `deleteLocalDatabase()`, weil der Wipe aus `openAndVerify()`
 * heraus *innerhalb* des laufenden Oeffnungs-Promise passiert und es deshalb
 * nicht zuruecksetzen darf.
 *
 * Das Schliessen ist nicht optional: `deleteDatabaseAsync` wirft, solange
 * irgendeine Connection die Datei noch haelt ("Unable to delete database that
 * is currently open"). Genau daran ist das Aufraeumen beim Logout bisher
 * stillschweigend gescheitert, wenn eine Transaktion haengengeblieben war.
 */
async function closeAndDeleteFile(): Promise<void> {
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
  // Die geloeschte Datei nimmt jeden bisherigen `ATTACH ... AS off_dump` mit —
  // ohne diesen Reset wuerde `attachOffDump()` faelschlich "schon angehaengt"
  // gegen die naechste, frische Connection melden (siehe off-dump.ts).
  resetOffDumpAttachment();

  const filesToDelete = [
    DATABASE_FILE_NAMES.main,
    `${DATABASE_FILE_NAMES.main}-wal`,
    `${DATABASE_FILE_NAMES.main}-shm`,
    `${DATABASE_FILE_NAMES.main}-journal`,
  ];

  for (const fileName of filesToDelete) {
    try {
      await SQLite.deleteDatabaseAsync(fileName);
    } catch {
      // Ignorieren, falls Hilfsdateien (-wal, -shm, etc.) nicht existieren
    }
  }
}

/**
 * Loescht die lokale Datenbank vollstaendig.
 *
 * Beim Logout Pflicht, nicht Kosmetik: Ohne diesen Schritt saehe der naechste
 * Nutzer auf demselben Geraet den Kuehlschrank und die Einkaufsliste des
 * vorigen. Bei lokal persistierten Haushaltsdaten ist das ein Datenleck.
 */
export async function deleteLocalDatabase(): Promise<void> {
  await closeAndDeleteFile();

  opening = null;
  // Die naechste geoeffnete Datei muss neu geprueft werden. Ohne das Zuruecksetzen
  // wuerde eine spaeter erneut angelegte Datenbank als "fuer diesen Nutzer schon
  // geprueft" gelten.
  checkedUserId = null;
}
