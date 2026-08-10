export type NutrientLevel = 'low' | 'moderate' | 'high';

export type OpenFoodFactsProduct = {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
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
  /** NOVA-Verarbeitungsgrad 1 (unverarbeitet) bis 4 (stark verarbeitet). */
  novaGroup?: 1 | 2 | 3 | 4;
  nutrientLevels?: {
    fat?: NutrientLevel;
    saturatedFat?: NutrientLevel;
    sugars?: NutrientLevel;
    salt?: NutrientLevel;
  };
};

/**
 * Erkennt, ob eine Eingabe eher ein abgetippter Barcode als ein Produktname
 * ist (EAN-8 bis GTIN-14: 6-14 Ziffern, nichts anderes). Die normale Suche
 * nutzt das, um bei so einer Eingabe den exakten Barcode-Lookup statt der
 * unscharfen Namenssuche zu verwenden — eigene manuelle Eingabe im
 * Scanner-Modal braucht es dafuer nicht, das Suchfeld deckt es ab.
 */
export function isLikelyBarcode(value: string): boolean {
  return /^\d{6,14}$/.test(value.trim());
}

/**
 * Normalisiert rohe Mengenstrings wie "500 g", "1.5 L", "1 kg" in Menge und Einheit.
 */
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

/**
 * Formatiert rohe Open Food Facts Produkt-Objekte in ein sauberes Schema.
 */
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

  return {
    barcode: raw.code || raw._id || '',
    name: name.trim(),
    brand: raw.brands ? raw.brands.split(',')[0].trim() : undefined,
    category: raw.categories ? raw.categories.split(',')[0].trim() : undefined,
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
    novaGroup: raw.nova_group || undefined,
    nutrientLevels: hasNutrientLevels ? nutrientLevels : undefined,
  };
}

/**
 * Nur die Felder, die `formatOFFProduct` tatsaechlich liest. Ohne diesen
 * Filter liefert die Suche das volle Produktobjekt je Treffer (Zutatenliste,
 * Verpackungsangaben, Bilder in allen Aufloesungen, Sprachvarianten, ...) —
 * das macht die Anfrage auf Mobilfunk spuerbar langsam, obwohl davon nichts
 * angezeigt wird.
 */
const SEARCH_FIELDS = [
  'code',
  'product_name',
  'product_name_de',
  'generic_name',
  'generic_name_de',
  'brands',
  'categories',
  'quantity',
  'image_front_small_url',
  'image_front_url',
  'nutriments',
  'nutriscore_grade',
  'nova_group',
  'nutrient_levels',
].join(',');

export type OpenFoodFactsSearchResult = {
  products: OpenFoodFactsProduct[];
  /** true, wenn eine weitere Seite (`page + 1`) vermutlich noch Treffer hat. */
  hasMore: boolean;
  /**
   * true, wenn die Anfrage auch nach Retries fehlgeschlagen ist — bewusst
   * getrennt von "keine Treffer". Open Food Facts' Such-Endpunkte antworten
   * zur Zeit auffaellig oft (~50-80 % im Test, auch bei identischen Anfragen
   * kurz hintereinander) mit einem 503 "Page temporarily unavailable". Ohne
   * dieses Feld sieht ein Nutzer bei "hafer" oder "toma" faelschlich "keine
   * Treffer", obwohl der Dienst nur kurz nicht erreichbar war.
   */
  failed: boolean;
};

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Holt eine URL, mit kurzem Retry bei 5xx-Antworten (siehe `failed` oben fuer
 * den Hintergrund). Ein Abbruch (`signal`) wird nie erneut versucht — die
 * Anfrage ist bewusst obsolet, retryen wuerde nur Last erzeugen.
 */
async function fetchWithRetry(url: string, signal: AbortSignal | undefined): Promise<Response> {
  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
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
  throw lastError;
}

/** Session-Cache identischer Suchanfragen (Begriff+Seite) — v.a. beim Loeschen/erneuten Tippen relevant. */
const searchCache = new Map<string, OpenFoodFactsSearchResult>();
const SEARCH_CACHE_LIMIT = 100;

function cacheSearchResult(key: string, result: OpenFoodFactsSearchResult) {
  if (searchCache.size >= SEARCH_CACHE_LIMIT) {
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey !== undefined) searchCache.delete(oldestKey);
  }
  searchCache.set(key, result);
}

/**
 * Durchsucht Open Food Facts nach Produktnamen (DE/WW), seitenweise.
 *
 * Bewusst kein festes Gesamt-Limit: ein Begriff wie "Haferflocken" hat
 * hunderte Treffer bei Open Food Facts. Statt eine willkuerliche Teilmenge
 * abzuschneiden, liefert jeder Aufruf eine Seite (`pageSize`, Default 20) —
 * `sort_by=unique_scans_n` sortiert dabei die bekanntesten/meistgescannten
 * Produkte nach vorn, `hasMore` sagt dem Aufrufer, ob Nachladen (naechste
 * Seite) sich lohnt. So laedt die UI beim Scrollen nach, statt entweder
 * alles auf einmal oder nur eine zufaellige Kappung zu zeigen.
 *
 * `signal` erlaubt es Aufrufern, eine ueberholte Anfrage abzubrechen (z. B.
 * bei schnellem Weitertippen) statt auf eine Antwort zu warten, die eh
 * verworfen wird.
 */
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

  try {
    // `sort_by=unique_scans_n`: bekannteste/meistgescannte Treffer zuerst.
    // Ohne das liefert die Suche irgendeine Teilmenge der Treffer in
    // Datenbank-Reihenfolge — bei einem Begriff wie "Haferflocken" mit
    // hunderten Treffern faellt sonst zufaellig aus, was die erste Seite zeigt.
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(trimmed)}` +
      `&search_simple=1&action=process&json=1&page_size=${pageSize}&page=${page}` +
      `&sort_by=unique_scans_n&lc=de&cc=de&fields=${SEARCH_FIELDS}`;

    const res = await fetchWithRetry(url, signal);

    if (!res.ok) return { products: [], hasMore: false, failed: true };
    const data = await res.json();
    const rawProducts = data.products || [];

    const products = rawProducts
      .map(formatOFFProduct)
      .filter((p: OpenFoodFactsProduct | null): p is OpenFoodFactsProduct => p !== null);

    // Eine volle Seite bedeutet nicht zwingend, dass es mehr gibt, aber eine
    // unvollstaendige Seite bedeutet sicher das Gegenteil — konservativ genug,
    // ohne uns auf ein bestimmtes `count`-Feld der API zu verlassen.
    const result: OpenFoodFactsSearchResult = {
      products,
      hasMore: rawProducts.length === pageSize,
      failed: false,
    };
    cacheSearchResult(cacheKey, result);
    return result;
  } catch (err) {
    // Abgebrochene Anfragen (ueberholt durch die naechste Eingabe) sind
    // erwartetes Verhalten, kein Fehler — nicht in der Konsole aufschlagen.
    // Der Signal-Check ist die verlaessliche Quelle: Expos natives Fetch
    // wirft bei einem Abort keine standardkonforme `AbortError`-DOMException,
    // sondern einen generischen Error ("FetchRequestCanceledException") -
    // `err.name` verlaesslich zu pruefen geht hier nicht.
    if (signal?.aborted) return { products: [], hasMore: false, failed: false };
    console.error('Fehler bei Open Food Facts Suche:', err);
    return { products: [], hasMore: false, failed: true };
  }
}

/**
 * Kodiert ein Produkt als Expo-Router-Params (nur Strings erlaubt), damit die
 * Lebensmittelsuche es an die Detail-/Erfassungsseite weiterreichen kann,
 * ohne einen globalen Zwischenspeicher zu brauchen.
 */
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

/** Kehrt `productToRouteParams` um — liest ein Produkt aus `useLocalSearchParams()`. */
export function productFromRouteParams(
  params: Record<string, string | string[] | undefined>,
): Partial<OpenFoodFactsProduct> | null {
  const name = firstString(params.name);
  if (!name) return null;

  const nutrientLevelsRaw = firstString(params.nutrientLevels);

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
  };
}

/**
 * Ruft ein Produkt anhand seines Barcodes (EAN-8, EAN-13) ab.
 */
export async function fetchProductByBarcode(
  barcode: string,
  signal?: AbortSignal,
): Promise<OpenFoodFactsProduct | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      trimmed,
    )}.json?lc=de&cc=de`;

    const res = await fetchWithRetry(url, signal);

    if (!res.ok) return null;
    const data = await res.json();

    if (data.status !== 1 || !data.product) return null;
    return formatOFFProduct(data.product);
  } catch (err) {
    if (signal?.aborted) return null;
    console.error('Fehler bei Open Food Facts Barcode-Abfrage:', err);
    return null;
  }
}
