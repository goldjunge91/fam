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
};

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
  };
}

/**
 * Durchsucht Open Food Facts nach Produktnamen (DE/WW).
 */
export async function searchOpenFoodFacts(
  query: string,
  limit = 8,
): Promise<OpenFoodFactsProduct[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      trimmed,
    )}&search_simple=1&action=process&json=1&page_size=${limit}&lc=de&cc=de`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
    });

    if (!res.ok) return [];
    const data = await res.json();
    const products = data.products || [];

    return products
      .map(formatOFFProduct)
      .filter((p: OpenFoodFactsProduct | null): p is OpenFoodFactsProduct => p !== null);
  } catch (err) {
    console.error('Fehler bei Open Food Facts Suche:', err);
    return [];
  }
}

/**
 * Ruft ein Produkt anhand seines Barcodes (EAN-8, EAN-13) ab.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const trimmed = barcode.trim();
  if (!trimmed) return null;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      trimmed,
    )}.json?lc=de&cc=de`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'FamApp/1.0 (contact@fam.app)' },
    });

    if (!res.ok) return null;
    const data = await res.json();

    if (data.status !== 1 || !data.product) return null;
    return formatOFFProduct(data.product);
  } catch (err) {
    console.error('Fehler bei Open Food Facts Barcode-Abfrage:', err);
    return null;
  }
}
