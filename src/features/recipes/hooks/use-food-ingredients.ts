import { useQuery } from '@tanstack/react-query';
import { getSupabase } from '@/lib/backend/supabase/remote-client';
import { getDeviceStorage } from '@/lib/storage/local-device-storage';

const CACHE_KEY = 'recipe-ingredient-basis.v1';

export type CanonicalFoodIngredient = {
  id: string;
  canonical_name: string;
  revision: number;
};

function isCanonicalFoodIngredient(value: unknown): value is CanonicalFoodIngredient {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.canonical_name === 'string' &&
    Number.isInteger(record.revision) &&
    Number(record.revision) > 0
  );
}

function readCachedIngredients(): CanonicalFoodIngredient[] {
  try {
    const cached = getDeviceStorage().getString(CACHE_KEY);
    if (!cached) return [];
    const parsed: unknown = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed.filter(isCanonicalFoodIngredient) : [];
  } catch {
    return [];
  }
}

export function useFoodIngredients() {
  return useQuery({
    queryKey: ['ingredient-knowledge', 'canonical-food-ingredients'],
    queryFn: async () => {
      const cached = readCachedIngredients();
      try {
        const { data, error } = await getSupabase()
          .from('food_ingredients')
          .select('id, canonical_name, revision')
          .order('canonical_name');
        if (error) throw error;
        const ingredients = data.filter(isCanonicalFoodIngredient);
        try {
          getDeviceStorage().set(CACHE_KEY, JSON.stringify(ingredients));
        } catch {
          // The public catalog still works when device caching is unavailable.
        }
        return ingredients;
      } catch (error) {
        if (cached.length > 0) return cached;
        throw error;
      }
    },
    staleTime: 6 * 60 * 60 * 1_000,
    retry: false,
    networkMode: 'offlineFirst',
  });
}
