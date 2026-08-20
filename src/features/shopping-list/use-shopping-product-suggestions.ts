import { useQuery } from '@tanstack/react-query';

import { getDatabase } from '@/lib/db/client';

export type ShoppingSuggestionMode = 'recent' | 'frequent';

/**
 * Vorrat fuer die aufklappbare Vorschlagsliste (#UI-Feedback: "Ansicht
 * erweitern, History soll aufklappbar sein") — `ShoppingProductSuggestions`
 * zeigt standardmaessig nur die ersten 3, der Rest kommt erst nach Aufklappen.
 */
export const SUGGESTION_QUERY_LIMIT = 9;

export type ShoppingProductSuggestion = {
  name: string;
  brand: string | null;
  barcode: string | null;
  product_id: string | null;
  unit: string | null;
  quantity: number | null;
  last_store_id: string | null;
  last_store_name: string | null;
};

/**
 * Liefert die drei letzten oder haeufigsten Einkaufsprodukte aus der lokalen
 * Nutzungshistorie. Der zuletzt verwendete Markt wird aus bestehenden und
 * bereits erledigten Einkaufslisten-Zeilen ergaenzt, ohne ein neues Schema.
 */
export function useShoppingProductSuggestions({
  userId,
  householdId,
  mode,
}: {
  userId: string | undefined;
  householdId: string;
  mode: ShoppingSuggestionMode;
}) {
  return useQuery({
    queryKey: ['product_usage', 'shopping-suggestions', mode, userId, householdId],
    queryFn: async (): Promise<ShoppingProductSuggestion[]> => {
      if (!userId) return [];

      const db = await getDatabase();
      const orderBy = mode === 'frequent' ? 'frequency desc, used_at desc' : 'used_at desc';

      return db.getAllAsync<ShoppingProductSuggestion>(
        `with ranked as (
           select pu.*,
                  row_number() over (partition by lower(pu.name) order by pu.used_at desc) as rank,
                  count(*) over (partition by lower(pu.name)) as frequency
           from product_usage pu
           where pu.user_id = ?
             and pu.feature = 'shopping_list'
             and (pu.household_id = ? or pu.household_id is null)
         )
         select ranked.name,
                ranked.brand,
                ranked.barcode,
                ranked.product_id,
                ranked.unit,
                ranked.quantity,
                (
                  select item.store_id
                  from shopping_list_items item
                  join stores store on store.id = item.store_id
                  where item.household_id = ?
                    and lower(item.name) = lower(ranked.name)
                    and store.deleted_at is null
                  order by item.updated_at desc
                  limit 1
                ) as last_store_id,
                (
                  select store.name
                  from shopping_list_items item
                  join stores store on store.id = item.store_id
                  where item.household_id = ?
                    and lower(item.name) = lower(ranked.name)
                    and store.deleted_at is null
                  order by item.updated_at desc
                  limit 1
                ) as last_store_name
         from ranked
         where rank = 1
         order by ${orderBy}
         limit ${SUGGESTION_QUERY_LIMIT}`,
        [userId, householdId, householdId, householdId],
      );
    },
    enabled: !!userId,
  });
}
