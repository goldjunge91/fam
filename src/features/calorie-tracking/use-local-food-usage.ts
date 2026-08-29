import { useQuery } from '@tanstack/react-query';

import type { MealType } from '@/features/calorie-tracking/api';
import type { FoodHistoryEntry } from '@/features/calorie-tracking/food-history';
import { getDatabase } from '@/lib/db/client';
import { getFrequentProductUsage } from '@/lib/db/product-usage';

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
    refetchOnMount: 'always',
  });
}
