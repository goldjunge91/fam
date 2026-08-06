import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

export type LocalFridgeItem = {
  id: string;
  household_id: string;
  location_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit: string;
  expiry_date: string | null;
  added_by: string | null;
  created_at: string;
  // JOIN-Felder aus storage_locations
  location_kind: 'fridge' | 'freezer' | 'pantry' | null;
  location_name: string | null;
};

export type GroupedFridgeItems = {
  locationKind: 'fridge' | 'freezer' | 'pantry';
  locationName: string;
  items: LocalFridgeItem[];
};

const KIND_ORDER: Record<string, number> = { fridge: 0, freezer: 1, pantry: 2 };
const KIND_LABELS: Record<string, string> = {
  fridge: 'Kühlschrank',
  freezer: 'Tiefkühltruhe',
  pantry: 'Abstellkammer',
};

/**
 * Liest alle Vorrats-Artikel fuer den Haushalt aus SQLite, mit JOIN
 * auf `storage_locations` fuer Lagerort-Name und -Kind (#67).
 *
 * Sortierung: Ablaufdatum aufsteigend, NULL ans Ende — nutzt die
 * Bucket-Logik aus `expiry.ts` implizit (kritische Items stehen oben).
 */
export function useFridgeItems(householdId: string | undefined) {
  return useQuery({
    queryKey: ['fridge_items', householdId],
    queryFn: async (): Promise<GroupedFridgeItems[]> => {
      if (!householdId) return [];

      const db = await getDatabase();
      const items = await db.getAllAsync<LocalFridgeItem>(
        `select
           fi.id, fi.household_id, fi.location_id, fi.product_id,
           fi.name, fi.quantity, fi.unit, fi.expiry_date, fi.added_by, fi.created_at,
           sl.kind as location_kind,
           sl.name as location_name
         from fridge_items fi
         left join storage_locations sl on fi.location_id = sl.id
         where fi.household_id = ? and fi.deleted_at is null
         order by fi.expiry_date asc nulls last`,
        [householdId],
      );

      // Gruppierung nach location_kind — bekannte Reihenfolge (fridge → freezer → pantry)
      const groupMap = new Map<string, LocalFridgeItem[]>();
      for (const item of items) {
        const kind = item.location_kind ?? 'pantry';
        if (!groupMap.has(kind)) {
          groupMap.set(kind, []);
        }
        groupMap.get(kind)?.push(item);
      }

      // Sortierung der Gruppen nach KIND_ORDER
      return Array.from(groupMap.entries())
        .sort(([a], [b]) => (KIND_ORDER[a] ?? 99) - (KIND_ORDER[b] ?? 99))
        .map(([kind, groupItems]) => ({
          locationKind: kind as 'fridge' | 'freezer' | 'pantry',
          locationName: KIND_LABELS[kind] ?? kind,
          items: groupItems,
        }));
    },
    enabled: !!householdId,
  });
}

/**
 * Re-exports aus inventory/api.ts — der einzige Ort wo Mutations fuer
 * fridge_items definiert sind. Wir duplizieren keine Logik.
 *
 * useAddFridgeItemMutation     — insert via enqueueMutation
 * useUpdateFridgeItemQuantityMutation — update quantity (0 = soft-delete)
 * useDeleteStorageLocationMutation   — falls benoetigt
 */
export {
  useAddFridgeItemMutation,
  useUpdateFridgeItemQuantityMutation,
} from '@/features/inventory/api';
