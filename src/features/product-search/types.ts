export type NutrientLevel = 'low' | 'moderate' | 'high';

/**
 * Quellneutrale Produktdarstellung fuer Suche und Barcode-Scan. Kann aus dem
 * eigenen Produktspiegel, dem lokalen OFF-Dump oder der OFF-API stammen — die
 * Quelle ist fuer Konsumenten bewusst nicht erkennbar. Keine Identitaet mit
 * `Product` (dem Katalogeintrag in der Datenbank), siehe CONTEXT.md.
 */
export type CatalogProduct = {
  /** Lokale Produktidentitaet, sofern der Treffer aus dem eigenen Katalog/Verlauf stammt. */
  productId?: string;
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
  categoryTags: string[];
  /** ISO-Zeitstempel aus OFFs `last_modified_t` (Unix-Sekunden), sofern gueltig. */
  offLastModifiedAt?: string;
};

export type ProductSearchResult = {
  products: CatalogProduct[];
  /** true, wenn eine weitere Seite ueber `nextCursor` noch Treffer haben kann. */
  hasMore: boolean;
  /** true, wenn die Online-Quelle fehlgeschlagen ist. Unterdrueckt keine lokalen Treffer. */
  failed: boolean;
};

export type CatalogSourceSearchOptions = {
  offset: number;
  limit: number;
  signal?: AbortSignal;
};

/**
 * Einheitliche Schnittstelle aller Produktquellen (lokaler Spiegel, OFF-Dump,
 * OFF-API). Eine Quelle wirft nie: ein nicht verfuegbares Backend ist ein
 * leeres Ergebnis, ggf. mit `failed: true`.
 */
export type CatalogSource = {
  search(query: string, options: CatalogSourceSearchOptions): Promise<ProductSearchResult>;
  findByBarcode(barcode: string, signal?: AbortSignal): Promise<CatalogProduct | null>;
};
