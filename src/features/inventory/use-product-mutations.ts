import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';

export type NewProduct = {
  barcode?: string | null;
  name: string;
  brand?: string | null;
  kcal_per_100?: number | null;
  protein_g_per_100?: number | null;
  carbs_g_per_100?: number | null;
  fat_g_per_100?: number | null;
  fiber_g_per_100?: number | null;
  sugar_g_per_100?: number | null;
  salt_g_per_100?: number | null;
  serving_size_g?: number | null;
  source: 'off' | 'manual';
  created_by: string;
};

/** Legt ein globales Produkt mit `created_by` ueber die Sync-Engine an. */
export function useAddProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: NewProduct) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();

      const row = {
        id,
        barcode: product.barcode ?? null,
        name: product.name,
        brand: product.brand ?? null,
        kcal_per_100: product.kcal_per_100 ?? null,
        protein_g_per_100: product.protein_g_per_100 ?? null,
        carbs_g_per_100: product.carbs_g_per_100 ?? null,
        fat_g_per_100: product.fat_g_per_100 ?? null,
        fiber_g_per_100: product.fiber_g_per_100 ?? null,
        sugar_g_per_100: product.sugar_g_per_100 ?? null,
        salt_g_per_100: product.salt_g_per_100 ?? null,
        serving_size_g: product.serving_size_g ?? null,
        source: product.source,
        created_by: product.created_by,
      };

      await enqueueMutation(db, {
        entity: 'products',
        entityId: id,
        op: 'insert',
        payload: { ...row, created_at: now, updated_at: now },
        applyLocally: async (txn) => {
          await txn.runAsync(
            `insert into products (
              id, barcode, name, brand,
              kcal_per_100, protein_g_per_100, carbs_g_per_100, fat_g_per_100,
              fiber_g_per_100, sugar_g_per_100, salt_g_per_100, serving_size_g,
              source, created_by, created_at, updated_at
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              row.id,
              row.barcode,
              row.name,
              row.brand,
              row.kcal_per_100,
              row.protein_g_per_100,
              row.carbs_g_per_100,
              row.fat_g_per_100,
              row.fiber_g_per_100,
              row.sugar_g_per_100,
              row.salt_g_per_100,
              row.serving_size_g,
              row.source,
              row.created_by,
              now,
              now,
            ],
          );
        },
      });

      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
