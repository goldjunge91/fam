import { getDatabase } from '@/lib/db/client';
import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import type { SqlDatabase } from '@/lib/db/types';
import { type OpenFoodFactsProduct, parseQuantityAndUnit } from '@/lib/open-food-facts';

/**
 * Lokaler OpenFoodFacts-Dump (#79 zusammen mit dem Dump-CI-Workflow,
 * `.github/workflows/update_dump.yml`): laedt das neueste `products_de_*.db`
 * GitHub-Release-Asset herunter und haengt es als `off_dump`-Schema an die
 * lokale SQLite-Verbindung an, damit die Produktsuche auch ohne Netz gegen
 * den gesamten DE-Bestand laufen kann (nicht nur gegen den kleinen,
 * selbst gepflegten `products`-Spiegel).
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
const RELEASE_TAG_KEY = 'off_dump_release_tag';
const LAST_CHECK_KEY = 'off_dump_last_check_at';
/** Der Dump-CI-Workflow (`update_dump.yml`) veroeffentlicht hoechstens monatlich. */
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;

export type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

/**
 * Waehlt aus den Release-Assets das unkomprimierte SQLite-Dump-Asset
 * (`products_de_<datum>.db`, nicht `.db.gz`) — bewusst unkomprimiert, um
 * keine Gunzip-Abhaengigkeit fuer den Client einzufuehren. Pure Funktion,
 * unabhaengig von Netz/nativen Modulen testbar.
 */
export function pickDbAsset(assets: readonly GitHubReleaseAsset[]): GitHubReleaseAsset | undefined {
  return assets.find((asset) => asset.name.toLowerCase().endsWith('.db'));
}

export type DumpRelease = { tag: string; downloadUrl: string };

/** Fragt den neuesten Dump-Release ab. `null` bei fehlendem Netz/Fehler — kein Wurf. */
export async function checkForNewDumpRelease(): Promise<DumpRelease | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return null;

    const release = (await res.json()) as { tag_name?: string; assets?: GitHubReleaseAsset[] };
    const asset = pickDbAsset(release.assets ?? []);
    if (!asset || !release.tag_name) return null;

    return { tag: release.tag_name, downloadUrl: asset.browser_download_url };
  } catch {
    return null;
  }
}

async function getStoredReleaseTag(db: SqlDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'select value from app_meta where key = ?',
    [RELEASE_TAG_KEY],
  );
  return row?.value ?? null;
}

async function setStoredReleaseTag(db: SqlDatabase, tag: string): Promise<void> {
  await db.runAsync(
    'insert into app_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
    [RELEASE_TAG_KEY, tag],
  );
}

async function getLastCheckAt(db: SqlDatabase): Promise<number | null> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    'select value from app_meta where key = ?',
    [LAST_CHECK_KEY],
  );
  return row?.value ? Number(row.value) : null;
}

async function setLastCheckAt(db: SqlDatabase, timestamp: number): Promise<void> {
  await db.runAsync(
    'insert into app_meta (key, value) values (?, ?) on conflict(key) do update set value = excluded.value',
    [LAST_CHECK_KEY, String(timestamp)],
  );
}

/**
 * Laedt den Dump herunter, wenn eine neuere Version verfuegbar ist (oder noch
 * keine lokale Datei existiert) — sonst ein No-Op. Wirft nie: bei fehlendem
 * Netz bleibt eine schon vorhandene lokale Datei einfach stehen, das ist
 * kein Fehlerfall. Gedacht fuers Feuern-und-Vergessen beim App-Start
 * (`.catch()` beim Aufrufer reicht als Absicherung).
 *
 * Fragt `checkForNewDumpRelease()` hoechstens einmal pro `CHECK_TTL_MS` an,
 * solange schon eine lokale Datei vorliegt — sonst schlaegt jeder App-Start
 * gegen die anonyme GitHub-Rate-Limit-Grenze auf, obwohl der Dump laut
 * `update_dump.yml` nur monatlich neu erscheint.
 *
 * Liefert den lokalen Datei-URI, sobald irgendeine Version vorliegt.
 */
export async function ensureOffDumpDownloaded(db: SqlDatabase): Promise<string | null> {
  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);

  const lastCheckAt = await getLastCheckAt(db);
  if (target.exists && lastCheckAt !== null && Date.now() - lastCheckAt < CHECK_TTL_MS) {
    return target.uri;
  }

  const release = await checkForNewDumpRelease();
  if (!release) return target.exists ? target.uri : null;
  await setLastCheckAt(db, Date.now());

  const storedTag = await getStoredReleaseTag(db);
  if (release.tag === storedTag && target.exists) return target.uri;

  await File.downloadFileAsync(release.downloadUrl, target, { idempotent: true });
  await setStoredReleaseTag(db, release.tag);
  return target.uri;
}

/**
 * Erzwingt einen sofortigen Release-Check und Download, unabhaengig vom
 * `CHECK_TTL_MS`-Gate und selbst wenn Tag und Datei bereits uebereinstimmen —
 * fuer den manuellen "Dump neu laden"-Knopf im Entwickler-Bereich, wo genau
 * dieses Warten/Ueberspringen den Sinn der Aktion untergraeben wuerde. Wirft
 * (statt `null` zurueckzugeben) bei fehlendem Netz/Release, damit der
 * aufrufende Button den Fehler in einem `Alert` anzeigen kann.
 */
export async function forceRefreshOffDump(db: SqlDatabase): Promise<string> {
  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);

  const release = await checkForNewDumpRelease();
  if (!release) {
    throw new Error('Kein Release gefunden (kein Netz oder GitHub nicht erreichbar).');
  }

  await setLastCheckAt(db, Date.now());
  await File.downloadFileAsync(release.downloadUrl, target, { idempotent: true });
  await setStoredReleaseTag(db, release.tag);
  return target.uri;
}

function toFsPath(uri: string): string {
  return uri.startsWith('file://') ? uri.slice('file://'.length) : uri;
}

let attachedThisSession = false;

/** Ob `attachOffDump` in diesem Prozesslauf bereits erfolgreich angehaengt hat. */
export function isOffDumpAttached(): boolean {
  return attachedThisSession;
}

/**
 * Setzt den Attach-Status zurueck, wenn die zugrundeliegende Connection
 * verschwindet (Logout-Wipe, Nutzerwechsel-Wipe in `client.ts`). Ohne diesen
 * Aufruf haelt `attachedThisSession` weiter `true` gegen eine Verbindung, an
 * der nie ein `ATTACH` lief — `isOffDumpAttached()`/`getOffDumpStatus()`
 * luegen dann, und `attachOffDump()` haengt nie neu an.
 */
export function resetOffDumpAttachment(): void {
  attachedThisSession = false;
}

export type OffDumpStatus = {
  attached: boolean;
  /** Release-Tag der zuletzt heruntergeladenen Version, `null` wenn noch nie geladen. */
  storedReleaseTag: string | null;
  fileExists: boolean;
  fileSizeBytes: number;
};

/**
 * Fuers Entwickler-Bereich (#79-Nachfrage "woher weiss ich, ob wir den
 * Release runtergeladen haben"): fasst zusammen, ob der Dump lokal liegt,
 * welche Version, und ob er an die aktuelle Connection angehaengt ist.
 */
export async function getOffDumpStatus(db: SqlDatabase): Promise<OffDumpStatus> {
  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);

  return {
    attached: attachedThisSession,
    storedReleaseTag: await getStoredReleaseTag(db),
    fileExists: target.exists,
    fileSizeBytes: target.exists ? target.size : 0,
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
  if (attachedThisSession) return true;

  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);
  if (!target.exists) return false;

  const escapedPath = toFsPath(target.uri).replace(/'/g, "''");
  try {
    await db.execAsync(`ATTACH DATABASE '${escapedPath}' AS off_dump`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('off_dump is already in use')) throw err;
  }
  attachedThisSession = true;
  return true;
}

/**
 * Einstiegspunkt fuer App-Start/Nutzerwechsel: haengt zuerst an, was schon
 * lokal liegt (schnell, kein Netz noetig), bevor `ensureOffDumpDownloaded`
 * — TTL-gated, siehe dort — im Hintergrund auf eine neue Version prueft. Der
 * zweite `attachOffDump`-Aufruf ist kein Duplikat: Lag noch keine Datei vor,
 * war der erste ein No-Op (`return false`), und erst nach dem Download gibt
 * es etwas anzuhaengen.
 */
export async function initOffDump(db: SqlDatabase): Promise<void> {
  await attachOffDump(db);
  await ensureOffDumpDownloaded(db);
  await attachOffDump(db);
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

  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
       from off_dump.products
       where lower(product_name) like ?
       order by product_name
       limit ? offset ?`,
      [`%${query.trim().toLowerCase()}%`, limit, offset],
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
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt
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
