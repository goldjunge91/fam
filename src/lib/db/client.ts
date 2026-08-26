import {
  deleteDatabaseEncryptionKey,
  getOrCreateDatabaseEncryptionKey,
  keyAndVerifyDatabase,
  openEncryptedDatabaseWithCutover,
} from '@/lib/db/database-encryption';
import { createExpoDatabaseFileOps, DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import { createDrizzleDatabase, type DrizzleDatabase } from '@/lib/db/drizzle-driver';
import { runDrizzleMigrations } from '@/lib/db/drizzle-migrator';
import { MIGRATIONS } from '@/lib/db/migrations';
import { runMigrations } from '@/lib/db/migrator';
import { ensureDatabaseBelongsTo } from '@/lib/db/ownership';
import {
  type SerializedSqlDatabase,
  type SqlStatementDriver,
  serializeDatabase,
} from '@/lib/db/serialize';
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
    getAllRawAsync: async (source, params) => {
      const statement = await db.prepareAsync(source);
      try {
        const result = await statement.executeForRawResultAsync<
          Record<string, string | number | null>
        >([...(params ?? [])]);
        return await result.getAllAsync();
      } finally {
        await statement.finalizeAsync();
      }
    },
  };
}

type DatabaseConnection = {
  raw: import('expo-sqlite').SQLiteDatabase;
  db: SerializedSqlDatabase;
};

let rawDatabase: import('expo-sqlite').SQLiteDatabase | null = null;
let database: SerializedSqlDatabase | null = null;
let drizzleDatabase: DrizzleDatabase | null = null;
let opening: Promise<SqlDatabase> | null = null;
let wipeInProgress: Promise<void> | null = null;
let lifecycleGeneration = 0;

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
  if (activeUserId !== userId) lifecycleGeneration += 1;
  activeUserId = userId;
}

/**
 * Ist die geoeffnete Datei fuer den aktuell bekannten Nutzer freigegeben?
 *
 * Ohne autoritative Session gibt es keine sichere Ownership. Auch reine
 * Zählabfragen bleiben deshalb gesperrt: Bereits eine Outbox-Zeile kann private
 * Metadaten des vorigen Accounts enthalten.
 */
function isVerifiedForActiveUser(): boolean {
  return activeUserId !== null && checkedUserId === activeUserId;
}

function assertLifecycle(generation: number, userId: string): void {
  if (generation !== lifecycleGeneration || activeUserId !== userId || wipeInProgress !== null) {
    throw new Error('Der Datenbankzugriff wurde durch einen Accountwechsel abgebrochen.');
  }
}

async function open(): Promise<DatabaseConnection> {
  const SQLite = loadSQLite();
  const databaseDirectory = SQLite.defaultDatabaseDirectory;
  if (typeof databaseDirectory !== 'string') {
    throw new Error('Das native SQLite-Datenbankverzeichnis ist nicht verfügbar.');
  }

  const key = await getOrCreateDatabaseEncryptionKey();
  const files = createExpoDatabaseFileOps(databaseDirectory);
  const openPlaintext = (fileName: string) =>
    SQLite.openDatabaseAsync(fileName, { useNewConnection: true });
  const openEncrypted = async (fileName: string, encryptionKey: string) => {
    const opened = await SQLite.openDatabaseAsync(fileName, {
      useNewConnection: true,
    });
    try {
      // Muss das allererste Statement nach openDatabaseAsync bleiben.
      await keyAndVerifyDatabase(opened, encryptionKey);
      return opened;
    } catch (error) {
      await opened.closeAsync();
      throw error;
    }
  };

  const openedDatabase = await openEncryptedDatabaseWithCutover(
    {
      files,
      mainFileName: DATABASE_FILE_NAMES.main,
      encryptedNextFileName: DATABASE_FILE_NAMES.encryptedNext,
      plaintextRecoveryFileName: DATABASE_FILE_NAMES.plaintextRecovery,
      openPlaintext,
      openEncrypted,
    },
    key,
  );
  const db = serializeDatabase(toDriver(openedDatabase));

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
    await runDrizzleMigrations(db);
  } catch (error) {
    // Nie automatisch löschen: In der Datei kann eine nicht synchronisierte
    // Outbox liegen. Insbesondere ein falscher/verlorener Key darf keinen
    // destruktiven "Recovery"-Pfad auslösen.
    console.warn('[db] Initialisierung fehlgeschlagen; Datenbank bleibt erhalten:', error);
    try {
      await db.closeForLifecycle(() => openedDatabase.closeAsync());
    } catch (closeError) {
      rawDatabase = openedDatabase;
      database = db;
      throw new Error('Die fehlgeschlagene Datenbanköffnung konnte nicht geschlossen werden.', {
        cause: closeError,
      });
    }
    throw error;
  }

  return { raw: openedDatabase, db };
}

/**
 * Oeffnet — falls noetig — und prueft die Zugehoerigkeit zum angemeldeten Nutzer.
 *
 * Beides in einem Durchlauf, weil beides unter denselben Mutex gehoert: Ein
 * Wipe mitten im Betrieb loescht die Datei, auf der ein paralleler Aufrufer
 * gerade arbeiten wuerde.
 */
async function openAndVerify(generation: number, userId: string): Promise<SqlDatabase> {
  let connection = database && rawDatabase ? { db: database, raw: rawDatabase } : await open();

  try {
    assertLifecycle(generation, userId);
    if (checkedUserId !== userId) {
      const verified = await ensureDatabaseBelongsTo(
        connection.db,
        userId,
        async () => {
          await closeAndDeleteFile(connection);
          assertLifecycle(generation, userId);
          connection = await open();
          assertLifecycle(generation, userId);
          return connection.db;
        },
        () => assertLifecycle(generation, userId),
      );
      connection = { ...connection, db: verified as SerializedSqlDatabase };
    }

    assertLifecycle(generation, userId);
    rawDatabase = connection.raw;
    database = connection.db;
    checkedUserId = userId;
    return connection.db;
  } catch (error) {
    // Eine noch nicht veröffentlichte Connection gehört ausschließlich diesem
    // fehlgeschlagenen Open-Lauf und darf nicht bis nach dem Wipe offen bleiben.
    if (connection.raw !== rawDatabase) {
      try {
        await connection.db.closeForLifecycle(() => connection.raw.closeAsync());
      } catch (closeError) {
        // Auch eine stale, noch nicht veröffentlichte Connection muss für den
        // Retry erreichbar bleiben. `activeUserId === null` blockiert Zugriffe.
        rawDatabase = connection.raw;
        database = connection.db;
        drizzleDatabase = null;
        throw new Error('Eine veraltete Datenbanköffnung konnte nicht geschlossen werden.', {
          cause: closeError,
        });
      }
    }
    throw error;
  }
}

/**
 * Gibt die lokale Datenbank zurueck und legt sie beim ersten Aufruf an.
 *
 * Das `opening`-Promise ist kein Detail: Beim Start koennen mehrere Aufrufer
 * gleichzeitig hier landen, und zwei parallele Migrationslaeufe auf derselben
 * Datei enden in `database is locked`.
 *
 * Die Nutzerprüfung sitzt bewusst zusätzlich hier und nicht nur im
 * Komponentenbaum. UI-Gates verhindern erwartbare Aufrufe ohne Session; diese
 * Grenze schützt auch Hintergrundtasks und zukünftige Aufrufer.
 */
export function getDatabase(): Promise<SqlDatabase> {
  if (activeUserId === null) {
    return Promise.reject(new Error('Ohne angemeldeten Nutzer ist die lokale Datenbank gesperrt.'));
  }
  if (wipeInProgress) {
    return Promise.reject(new Error('Die lokale Datenbank wird gerade gelöscht.'));
  }
  if (database && isVerifiedForActiveUser()) return Promise.resolve(database);

  if (!opening) {
    const generation = lifecycleGeneration;
    const userId = activeUserId;
    const pending = openAndVerify(generation, userId).finally(() => {
      if (opening === pending) opening = null;
    });
    opening = pending;
  }

  return opening;
}

/**
 * Typisierter Drizzle-Zugriff auf dieselbe serialisierte Connection.
 *
 * Kein `openDatabase*` und kein zweiter Mutex: Der Proxy delegiert jedes
 * Statement an den bereits von `getDatabase()` verwalteten Port. Transaktionen
 * bleiben weiterhin Aufgabe von `SqlDatabase.withExclusiveTransactionAsync`.
 */
export async function getDrizzleDatabase(): Promise<DrizzleDatabase> {
  const db = await getDatabase();
  drizzleDatabase ??= createDrizzleDatabase(db);
  return drizzleDatabase;
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
async function closeAndDeleteFile(connection?: DatabaseConnection): Promise<void> {
  const SQLite = loadSQLite();
  const errors: unknown[] = [];
  const connectionToClose =
    connection ?? (database && rawDatabase ? { db: database, raw: rawDatabase } : null);

  if (connectionToClose) {
    try {
      await connectionToClose.db.closeForLifecycle(() => connectionToClose.raw.closeAsync());
    } catch (error) {
      // Den Handle für einen späteren orphan-cleanup behalten. Der serialisierte
      // Port nimmt keine Statements mehr an, kann den nativen Close nach einem
      // Fehler aber erneut versuchen.
      rawDatabase = connectionToClose.raw;
      database = connectionToClose.db;
      drizzleDatabase = null;
      throw new Error('Die lokale Datenbank konnte nicht geschlossen werden.', { cause: error });
    }
  }

  if (!connection || rawDatabase === connection.raw) {
    rawDatabase = null;
    database = null;
    drizzleDatabase = null;
  }
  // Die geloeschte Datei nimmt jeden bisherigen `ATTACH ... AS off_dump` mit —
  // ohne diesen Reset wuerde `attachOffDump()` faelschlich "schon angehaengt"
  // gegen die naechste, frische Connection melden (siehe off-dump.ts).
  resetOffDumpAttachment();

  const filesToDelete = [
    DATABASE_FILE_NAMES.main,
    DATABASE_FILE_NAMES.encryptedNext,
    DATABASE_FILE_NAMES.plaintextRecovery,
    `${DATABASE_FILE_NAMES.main}-wal`,
    `${DATABASE_FILE_NAMES.main}-shm`,
    `${DATABASE_FILE_NAMES.main}-journal`,
    `${DATABASE_FILE_NAMES.encryptedNext}-wal`,
    `${DATABASE_FILE_NAMES.encryptedNext}-shm`,
    `${DATABASE_FILE_NAMES.encryptedNext}-journal`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-wal`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-shm`,
    `${DATABASE_FILE_NAMES.plaintextRecovery}-journal`,
  ];

  const databaseDirectory = SQLite.defaultDatabaseDirectory;
  if (typeof databaseDirectory !== 'string') {
    errors.push(new Error('Das native SQLite-Datenbankverzeichnis ist nicht verfügbar.'));
  } else {
    const files = createExpoDatabaseFileOps(databaseDirectory);
    for (const fileName of filesToDelete) {
      try {
        await files.delete(fileName);
      } catch (error) {
        errors.push(error);
      }
    }

    const remainingFiles = filesToDelete.filter((fileName) => files.exists(fileName));
    if (remainingFiles.length > 0) {
      errors.push(
        new Error(
          `Sensitive Datenbankdateien konnten nicht gelöscht werden: ${remainingFiles.join(', ')}`,
        ),
      );
    }
  }

  if (errors.length > 0) {
    throw new Error('Der lokale Datenbank-Wipe ist fehlgeschlagen.', { cause: errors[0] });
  }

  // Den Key nie vor den Dateien löschen. Sonst würde ein fehlgeschlagener Wipe
  // die verbliebene Datenbank nur unlesbar machen, aber nicht entfernen.
  await deleteDatabaseEncryptionKey();
}

/**
 * Loescht die lokale Datenbank vollstaendig.
 *
 * Beim Logout Pflicht, nicht Kosmetik: Ohne diesen Schritt saehe der naechste
 * Nutzer auf demselben Geraet den Kuehlschrank und die Einkaufsliste des
 * vorigen. Bei lokal persistierten Haushaltsdaten ist das ein Datenleck.
 */
export function deleteLocalDatabase(): Promise<void> {
  if (wipeInProgress) return wipeInProgress;

  // Synchronous barrier: Jeder bereits gestartete Open-Lauf wird stale, und
  // jeder neue Aufruf sieht `wipeInProgress`, bevor der erste await erreicht ist.
  lifecycleGeneration += 1;
  const pendingOpening = opening;
  const wipe = (async () => {
    if (pendingOpening) {
      try {
        await pendingOpening;
      } catch {
        // Ein durch die Generation absichtlich abgebrochener Open-Lauf ist hier
        // erwartbar. Der anschließende Datei-Check entscheidet über den Wipe.
      }
    }

    await closeAndDeleteFile();
    checkedUserId = null;
  })().finally(() => {
    if (wipeInProgress === wipe) wipeInProgress = null;
  });

  wipeInProgress = wipe;
  return wipe;
}
