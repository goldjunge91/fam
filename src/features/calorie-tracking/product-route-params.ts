import type { CatalogProduct } from '@/features/product-search/types';

/**
 * Route-Adapter zwischen Produktsuche und Erfassungsformular. Bewusst hier und
 * nicht im Produktdatenmodul: das Wire-Format der Parameter ist ein
 * Navigationsbelang des Kalorien-Trackings.
 */
export function productToRouteParams(product: CatalogProduct): Record<string, string> {
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
  // Ältere Produktwerte können ohne categoryTags eintreffen.
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

/** Kaputte Werte aus einem Deep-Link duerfen den Screen nicht abstuerzen lassen. */
function parseJsonOrUndefined<T>(raw: string | undefined): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function isRouteParamsRecord(
  value: unknown,
): value is Record<string, string | string[] | undefined> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Kehrt `productToRouteParams` um — liest ein Produkt aus `useLocalSearchParams()`. */
export function productFromRouteParams(
  params: Record<string, string | string[] | undefined>,
): Partial<CatalogProduct> | null {
  // Produktsuche und Erfassungsformular sind zwei aufeinanderfolgende
  // Modals. Der Suchscreen kapselt Produktdaten deshalb in einem Parameter,
  // damit kein einzelner Nährwert-Parameter beim Modalwechsel verloren geht.
  // Die einzelnen Parameter bleiben als Fallback fuer alte/deep-linked
  // Aufrufe kompatibel.
  const productDataRaw = firstString(params.productData);
  let sourceParams = params;
  if (productDataRaw) {
    try {
      const parsed = JSON.parse(productDataRaw) as unknown;
      if (isRouteParamsRecord(parsed)) sourceParams = parsed;
    } catch {
      // Ungueltige Payloads fallen auf die alten flachen Route-Params zurueck.
    }
  }

  const name = firstString(sourceParams.name);
  if (!name) return null;

  const nutrientLevelsRaw = firstString(sourceParams.nutrientLevels);
  const categoryTagsRaw = firstString(sourceParams.categoryTags);

  return {
    name,
    brand: firstString(sourceParams.brand),
    imageUrl: firstString(sourceParams.imageUrl),
    caloriesPer100g: firstNumber(sourceParams.kcalPer100g),
    proteinsPer100g: firstNumber(sourceParams.proteinPer100g),
    carbsPer100g: firstNumber(sourceParams.carbsPer100g),
    fatPer100g: firstNumber(sourceParams.fatPer100g),
    sugarsPer100g: firstNumber(sourceParams.sugarPer100g),
    saturatedFatPer100g: firstNumber(sourceParams.satFatPer100g),
    saltPer100g: firstNumber(sourceParams.saltPer100g),
    nutriScore: firstString(sourceParams.nutriScore) as CatalogProduct['nutriScore'],
    novaGroup: firstNumber(sourceParams.novaGroup) as CatalogProduct['novaGroup'],
    nutrientLevels: parseJsonOrUndefined<CatalogProduct['nutrientLevels']>(nutrientLevelsRaw),
    categoryTags: parseJsonOrUndefined<string[]>(categoryTagsRaw) ?? [],
    offLastModifiedAt: firstString(sourceParams.offLastModifiedAt),
  };
}
