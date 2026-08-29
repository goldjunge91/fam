import { parseQuantityAndUnit } from '@/features/product-search/product-parsing';
import type {
  CatalogProduct,
  CatalogSource,
  ProductSearchResult,
} from '@/features/product-search/types';
import { debugLogEvent } from '@/lib/debug-log';
import { env } from '@/lib/env';

/**
 * Formatiert rohe Open-Food-Facts-Produkt-Objekte in das quellneutrale
 * Katalogmodell.
 */
// biome-ignore lint/suspicious/noExplicitAny: External Open Food Facts API payload
export function formatOFFProduct(raw: any): CatalogProduct | null {
  if (!raw) return null;

  const name =
    raw.product_name_de || raw.product_name || raw.generic_name_de || raw.generic_name || '';

  if (!name.trim()) return null;

  const { quantity, unit } = parseQuantityAndUnit(raw.quantity);
  const nutriments = raw.nutriments || {};
  const rawLevels = raw.nutrient_levels || {};

  const nutrientLevels: CatalogProduct['nutrientLevels'] = {
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

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

// Sicherheitsabstand zu den dokumentierten 10/min bzw. 15/min.
const searchRateLimiter = new SlidingWindowRateLimiter(8, 60_000);
const productRateLimiter = new SlidingWindowRateLimiter(12, 60_000);

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
      debugLogEvent('open-food-facts.barcode.request', {
        attempt: attempt + 1,
        maxAttempts: MAX_RETRIES + 1,
      });
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
        signal,
      });
      debugLogEvent('open-food-facts.barcode.response', {
        attempt: attempt + 1,
        status: res.status,
        ok: res.ok,
      });
      if (!res.ok) {
        // Response-Body lesen, damit die Verbindung wiederverwendet werden kann.
        await res.text().catch(() => {});
      }
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

/** Session-Cache identischer Suchanfragen (Begriff+Seite) — v.a. beim Loeschen/erneuten Tippen relevant. */
const searchCache = new Map<string, ProductSearchResult>();
const SEARCH_CACHE_LIMIT = 100;

function cacheSearchResult(key: string, result: ProductSearchResult) {
  if (searchCache.size >= SEARCH_CACHE_LIMIT) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, result);
}

const EMPTY: ProductSearchResult = { products: [], hasMore: false, failed: false };

/**
 * Die Open-Food-Facts-HTTP-Ebene: Rate-Limit, Retry, Session-Cache und
 * Payload-Mapping. Wird vom Katalog nur befragt, wenn lokal zu wenig gefunden
 * wurde und ein Netz da ist.
 *
 * Paginiert wird ueber `offset`, obwohl OFF selbst Seiten kennt — die
 * Umrechnung bleibt hier, damit alle Quellen dieselbe Schnittstelle haben.
 */
export function createOffApiSource(): CatalogSource {
  return {
    async search(query, { offset, limit, signal }) {
      const trimmed = query.trim();
      if (trimmed.length < 2) return EMPTY;

      const page = Math.floor(offset / limit) + 1;
      const cacheKey = `${trimmed.toLowerCase()}|${limit}|${page}`;
      const cached = searchCache.get(cacheKey);
      if (cached) return cached;

      if (env.offFactsOffline) {
        debugLogEvent('open-food-facts.search.skipped', { reason: 'offline-mode' });
        return { products: [], hasMore: false, failed: true };
      }

      if (searchRateLimiter.isLimited()) {
        debugLogEvent('open-food-facts.search.skipped', { reason: 'rate-limit' });
        return { products: [], hasMore: false, failed: true };
      }

      try {
        // Bekannte Treffer zuerst sortieren.
        const url =
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
          `&search_simple=1&action=process&json=1&page_size=${limit}&page=${page}` +
          `&sort_by=unique_scans_n&lc=de&cc=de&fields=${SEARCH_FIELDS}`;

        searchRateLimiter.record();
        const startedAt = Date.now();
        debugLogEvent('open-food-facts.search.request', { page, pageSize: limit });
        const res = await fetch(url, {
          headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
          signal,
        });

        if (!res.ok) {
          debugLogEvent('open-food-facts.search.failed', {
            status: res.status,
            durationMs: Date.now() - startedAt,
          });
          return { products: [], hasMore: false, failed: true };
        }
        const data = await res.json();
        const rawProducts = data.products || [];

        const products = rawProducts
          .map(formatOFFProduct)
          .filter((p: CatalogProduct | null): p is CatalogProduct => p !== null);

        // Nur eine volle Seite kann weitere Treffer anzeigen.
        const result: ProductSearchResult = {
          products,
          hasMore: rawProducts.length === limit,
          failed: false,
        };
        cacheSearchResult(cacheKey, result);
        debugLogEvent('open-food-facts.search.succeeded', {
          resultCount: products.length,
          hasMore: result.hasMore,
          durationMs: Date.now() - startedAt,
        });
        return result;
      } catch (err) {
        // Abgebrochene, durch neue Eingaben ueberholte Anfragen ignorieren.
        if (signal?.aborted) return EMPTY;
        debugLogEvent('open-food-facts.search.failed', { reason: 'network-or-parse-error' });
        console.error('Fehler bei Open Food Facts Suche:', err);
        return { products: [], hasMore: false, failed: true };
      }
    },

    async findByBarcode(barcode, signal) {
      const trimmed = barcode.trim();
      if (!trimmed) return null;
      if (env.offFactsOffline) return null;

      try {
        const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
          trimmed,
        )}.json?lc=de&cc=de`;

        const res = await fetchProductWithRetry(url, signal);

        if (!res?.ok) {
          debugLogEvent('open-food-facts.barcode.failed', { reason: 'http-error' });
          return null;
        }
        const data = await res.json();

        if (data.status !== 1 || !data.product) {
          debugLogEvent('open-food-facts.barcode.completed', { found: false });
          return null;
        }
        const product = formatOFFProduct(data.product);
        debugLogEvent('open-food-facts.barcode.completed', { found: product !== null });
        return product;
      } catch (err) {
        if (signal?.aborted) return null;
        debugLogEvent('open-food-facts.barcode.failed', { reason: 'network-or-parse-error' });
        console.error('Fehler bei Open Food Facts Barcode-Abfrage:', err);
        return null;
      }
    },
  };
}

/**
 * Gemeinsame Instanz der Online-Ebene. Nur fuer Konsumenten, die bewusst
 * online anreichern wollen (Produktdetail-Modal) — die Produktsuche selbst
 * geht immer ueber den Product Catalog.
 */
export const offApiSource = createOffApiSource();
