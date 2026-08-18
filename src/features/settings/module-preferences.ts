import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Database } from '@/lib/database.types';
import { getSupabase } from '@/lib/supabase';

/**
 * Modul-Aktivierung (#95). Dashboard und Einstellungen sind laut
 * `docs/VISION.md` bewusst nicht abwaehlbar und haben deshalb keinen Eintrag
 * hier — nur die fuenf Tabs, die `ModuleGate` tatsaechlich ausblenden kann.
 */
export type ModulePreferences = {
  fridge: boolean;
  shoppingList: boolean;
  calories: boolean;
  recipes: boolean;
  mealPlanner: boolean;
  glp1?: boolean;
  fasting?: boolean;
  workouts?: boolean;
  keto?: boolean;
  cgm?: boolean;
  volumetrics?: boolean;
};

export function modulePreferencesQueryKey(userId: string | undefined) {
  return ['settings', 'module-preferences', userId] as const;
}

export function useModulePreferences(userId: string | undefined) {
  return useQuery({
    queryKey: modulePreferencesQueryKey(userId),
    queryFn: async (): Promise<ModulePreferences> => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select(
          'module_fridge, module_shopping_list, module_calories, module_recipes, module_meal_planner, module_glp1, module_fasting, module_workouts, module_keto, module_cgm, module_volumetrics',
        )
        .eq('id', userId as string)
        .single();

      if (error) throw new Error(error.message);
      return {
        fridge: data.module_fridge,
        shoppingList: data.module_shopping_list,
        calories: data.module_calories,
        recipes: data.module_recipes,
        mealPlanner: data.module_meal_planner,
        glp1: data.module_glp1,
        fasting: data.module_fasting,
        workouts: data.module_workouts,
        keto: data.module_keto,
        cgm: data.module_cgm,
        volumetrics: data.module_volumetrics,
      };
    },
    enabled: !!userId,
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
      if (modules.glp1 !== undefined) updates.module_glp1 = modules.glp1;
      if (modules.fasting !== undefined) updates.module_fasting = modules.fasting;
      if (modules.workouts !== undefined) updates.module_workouts = modules.workouts;
      if (modules.keto !== undefined) updates.module_keto = modules.keto;
      if (modules.cgm !== undefined) updates.module_cgm = modules.cgm;
      if (modules.volumetrics !== undefined) updates.module_volumetrics = modules.volumetrics;

      const { error } = await getSupabase().from('profiles').update(updates).eq('id', userId);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: modulePreferencesQueryKey(variables.userId) });
    },
  });
}

/**
 * Plain async statt Hook — fuer den Aufruf aus `completeOnboarding()`
 * (`onboarding-context.tsx`), das kein Component-Render-Kontext ist. Stil
 * wie `updateProfile()` in `src/features/auth/api.ts`.
 */
export async function saveModulePreferences(userId: string, modules: ModulePreferences) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      module_fridge: modules.fridge,
      module_shopping_list: modules.shoppingList,
      module_calories: modules.calories,
      module_recipes: modules.recipes,
      module_meal_planner: modules.mealPlanner,
      module_glp1: modules.glp1 ?? true,
      module_fasting: modules.fasting ?? true,
      module_workouts: modules.workouts ?? true,
      module_keto: modules.keto ?? true,
      module_cgm: modules.cgm ?? true,
      module_volumetrics: modules.volumetrics ?? true,
    })
    .eq('id', userId);

  return { error };
}
