import { useQuery } from '@tanstack/react-query';

import type { MealType } from '@/features/calorie-tracking/api';
import type { FoodHistoryEntry } from '@/features/calorie-tracking/food-history';
import { getDatabase } from '@/lib/db/client';
import { getFrequentProductUsage } from '@/lib/db/product-usage';

/**
 * Ersetzt das ehemalige `useFoodHistory` (Supabase, `food_entries`) fuer die
 * "Zuletzt"/"Haeufig"-Umschaltung im Tagebuch (#79): liest aus der lokalen
 * `product_usage`-Tabelle statt online, funktioniert also ohne Netz, und
 * schraenkt — anders als vorher — auf die aktuelle Mahlzeitart ein (#79 AC
 * "Auf die Mahlzeitart eingeschraenkt"). `dedupeRecentFoods`/`rankFrequentFoods`
 * aus `food-history.ts` bleiben unveraendert, da die Zeilenform identisch ist.
 *
 * `product_usage` ist bewusst append-only und ohne Fremdschluessel auf
 * `food_entries` (siehe Kopf von `product-usage.ts`) — ein per
 * `useDeleteFoodEntryMutation` (Supabase-only, `calorie-tracking/api.ts`)
 * geloeschter Tagebucheintrag verschwindet deshalb nicht aus "Zuletzt"/
 * "Haeufig", bis er von selbst aus dem Zeitfenster faellt. Bewusster
 * Kompromiss statt eines Fremdschluessels, der die reine Supabase-Schicht
 * in `api.ts` an die lokale SQLite-Schicht koppeln wuerde.
 */
export function useLocalFoodUsage(userId: string | undefined, mealType: MealType | undefined) {
  return useQuery({
    queryKey: ['product_usage', 'frequent', 'diary', userId, mealType],
    queryFn: async (): Promise<FoodHistoryEntry[]> => {
      const db = await getDatabase();
      const rows = await getFrequentProductUsage(db, {
        userId: userId as string,
        feature: 'diary',
        mealType,
      });
      return rows.map((row) => ({
        name: row.name,
        kcal: row.kcal,
        proteinG: row.protein_g,
        carbsG: row.carbs_g,
        fatG: row.fat_g,
        quantity: row.quantity ?? 1,
        unit: row.unit ?? 'piece',
      }));
    },
    enabled: !!userId,
  });
}
