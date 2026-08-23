import { env } from '@/lib/env';

export type NutrientLevel = 'low' | 'moderate' | 'high';

export type OpenFoodFactsProduct = {
  barcode: string;
  name: string;
  brand?: string;
  quantity?: number;
  unit?: string;
  imageUrl?: string;
  caloriesPer100g?: number;
  proteinsPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  sugarsPer100g?: number;
  saturatedFatPer100g?: number;
  saltPer100g?: number;
  /** A–E, Open Food Facts Nutri-Score. */
  nutriScore?: 'a' | 'b' | 'c' | 'd' | 'e';
  ingredients?: string;
  allergens?: string[];
  /** NOVA-Verarbeitungsgrad 1 (unverarbeitet) bis 4 (stark verarbeitet). */
  novaGroup?: 1 | 2 | 3 | 4;
  nutrientLevels?: {
    fat?: NutrientLevel;
    saturatedFat?: NutrientLevel;
    sugars?: NutrientLevel;
    salt?: NutrientLevel;
  };
  /** Unveraenderte Open-Food-Facts-`categories_tags`; immer ein Array. */
  categoryTags: string[];
  /** ISO-Zeitstempel aus OFFs `last_modified_t` (Unix-Sekunden), sofern gueltig. */
  offLastModifiedAt?: string;
};

/** Liest die in SQLite als JSON gespeicherten Kategorietags fehlertolerant. */
export function parseCategoryTagsJson(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tag): tag is string => typeof tag === 'string')
      : [];
  } catch {
    return [];
  }
}

export function isLikelyBarcode(value: string): boolean {
  return /^\d{6,14}$/.test(value.trim());
}

export function parseQuantityAndUnit(rawQuantity?: string): { quantity: number; unit: string } {
  if (!rawQuantity) return { quantity: 1, unit: 'piece' };

  const match = rawQuantity.trim().match(/^([\d.,]+)\s*([a-zA-ZäöüÄÖÜµ]+)/);
  if (!match) return { quantity: 1, unit: 'piece' };

  const num = parseFloat(match[1].replace(',', '.'));
  const rawUnit = match[2].toLowerCase();

  let unit = 'piece';
  if (['g', 'gramm', 'gram'].includes(rawUnit)) unit = 'g';
  else if (['kg', 'kilogramm'].includes(rawUnit)) unit = 'kg';
  else if (['l', 'liter'].includes(rawUnit)) unit = 'l';
  else if (['ml', 'milliliter'].includes(rawUnit)) unit = 'ml';
  else if (['stk', 'stück', 'stk.', 'pcs', 'piece'].includes(rawUnit)) unit = 'piece';
  else if (['pkg', 'packung', 'pck', 'pack'].includes(rawUnit)) unit = 'pack';

  return { quantity: Number.isNaN(num) ? 1 : num, unit };
}

// biome-ignore lint/suspicious/noExplicitAny: External Open Food Facts API payload
export function formatOFFProduct(raw: any): OpenFoodFactsProduct | null {
  if (!raw) return null;

  const name =
    raw.product_name_de || raw.product_name || raw.generic_name_de || raw.generic_name || '';

  if (!name.trim()) return null;

  const { quantity, unit } = parseQuantityAndUnit(raw.quantity);
  const nutriments = raw.nutriments || {};
  const rawLevels = raw.nutrient_levels || {};

  const nutrientLevels: OpenFoodFactsProduct['nutrientLevels'] = {
    fat: rawLevels.fat,
    saturatedFat: rawLevels['saturated-fat'],
    sugars: rawLevels.sugars,
    salt: rawLevels.salt,
  };
  const hasNutrientLevels = Object.values(nutrientLevels).some((level) => level !== undefined);
  const ingredients = raw.ingredients_text_de || raw.ingredients_text || undefined;
  const allergenTags: unknown[] = Array.isArray(raw.allergens_tags) ? raw.allergens_tags : [];
  const allergens = allergenTags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.replace(/^[a-z]{2}:/i, '').replaceAll('-', ' '))
    .filter(Boolean);

  const rawCategoryTags: unknown[] = Array.isArray(raw.categories_tags) ? raw.categories_tags : [];
  const categoryTags = rawCategoryTags.filter((tag): tag is string => typeof tag === 'string');

  const lastModifiedT = Number(raw.last_modified_t);
  const offLastModifiedAt =
    Number.isFinite(lastModifiedT) && lastModifiedT > 0
      ? new Date(lastModifiedT * 1000).toISOString()
      : undefined;

  return {
    barcode: raw.code || raw._id || '',
    name: name.trim(),
    brand: raw.brands ? raw.brands.split(',')[0].trim() : undefined,
    quantity,
    unit,
    imageUrl: raw.image_front_small_url || raw.image_front_url || undefined,
    caloriesPer100g: nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal_value'],
    proteinsPer100g: nutriments.proteins_100g ?? nutriments.proteins_value,
    carbsPer100g: nutriments.carbohydrates_100g ?? nutriments.carbohydrates_value,
    fatPer100g: nutriments.fat_100g ?? nutriments.fat_value,
    sugarsPer100g: nutriments.sugars_100g ?? nutriments.sugars_value,
    saturatedFatPer100g: nutriments['saturated-fat_100g'] ?? nutriments['saturated-fat_value'],
    saltPer100g: nutriments.salt_100g ?? nutriments.salt_value,
    nutriScore: raw.nutriscore_grade || undefined,
    ingredients,
    allergens: allergens.length > 0 ? allergens : undefined,
    novaGroup: raw.nova_group || undefined,
    nutrientLevels: hasNutrientLevels ? nutrientLevels : undefined,
    categoryTags,
    offLastModifiedAt,
  };
}

/** Begrenzt die grossen OFF-Produktobjekte auf tatsaechlich gelesene Felder. */
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name',
  'generic_name_de',
  'brands',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriments',
  'nutriscore_grade',
  'ingredients_text',
  'ingredients_text_de',
  'allergens_tags',
  'nova_group',
  'nutrient_levels',
  'categories_tags',
  'last_modified_t',
].join(',');

export type OpenFoodFactsSearchResult = {
  products: OpenFoodFactsProduct[];
  hasMore: boolean;
  /** Unterscheidet Anfragefehler von einer erfolgreichen Suche ohne Treffer. */
  failed: boolean;
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Sliding-Window-Limit fuer die IP-basierten OFF-Anfragegrenzen. */
export class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  private prune(now: number) {
    while (this.timestamps.length > 0 && now - this.timestamps[0] > this.windowMs) {
      this.timestamps.shift();
    }
  }

  isLimited(now: number = Date.now()): boolean {
    this.prune(now);
    return this.timestamps.length >= this.limit;
  }

  record(now: number = Date.now()): void {
    this.prune(now);
    this.timestamps.push(now);
  }
}

// Abstand zu OFFs Grenzen von 10 Suchen bzw. 15 Produktabfragen pro Minute.
const searchRateLimiter = new SlidingWindowRateLimiter(8, 60_000);
const productRateLimiter = new SlidingWindowRateLimiter(12, 60_000);

/** Wiederholt nur Produktabfragen nach 5xx; Abbrueche werden nie wiederholt. */
async function fetchProductWithRetry(
  url: string,
  signal: AbortSignal | undefined,
): Promise<Response | null> {
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (productRateLimiter.isLimited()) return lastResponse ?? null;

    try {
      productRateLimiter.record();
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
        signal,
      });
      if (res.ok || res.status < 500) return res;
      lastResponse = res;
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
    }
    if (attempt < MAX_RETRIES) await delay(RETRY_DELAY_MS);
  }

  if (lastResponse) return lastResponse;
  if (lastError) throw lastError;
  return null;
}

const searchCache = new Map<string, OpenFoodFactsSearchResult>();
const SEARCH_CACHE_LIMIT = 100;

function cacheSearchResult(key: string, result: OpenFoodFactsSearchResult) {
  if (searchCache.size >= SEARCH_CACHE_LIMIT) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, result);
}

/** Durchsucht Open Food Facts seitenweise und ohne suchbudgetfressende Retries. */
export async function searchOpenFoodFacts(
  query: string,
  options: { page?: number; pageSize?: number; signal?: AbortSignal } = {},
): Promise<OpenFoodFactsSearchResult> {
  const { page = 1, pageSize = 20, signal } = options;
  const trimmed = query.trim();
  if (trimmed.length < 2) return { products: [], hasMore: false, failed: false };

  const cacheKey = `${trimmed.toLowerCase()}|${pageSize}|${page}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  if (env.offFactsOffline) {
    return { products: [], hasMore: false, failed: true };
  }

  if (searchRateLimiter.isLimited()) {
    return { products: [], hasMore: false, failed: true };
  }

  try {
    // Die erste Seite soll die meistgescannten statt zufaellige Produkte zeigen.
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
      `&search_simple=1&action=process&json=1&page_size=${pageSize}&page=${page}` +
      `&sort_by=unique_scans_n&lc=de&cc=de&fields=${SEARCH_FIELDS}`;

    searchRateLimiter.record();
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
      signal,
    });

    if (!res.ok) return { products: [], hasMore: false, failed: true };
    const data = await res.json();
    const rawProducts = data.products || [];

    const products = rawProducts
      .map(formatOFFProduct)
      .filter((p: OpenFoodFactsProduct | null): p is OpenFoodFactsProduct => p !== null);

    const result: OpenFoodFactsSearchResult = {
      products,
      hasMore: rawProducts.length === pageSize,
      failed: false,
    };
    cacheSearchResult(cacheKey, result);
    return result;
  } catch (err) {
    // Expo Fetch liefert bei Abbruch nicht verlaesslich eine `AbortError`.
    if (signal?.aborted) return { products: [], hasMore: false, failed: false };
    console.error('Fehler bei Open Food Facts Suche:', err);
    return { products: [], hasMore: false, failed: true };
  }
}

export function productToRouteParams(product: OpenFoodFactsProduct): Record<string, string> {
  const params: Record<string, string> = { name: product.name };
  if (product.brand) params.brand = product.brand;
  if (product.imageUrl) params.imageUrl = product.imageUrl;
  if (product.caloriesPer100g !== undefined) params.kcalPer100g = String(product.caloriesPer100g);
  if (product.proteinsPer100g !== undefined) {
    params.proteinPer100g = String(product.proteinsPer100g);
  }
  if (product.carbsPer100g !== undefined) params.carbsPer100g = String(product.carbsPer100g);
  if (product.fatPer100g !== undefined) params.fatPer100g = String(product.fatPer100g);
  if (product.sugarsPer100g !== undefined) params.sugarPer100g = String(product.sugarsPer100g);
  if (product.saturatedFatPer100g !== undefined) {
    params.satFatPer100g = String(product.saturatedFatPer100g);
  }
  if (product.saltPer100g !== undefined) params.saltPer100g = String(product.saltPer100g);
  if (product.nutriScore) params.nutriScore = product.nutriScore;
  if (product.novaGroup !== undefined) params.novaGroup = String(product.novaGroup);
  if (product.nutrientLevels) params.nutrientLevels = JSON.stringify(product.nutrientLevels);
  // Aeltere Test-Doubles koennen `categoryTags` noch auslassen.
  if ((product.categoryTags ?? []).length > 0) {
    params.categoryTags = JSON.stringify(product.categoryTags);
  }
  if (product.offLastModifiedAt) params.offLastModifiedAt = product.offLastModifiedAt;
  return params;
}

function firstString(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function firstNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstString(value);
  if (raw === undefined) return undefined;
  const num = parseFloat(raw);
  return Number.isNaN(num) ? undefined : num;
}

export function productFromRouteParams(
  params: Record<string, string | string[] | undefined>,
): Partial<OpenFoodFactsProduct> | null {
  const name = firstString(params.name);
  if (!name) return null;

  const nutrientLevelsRaw = firstString(params.nutrientLevels);
  const categoryTagsRaw = firstString(params.categoryTags);

  return {
    name,
    brand: firstString(params.brand),
    imageUrl: firstString(params.imageUrl),
    caloriesPer100g: firstNumber(params.kcalPer100g),
    proteinsPer100g: firstNumber(params.proteinPer100g),
    carbsPer100g: firstNumber(params.carbsPer100g),
    fatPer100g: firstNumber(params.fatPer100g),
    sugarsPer100g: firstNumber(params.sugarPer100g),
    saturatedFatPer100g: firstNumber(params.satFatPer100g),
    saltPer100g: firstNumber(params.saltPer100g),
    nutriScore: firstString(params.nutriScore) as OpenFoodFactsProduct['nutriScore'],
    novaGroup: firstNumber(params.novaGroup) as OpenFoodFactsProduct['novaGroup'],
    nutrientLevels: nutrientLevelsRaw ? JSON.parse(nutrientLevelsRaw) : undefined,
    categoryTags: categoryTagsRaw ? JSON.parse(categoryTagsRaw) : [],
    offLastModifiedAt: firstString(params.offLastModifiedAt),
  };
}

export async function fetchProductByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsProduct | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;
  if (env.offFactsOffline) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      trimmed,
    )}.json?lc=de&cc=de`;

    const res = await fetchProductWithRetry(url, signal);

    if (!res?.ok) return null;
    const data = await res.json();

    if (data.status !== 1 || !data.product) return null;
    return formatOFFProduct(data.product);
  } catch (err) {
    if (signal?.aborted) return null;
    console.error('Fehler bei Open Food Facts Barcode-Abfrage:', err);
    return null;
  }
}
