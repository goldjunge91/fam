import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import { type FridgeItemConflict, getFridgeItemConflicts } from '@/lib/db/outbox-conflicts';

const inventoryConflictsQueryKey = ['inventory-conflicts'] as const;

/**
 * Artikel mit dauerhaft gescheiterter Mengenoperation (Korrektur/Verbrauch/
 * Umbuchung), als Map keyed by `item_id` fuer schnelles Nachschlagen pro
 * MHD-Los in `inventory-item-group-sheet.tsx`. Die Outbox ist geraetelokal,
 * nicht an einen Haushalt gebunden — Filterung passiert implizit dadurch,
 * dass nur Artikel des aktuell sichtbaren Haushalts als Gruppen gerendert
 * werden.
 */
export function useInventoryConflicts() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribe = onOutboxChanged(() => {
      queryClient.invalidateQueries({ queryKey: inventoryConflictsQueryKey });
    });
    return unsubscribe;
  }, [queryClient]);

  const { data = [] } = useQuery({
    queryKey: inventoryConflictsQueryKey,
    queryFn: async () => getFridgeItemConflicts(await getDatabase()),
    refetchInterval: 20_000,
  });

  return new Map<string, FridgeItemConflict>(data.map((conflict) => [conflict.itemId, conflict]));
}
