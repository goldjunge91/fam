import { getDatabase } from '@/lib/db/client';
import { DATABASE_FILE_NAMES } from '@/lib/db/database-files';
import type { SqlDatabase } from '@/lib/db/types';
import {
  type OpenFoodFactsProduct,
  parseCategoryTagsJson,
  parseQuantityAndUnit,
} from '@/lib/open-food-facts';

// Der OFF-Dump wird als separates SQLite-Schema fuer die Offline-Suche angehaengt.
// Das native Dateisystemmodul wird erst bei Nutzung geladen, damit Node-Tests importieren koennen.

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
const CHECK_TTL_MS = 24 * 60 * 60 * 1000;

export type GitHubReleaseAsset = {
  name: string;
  browser_download_url: string;
};

export function pickDbAsset(assets: readonly GitHubReleaseAsset[]): GitHubReleaseAsset | undefined {
  return assets.find((asset) => asset.name.toLowerCase().endsWith('.db'));
}

export type DumpRelease = { tag: string; downloadUrl: string };

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

/** Aktualisiert den Dump hoechstens einmal taeglich und behaelt ihn bei Netzfehlern. */
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

/** Umgeht das TTL-Gate fuer den manuellen Refresh im Entwickler-Bereich. */
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

export function isOffDumpAttached(): boolean {
  return attachedThisSession;
}

/** Setzt den zur aktuellen SQLite-Connection gehoerenden Attach-Status zurueck. */
export function resetOffDumpAttachment(): void {
  attachedThisSession = false;
}

export type OffDumpStatus = {
  attached: boolean;
  storedReleaseTag: string | null;
  fileExists: boolean;
  fileSizeBytes: number;
};

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
 * Haengt den Dump als `off_dump` an. Ein bereits belegter Alias gilt wegen
 * Metro Fast Refresh als Erfolg, da die native Connection Reloads ueberlebt.
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

/** Haengt vorhandene Daten sofort und einen neu geladenen Dump anschliessend an. */
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
  /** JSON-serialisiertes `text[]`; fehlt in alten Dumps. */
  categories_tags?: string | null;
  off_last_modified_at?: string | null;
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
  };
}

export type OffDumpSearchResult = { products: OpenFoodFactsProduct[]; hasMore: boolean };

export const DEFAULT_OFF_PAGE_SIZE = 20;

/** Liefert ohne angehaengten Dump eine leere Trefferliste. */
export async function searchOffDump(
  query: string,
  options?: { offset?: number; limit?: number },
): Promise<OffDumpSearchResult> {
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? DEFAULT_OFF_PAGE_SIZE;

  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags, off_last_modified_at
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

export async function fetchProductByBarcodeFromDump(
  barcode: string,
): Promise<OpenFoodFactsProduct | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<OffDumpProductRow>(
      `select code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags, off_last_modified_at
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
