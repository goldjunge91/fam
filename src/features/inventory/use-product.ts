import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

export type LocalProduct = {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal_per_100: number | null;
  protein_g_per_100: number | null;
  carbs_g_per_100: number | null;
  fat_g_per_100: number | null;
  fiber_g_per_100: number | null;
  sugar_g_per_100: number | null;
  salt_g_per_100: number | null;
  serving_size_g: number | null;
  source: string;
};

/**
 * Laedt das mit einem Vorrats-Artikel verknuepfte Produkt (Naehrwerte) aus
 * SQLite. `productId` kann fehlen (manuell angelegte Artikel ohne
 * Produktbezug) — dann bleibt die Query deaktiviert.
 */
export function useProduct(productId: string | null | undefined) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async (): Promise<LocalProduct | null> => {
      const db = await getDatabase();
      return db.getFirstAsync<LocalProduct>('select * from products where id = ?', [
        productId ?? null,
      ]);
    },
    enabled: !!productId,
  });
}
