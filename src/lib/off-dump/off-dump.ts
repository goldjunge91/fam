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
import { attachPlaintextDatabase } from './plaintext-attachment';
import type { DumpPaths } from './repository';
import { checkForUpdate, reconcileOnStart, type UpdateOutcome } from './repository';

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

export async function attachOffDump(db: SqlDatabase): Promise<boolean> {
  if (isOffDumpAttached()) return true;

  const { File, Paths } = loadFileSystem();
  const target = new File(Paths.document, DUMP_FILE_NAME);
  if (!target.exists) return false;

  const dumpPath = toFsPath(target.uri);
  try {
    // Bevorzugt als Read-Only einhängen, damit BEGIN IMMEDIATE auf der
    // Hauptdatenbank keine Schreibtransaktion auf dem Produktkatalog erzwingt.
    try {
      await attachPlaintextDatabase(db, `file:${dumpPath}?mode=ro`, 'off_dump', 'sqlcipher');
    } catch {
      await attachPlaintextDatabase(db, dumpPath, 'off_dump', 'sqlcipher');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('off_dump is already in use')) throw err;
  }
  setOffDumpAttached(true);
  return true;
}

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

async function checkForUpdateIfDue(db: SqlDatabase): Promise<void> {
  const { File, Paths } = loadFileSystem();
  const hasLocalDump = new File(Paths.document, DUMP_FILE_NAME).exists;

  if (hasLocalDump) {
    const lastCheckAt = await getMetaValue(db, LAST_CHECK_KEY);
    if (lastCheckAt && Date.now() - Date.parse(lastCheckAt) < CHECK_TTL_MS) return;
  }

  await runUpdateCheck(db);
}

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
    attachmentMode: 'sqlcipher',
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

  categories_tags?: string | null;
  off_last_modified_at?: string | null;

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
