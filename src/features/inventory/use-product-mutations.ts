import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';

import { getDatabase } from '@/lib/db/client';
import { enqueueMutation } from '@/lib/db/outbox';
import { applyLocalMirrorWrite } from '@/lib/sync/mirror-write';

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

/**
 * Legt eine Zeile in `products` an (#80/#74) — ueber die normale
 * Sync-Engine (`enqueueMutation`), nicht per direktem Supabase-Zugriff.
 * `products` ist global (kein `household_id`), RLS erlaubt den Insert nur
 * mit `created_by = auth.uid()`.
 */
export function useAddProductMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: NewProduct) => {
      const db = await getDatabase();
      const id = Crypto.randomUUID();
      const now = new Date().toISOString();
      const nowMs = Date.now();

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
        applyLocally: (txn) =>
          applyLocalMirrorWrite(txn, 'products', 'insert', { ...row, created_at: now }, nowMs),
      });

      return row;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
