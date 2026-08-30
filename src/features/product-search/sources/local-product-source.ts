import { parseCategoryTagsJson, toSearchTokens } from '@/features/product-search/product-parsing';
import type { CatalogProduct, CatalogSource } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/client';

/** Spalten aus der lokalen `products`-Tabelle, die ein CatalogProduct fuellen. */
type LocalProductRow = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
  /** JSON-serialisiertes `text[]` (#223), siehe `off_category_tags` in `migrations.ts`. */
  off_category_tags?: string | null;
  off_last_modified_at?: string | null;
};

const COLUMNS =
  'id, barcode, name, brand, kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100, off_category_tags, off_last_modified_at';

export function toCatalogProductFromLocalRow(row: LocalProductRow): CatalogProduct {
  return {
    productId: row.id,
    barcode: row.barcode ?? '',
    name: row.name,
    brand: row.brand ?? undefined,
    caloriesPer100g: row.kcal_per_100 ?? undefined,
    proteinsPer100g: row.protein_g_per_100 ?? undefined,
    carbsPer100g: row.carbs_g_per_100 ?? undefined,
    fatPer100g: row.fat_g_per_100 ?? undefined,
    categoryTags: parseCategoryTagsJson(row.off_category_tags),
    offLastModifiedAt: row.off_last_modified_at ?? undefined,
  };
}

/**
 * Der eigene Produktspiegel: hoechste Prioritaet im Katalog, damit selbst
 * gepflegte Naehrwerte nie von OFF-Daten verdraengt werden.
 */
export function createLocalProductSource(): CatalogSource {
  return {
    async search(query, { offset, limit }) {
      const tokens = toSearchTokens(query);
      if (tokens.length === 0) return { products: [], hasMore: false, failed: false };

      try {
        const db = await getDatabase();
        const conditions = tokens.flatMap(() => ['lower(name) like ?', 'lower(brand) like ?']);
        const params = tokens.flatMap((token) => [`%${token}%`, `%${token}%`]);
        const rows = await db.getAllAsync<LocalProductRow>(
          `select ${COLUMNS}
           from products
           where deleted_at is null and (${conditions.join(' or ')})
           order by name
           limit ? offset ?`,
          [...params, limit, offset],
        );
        return {
          products: rows.map(toCatalogProductFromLocalRow),
          hasMore: rows.length === limit,
          failed: false,
        };
      } catch {
        return { products: [], hasMore: false, failed: false };
      }
    },

    async findByBarcode(barcode) {
      const trimmed = barcode.trim();
      if (!trimmed) return null;
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<LocalProductRow>(
          `select ${COLUMNS}
           from products
           where deleted_at is null and barcode = ?
           limit 1`,
          [trimmed],
        );
        return row ? toCatalogProductFromLocalRow(row) : null;
      } catch {
        return null;
      }
    },
  };
}
