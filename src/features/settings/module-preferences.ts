import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

export type ModulePreferences = {
  fridge: boolean;
  shoppingList: boolean;
  calories: boolean;
  recipes: boolean;
  mealPlanner: boolean;
};

export const DEFAULT_MODULE_PREFERENCES: ModulePreferences = {
  fridge: true,
  shoppingList: true,
  calories: true,
  recipes: true,
  mealPlanner: true,
};

export function modulePreferencesQueryKey(userId: string | undefined) {
  return ['settings', 'module-preferences', userId] as const;
}

export function useModulePreferences(userId: string | undefined) {
  return useQuery({
    queryKey: modulePreferencesQueryKey(userId),
    queryFn: async (): Promise<ModulePreferences> => {
      if (!userId) {
        return DEFAULT_MODULE_PREFERENCES;
      }

      const { data, error } = await getSupabase()
        .from('profiles')
        .select(
          'module_fridge, module_shopping_list, module_calories, module_recipes, module_meal_planner',
        )
        .eq('id', userId)
        .maybeSingle();

      if (error || !data) {
        return DEFAULT_MODULE_PREFERENCES;
      }

      return {
        fridge: data.module_fridge ?? true,
        shoppingList: data.module_shopping_list ?? true,
        calories: data.module_calories ?? true,
        recipes: data.module_recipes ?? true,
        mealPlanner: data.module_meal_planner ?? true,
      };
    },
  });
}

export function useUpdateModulePreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      modules,
    }: {
      userId: string;
      modules: Partial<ModulePreferences>;
    }) => {
      const updates: Database['public']['Tables']['profiles']['Update'] = {};
      if (modules.fridge !== undefined) updates.module_fridge = modules.fridge;
      if (modules.shoppingList !== undefined) updates.module_shopping_list = modules.shoppingList;
      if (modules.calories !== undefined) updates.module_calories = modules.calories;
      if (modules.recipes !== undefined) updates.module_recipes = modules.recipes;
      if (modules.mealPlanner !== undefined) updates.module_meal_planner = modules.mealPlanner;

      const { error } = await getSupabase().from('profiles').update(updates).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    onMutate: async ({ userId, modules }) => {
      const queryKey = modulePreferencesQueryKey(userId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ModulePreferences>(queryKey);

      queryClient.setQueryData<ModulePreferences>(queryKey, (old) => ({
        ...(old ?? DEFAULT_MODULE_PREFERENCES),
        ...modules,
      }));

      return { previous, queryKey };
    },
    onError: (_err, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: modulePreferencesQueryKey(variables.userId) });
    },
  });
}

export async function saveModulePreferences(userId: string, modules: ModulePreferences) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      module_fridge: modules.fridge,
      module_shopping_list: modules.shoppingList,
      module_calories: modules.calories,
      module_recipes: modules.recipes,
      module_meal_planner: modules.mealPlanner,
    })
    .eq('id', userId);

  return { error };
}
