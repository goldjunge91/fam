import {
  parseCategoryTagsJson,
  parseQuantityAndUnit,
  toSearchTokens,
} from '@/features/product-search/product-parsing';
import type { CatalogProduct, CatalogSource } from '@/features/product-search/types';
import { getDatabase } from '@/lib/db/client';
import { debugLogEvent } from '@/lib/debug-log';

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

const COLUMNS =
  'code, product_name, brand, quantity, nutriscore, energy_kcal, fat, saturated_fat, carbohydrates, sugars, proteins, salt, categories_tags, off_last_modified_at, image_url';

export function toCatalogProductFromDumpRow(row: OffDumpProductRow): CatalogProduct {
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
    nutriScore: (row.nutriscore || undefined) as CatalogProduct['nutriScore'],
    categoryTags: parseCategoryTagsJson(row.categories_tags),
    offLastModifiedAt: row.off_last_modified_at ?? undefined,
    imageUrl: row.image_url ?? undefined,
  };
}

/**
 * Der lokale Open-Food-Facts-Dump. Ein noch nicht angehaengter oder fehlender
 * Dump ist hier ein leeres Ergebnis plus Debug-Event, kein geworfener Fehler:
 * eine Suche kurz nach dem Login soll degradiert, nicht kaputt sein.
 */
export function createOffDumpProductSource(): CatalogSource {
  return {
    async search(query, { offset, limit }) {
      const tokens = toSearchTokens(query);
      if (tokens.length === 0) return { products: [], hasMore: false, failed: false };

      try {
        const db = await getDatabase();
        const conditions = tokens.flatMap(() => [
          'lower(product_name) like ?',
          'lower(brand) like ?',
        ]);
        const params = tokens.flatMap((token) => [`%${token}%`, `%${token}%`]);
        const rows = await db.getAllAsync<OffDumpProductRow>(
          `select ${COLUMNS}
           from off_dump.products
           where ${conditions.join(' or ')}
           order by product_name
           limit ? offset ?`,
          [...params, limit, offset],
        );
        return {
          products: rows.map(toCatalogProductFromDumpRow),
          hasMore: rows.length === limit,
          failed: false,
        };
      } catch {
        debugLogEvent('product-catalog.dump.unavailable', { operation: 'search' });
        return { products: [], hasMore: false, failed: false };
      }
    },

    async findByBarcode(barcode) {
      const trimmed = barcode.trim();
      if (!trimmed) return null;
      try {
        const db = await getDatabase();
        const row = await db.getFirstAsync<OffDumpProductRow>(
          `select ${COLUMNS}
           from off_dump.products
           where code = ?
           limit 1`,
          [trimmed],
        );
        return row ? toCatalogProductFromDumpRow(row) : null;
      } catch {
        debugLogEvent('product-catalog.dump.unavailable', { operation: 'findByBarcode' });
        return null;
      }
    },
  };
}
