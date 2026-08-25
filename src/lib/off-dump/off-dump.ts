import { getDatabase } from '@/lib/db/client';
import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import type { SqlDatabase } from '@/lib/db/types';
import {
  type OpenFoodFactsProduct,
  parseCategoryTagsJson,
  parseQuantityAndUnit,
} from '@/lib/open-food-facts';
import { installBaseline } from './baseline-installer';
import { createExpoFileOps } from './expo-file-ops';
import { fetchManifest } from './manifest';
import { isOffDumpAttached, resetOffDumpAttachment, setOffDumpAttached } from './off-dump-state';
import type { DumpPaths } from './repository';
import { checkForUpdate, reconcileOnStart, type UpdateOutcome } from './repository';

/**
 * Lokaler OpenFoodFacts-Dump (#223 Paket 6, Abschnitt 14): haengt die lokal
 * vorhandene Datei sofort an ("Offline-Suche verfuegbar machen"), bevor im
 * Hintergrund ueber `repository.ts` (Manifest, Patch-Kette oder Baseline)
 * geprueft wird, ob eine neuere Version vorliegt. Das rollierende
 * `off-dump-current`-Release (fester Tag, nicht `latest` — siehe
 * `.github/workflows/update_dump.yml`) ist die Quelle.
 *
 * `expo-file-system` wird bewusst per `require()` erst innerhalb der
 * Funktionen geladen statt per Top-Level-`import` — dasselbe Muster wie
 * `loadSQLite()` in `db/client.ts`. Ein natives Modul crasht sonst jeden
 * Test, der diese Datei transitiv importiert (z. B. ueber
 * `product-search-dropdown.tsx`), mit einer Fehlermeldung, die auf die
 * falsche Datei zeigt.
 */

const REBUILD_HINT =
  'expo-file-system ist im installierten Build nicht enthalten. Native Module kommen ' +
  'nicht ueber einen Metro-Reload dazu — der Development Build muss neu erstellt werden.';

function loadFileSystem(): typeof import('expo-file-system') {
  try {
    return require('expo-file-system') as typeof import('expo-file-system');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

const REPO = 'goldjunge91/fam';
const DUMP_FILE_NAME = DATABASE_FILE_NAMES.offDump;
const MANIFEST_URL = `https://github.com/${REPO}/releases/download/off-dump-current/manifest.json`;

const LAST_CHECK_KEY = 'off_dump_last_check_at';
const LAST_SUCCESSFUL_UPDATE_KEY = 'off_dump_last_successful_update_at';
const LAST_ERROR_KEY = 'off_dump_last_error';

/**
 * Anders als beim alten monatlichen Vollneubau liegt die Manifest-URL nicht
 * hinter `api.github.com` (60 anonyme Anfragen/Stunde), sondern ist ein
 * normaler Release-Asset-Download — kein GitHub-API-Rate-Limit einschlaegig.
 * Patches erscheinen laut `update_dump.yml` taeglich, ein kuerzeres Intervall
 * als beim alten System ist deshalb sowohl moeglich als auch sinnvoll.
 */
const CHECK_TTL_MS = 6 * 60 * 60 * 1000;

async function getMetaValue(db: SqlDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'select value from app_meta where key = ?',
    [key],
  );
  return row?.value ?? null;
}

async function setMetaValue(db: SqlDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'insert into app_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
    [key, value],
  );
}

function toFsPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

/** Pfade fuer active/next/recovery — siehe Abschnitt 14 "Sicherer Baseline-Wechsel". */
function dumpPaths(): DumpPaths {
  const { File, Paths } = loadFileSystem();
  return {
    activePath: toFsPath(new File(Paths.document, DUMP_FILE_NAME).uri),
    nextPath: toFsPath(new File(Paths.document, DUMP_FILE_NAME.replace('.db', '.next.db')).uri),
    recoveryPath: toFsPath(
      new File(Paths.document, DUMP_FILE_NAME.replace('.db', '.recovery.db')).uri,
    ),
  };
}

export { isOffDumpAttached, resetOffDumpAttachment };

export type OffDumpStatus = {
  attached: boolean;
  fileExists: boolean;
  fileSizeBytes: number;
  schemaVersion: number | null;
  dataVersion: string | null;
  lastCheckAt: string | null;
  lastSuccessfulUpdateAt: string | null;
  lastError: string | null;
};

/**
 * Fuers Entwickler-Bereich (Abschnitt 14): fasst zusammen, ob der Dump lokal
 * liegt, welche Schema-/Daten-Version, wann zuletzt geprueft/erfolgreich
 * aktualisiert wurde und ob ein Fehler vorliegt.
 */
export async function getOffDumpStatus(db: SqlDatabase): Promise<OffDumpStatus> {
  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);
  const inspected = target.exists
    ? await createExpoFileOps(db).inspectDump(dumpPaths().activePath)
    : null;
  const lastError = await getMetaValue(db, LAST_ERROR_KEY);

  return {
    attached: isOffDumpAttached(),
    fileExists: target.exists,
    fileSizeBytes: target.exists ? target.size : 0,
    schemaVersion: inspected?.schemaVersion ?? null,
    dataVersion: inspected?.dataVersion ?? null,
    lastCheckAt: await getMetaValue(db, LAST_CHECK_KEY),
    lastSuccessfulUpdateAt: await getMetaValue(db, LAST_SUCCESSFUL_UPDATE_KEY),
    lastError: lastError || null,
  };
}

/**
 * Haengt den lokalen Dump als `off_dump`-Schema an die uebergebene
 * Verbindung an (`ATTACH DATABASE ... AS off_dump`) — danach per
 * `off_dump.products` abfragbar. Der Pfad kommt aus der App
 * (Dokumentenverzeichnis), nicht von Nutzereingaben, daher reicht Escaping
 * der einfachen Anfuehrungszeichen: `execAsync` (anders als `runAsync`)
 * unterstuetzt laut `SqlDatabase`-Port ohnehin keine Parameterbindung.
 *
 * Einmal pro Prozesslauf: ein zweites `ATTACH ... AS off_dump` auf derselben
 * Connection schlaegt fehl ("database off_dump is already in use"). Im Dev-
 * Betrieb passiert genau das bei jedem Metro-Fast-Refresh dieses Moduls: Der
 * native SQLite-Connection-Handle bleibt ueber den Reload hinweg bestehen
 * (nichts schliesst ihn), aber `attachedThisSession` ist ein JS-Modul-Level-
 * `let` und wird beim Reload auf `false` zurueckgesetzt — der naechste
 * Aufruf haelt sich faelschlich fuer den ersten und attacht erneut gegen
 * dieselbe, laengst angehaengte Connection. Statt das als Fehler nach oben
 * zu reichen, werten wir genau diese SQLite-Fehlermeldung als "war schon
 * angehaengt" statt als echten Fehlschlag.
 */
export async function attachOffDump(db: SqlDatabase): Promise<boolean> {
  if (isOffDumpAttached()) return true;

  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);
  if (!target.exists) return false;

  const escapedPath = toFsPath(target.uri).replace(/'/g, "''");
  try {
    // Bevorzugt als Read-Only einhängen, damit BEGIN IMMEDIATE auf der
    // Hauptdatenbank keine Schreibtransaktion auf dem Produktkatalog erzwingt.
    try {
      await db.execAsync(`ATTACH DATABASE 'file:${escapedPath}?mode=ro' AS off_dump`);
    } catch {
      await db.execAsync(`ATTACH DATABASE '${escapedPath}' AS off_dump`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('off_dump is already in use')) throw err;
  }
  setOffDumpAttached(true);
  return true;
}

/**
 * Fuehrt den Update-Check aus (Manifest -> Patch-Kette oder Baseline via
 * `repository.ts`) und persistiert Zeitpunkt/Ergebnis fuer den Entwickler-
 * Bereich. Wirft nie.
 *
 * Nach einer erfolgreichen Baseline-Installation ist `off_dump` auf der
 * Connection bereits angehaengt (`baseline-installer.ts` haengt beim
 * Datei-Swap direkt an, ausserhalb des `attachedThisSession`-Flags) — der
 * erneute `attachOffDump`-Aufruf hier gleicht nur das Flag ab: entweder war
 * es der allererste Attach (Datei kam gerade erst dazu), oder er laeuft
 * gegen eine bereits angehaengte Connection und der "already in use"-Fehler
 * wird geschluckt (siehe `attachOffDump`).
 */
async function runUpdateCheck(db: SqlDatabase): Promise<UpdateOutcome> {
  const fileOps = createExpoFileOps(db);
  const paths = dumpPaths();

  await setMetaValue(db, LAST_CHECK_KEY, new Date().toISOString());
  try {
    const outcome = await checkForUpdate({ db, fileOps, manifestUrl: MANIFEST_URL, paths });
    if (outcome.kind === 'patched' || outcome.kind === 'baseline-installed') {
      await setMetaValue(db, LAST_SUCCESSFUL_UPDATE_KEY, new Date().toISOString());
      await setMetaValue(db, LAST_ERROR_KEY, '');
      await attachOffDump(db);
    } else if (outcome.kind === 'baseline-failed') {
      await setMetaValue(db, LAST_ERROR_KEY, 'Baseline-Installation fehlgeschlagen.');
    }
    return outcome;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setMetaValue(db, LAST_ERROR_KEY, message);
    return { kind: 'manifest-unavailable' };
  }
}

/**
 * Fail-Safe: die TTL-Sperre gilt nur, solange bereits ein lokaler Dump
 * existiert (Routine-Check auf eine neuere Version). Ohne lokalen Dump —
 * etwa weil der allererste Check auf ein zu diesem Zeitpunkt noch nicht
 * existentes Release traf (`manifest-unavailable`, siehe `runUpdateCheck`) —
 * wuerde die Sperre sonst bis zu 6h lang jeden weiteren App-Start blockieren,
 * selbst wenn das Manifest laengst verfuegbar ist. Ein simpler Neustart soll
 * in diesem Zustand immer einen neuen Versuch anstossen.
 */
async function checkForUpdateIfDue(db: SqlDatabase): Promise<void> {
  const { File, Paths } = loadFileSystem();
  const hasLocalDump = new File(Paths.document, DUMP_FILE_NAME).exists;

  if (hasLocalDump) {
    const lastCheckAt = await getMetaValue(db, LAST_CHECK_KEY);
    if (lastCheckAt && Date.now() - Date.parse(lastCheckAt) < CHECK_TTL_MS) return;
  }

  await runUpdateCheck(db);
}

/**
 * Erzwingt einen sofortigen Update-Check, unabhaengig vom `CHECK_TTL_MS`-
 * Gate — fuer den "Jetzt aktualisieren"-Knopf im Entwickler-Bereich. Wirft
 * bei Fehlschlag (statt nur den Outcome zurueckzugeben), damit der Button
 * den Fehler in einem `Alert` anzeigen kann.
 */
export async function forceRefreshOffDump(db: SqlDatabase): Promise<UpdateOutcome> {
  const outcome = await runUpdateCheck(db);
  if (outcome.kind === 'manifest-unavailable') {
    throw new Error('Kein Manifest gefunden (kein Netz oder GitHub nicht erreichbar).');
  }
  if (outcome.kind === 'baseline-failed') {
    throw new Error('Baseline-Installation fehlgeschlagen (Pruefsumme/Schema ungueltig).');
  }
  return outcome;
}

/**
 * Erzwingt eine frische Baseline unabhaengig von einer moeglichen
 * Patch-Kette — fuer den "Baseline neu installieren"-Knopf im
 * Entwickler-Bereich, gedacht als Reparaturweg bei einem als beschaedigt
 * vermuteten lokalen Dump.
 */
export async function reinstallOffDumpBaseline(db: SqlDatabase): Promise<UpdateOutcome> {
  const manifest = await fetchManifest(MANIFEST_URL);
  if (!manifest) {
    throw new Error('Kein Manifest gefunden (kein Netz oder GitHub nicht erreichbar).');
  }

  const fileOps = createExpoFileOps(db);
  const paths = dumpPaths();
  const result = await installBaseline(db, fileOps, {
    downloadUrl: manifest.baseline.url,
    expectedChecksum: manifest.baseline.checksum,
    expectedSchemaVersion: manifest.schemaVersion,
    activePath: paths.activePath,
    nextPath: paths.nextPath,
    recoveryPath: paths.recoveryPath,
  });
  if (!result.ok) {
    await setMetaValue(db, LAST_ERROR_KEY, 'Baseline-Installation fehlgeschlagen.');
    throw new Error('Baseline-Installation fehlgeschlagen (Pruefsumme/Schema ungueltig).');
  }

  await setMetaValue(db, LAST_SUCCESSFUL_UPDATE_KEY, new Date().toISOString());
  await setMetaValue(db, LAST_ERROR_KEY, '');
  await attachOffDump(db);
  return { kind: 'baseline-installed', dataVersion: result.dataVersion };
}

/**
 * Prueft die Integritaet der lokal angehaengten Dump-Datei (`quick_check`)
 * — fuer den "Integritaet pruefen"-Knopf im Entwickler-Bereich.
 */
export async function checkOffDumpIntegrity(db: SqlDatabase): Promise<boolean> {
  const inspected = await createExpoFileOps(db).inspectDump(dumpPaths().activePath);
  return inspected?.integrityOk ?? false;
}

/**
 * Einstiegspunkt fuer App-Start/Nutzerwechsel: bereinigt zuerst einen
 * ggf. inkonsistenten Dateizustand vom letzten Absturz
 * (`reconcileOnStart`), haengt dann an, was lokal liegt (schnell, kein
 * Netz noetig — "Offline-Suche verfuegbar machen"), und prueft erst danach
 * im Hintergrund (TTL-gated) auf eine neue Version. Wirft nie: ein
 * fehlgeschlagener Update-Check ist kein Grund, den App-Start zu blockieren
 * oder abzubrechen.
 */
export async function initOffDump(db: SqlDatabase): Promise<void> {
  const fileOps = createExpoFileOps(db);
  await reconcileOnStart(fileOps, dumpPaths());
  await attachOffDump(db);

  checkForUpdateIfDue(db).catch((err) => {
    console.warn('[OffDump] Update-Check fehlgeschlagen:', err);
  });
}

export type OffDumpProductRow = {
  code: string | null;
  product_name: string;
  brand: string | null;
  quantity: string | null;
  nutriscore: string | null;
  energy_kcal: number | null;
  fat: number | null;
  saturated_fat: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  proteins: number | null;
  salt: number | null;
  /**
   * JSON-serialisiertes `text[]`, erst ab Dump Schema 2 (#223 Paket 4). Ein
   * gegen einen alten Schema-1-Dump laufendes `select` liefert diese Spalte
   * gar nicht erst — `undefined`/`null` sind daher gleichwertig zu "keine Tags".
   */
  categories_tags?: string | null;
  off_last_modified_at?: string | null;
  /**
   * Front-Produktfoto (URL bei images.openfoodfacts.org), erst ab Dump
   * Schema 3. Wie `categories_tags`: gegen einen aelteren Dump liefert das
   * `select` diese Spalte gar nicht erst — `undefined` heisst dann "kein
   * Bild bekannt", nicht "Dump kaputt".
   */
  image_url?: string | null;
};

export function toOpenFoodFactsProductFromDump(row: OffDumpProductRow): OpenFoodFactsProduct {
  const { quantity, unit } = parseQuantityAndUnit(row.quantity ?? undefined);
  return {
    barcode: row.code ?? '',
    name: row.product_name,
    brand: row.brand ?? undefined,
    quantity,
    unit,
    caloriesPer100g: row.energy_kcal ?? undefined,
    proteinsPer100g: row.proteins ?? undefined,
    carbsPer100g: row.carbohydrates ?? undefined,
    fatPer100g: row.fat ?? undefined,
    sugarsPer100g: row.sugars ?? undefined,
    saturatedFatPer100g: row.saturated_fat ?? undefined,
    saltPer100g: row.salt ?? undefined,
    nutriScore: (row.nutriscore || undefined) as OpenFoodFactsProduct['nutriScore'],
    categoryTags: parseCategoryTagsJson(row.categories_tags),
    offLastModifiedAt: row.off_last_modified_at ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

export type OffDumpSearchResult = { products: OpenFoodFactsProduct[]; hasMore: boolean };

export const DEFAULT_OFF_PAGE_SIZE = 20;

/**
 * Suche gegen den angehängten OpenFoodFacts-Dump (#79 + Dump-CI-Workflow).
 * Läuft still ins Leere (`{ products: [], hasMore: false }`), wenn der Dump
 * noch nicht heruntergeladen oder angehängt ist.
 */
export async function searchOffDump(
  query: string,
  options?: { offset?: number; limit?: number },
): Promise<OffDumpSearchResult> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_OFF_PAGE_SIZE;

  // Einzelne Suchanker statt der kompletten Phrase: Dadurch liefert der
  // Dump fuer Eingaben wie "1l coca ccola" Coca-Cola-Kandidaten, obwohl der
  // Tippfehler `ccola` nicht als exakter SQLite-LIKE-String existiert. Das
  // eigentliche Ranking und die Tippfehler-Toleranz laufen danach zentral in
  // `search-ranking.ts`.
  const tokens = query
    .trim()
    .toLocaleLowerCase('de-DE')
    .replace(/\d+(?:[.,]\d+)?\s*(?:kg|g|ml|l)\b/g, ' ')
    .replace(/[^a-z0-9äöüß]+/gi, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2);
  if (tokens.length === 0) return { products: [], hasMore: false };

  try {
    const db = await getDatabase();
    const conditions = tokens.flatMap(() => ['lower(product_name) like ?', 'lower(brand) like ?']);
    const params = tokens.flatMap((token) => [`%${token}%`, `%${token}%`]);
    const rows = await db.getAllAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags, off_last_modified_at, image_url
       from off_dump.products
       where ${conditions.join(' or ')}
       order by product_name
       limit ? offset ?`,
      [...params, limit, offset],
    );
    return {
      products: rows.map(toOpenFoodFactsProductFromDump),
      hasMore: rows.length === limit,
    };
  } catch {
    return { products: [], hasMore: false };
  }
}

/**
 * Exakter Barcode-Lookup im lokalen OpenFoodFacts-Dump.
 * Gibt null zurück, wenn der Barcode lokal nicht gefunden wird oder der Dump nicht aktiv ist.
 */
export async function fetchProductByBarcodeFromDump(
  barcode: string,
): Promise<OpenFoodFactsProduct | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags, off_last_modified_at, image_url
       from off_dump.products
       where code = ?
       limit 1`,
      [barcode.trim()],
    );
    return row ? toOpenFoodFactsProductFromDump(row) : null;
  } catch {
    return null;
  }
}

/**
 * Führt Produktlisten zusammen und filtert Duplikate anhand des Barcodes heraus.
 */
export function dedupeProductsByBarcode(products: OpenFoodFactsProduct[]): OpenFoodFactsProduct[] {
  const seen = new Set<string>();
  const result: OpenFoodFactsProduct[] = [];
  for (const product of products) {
    if (product.barcode && seen.has(product.barcode)) continue;
    if (product.barcode) seen.add(product.barcode);
    result.push(product);
  }
  return result;
}
