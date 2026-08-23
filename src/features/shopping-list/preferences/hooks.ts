import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryClassification } from '../classification/types';
import {
  type ResetCategoryPreferenceInput,
  resetCategoryPreference,
  resolveCategoryForItem,
  type SetCategoryPreferenceInput,
  setCategoryPreference,
} from './api';

export function categoryPreferencesQueryKey(householdId: string) {
  return ['category-preferences', householdId] as const;
}

/** Aktualisiert nur die Praeferenz; der Aufrufer setzt die Quelle am Listeneintrag. */
export function useSetCategoryPreferenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetCategoryPreferenceInput) => setCategoryPreference(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: categoryPreferencesQueryKey(variables.householdId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export type ResetCategoryPreferenceMutationInput = ResetCategoryPreferenceInput & {
  /** Fuer die anschliessende Neuauflösung noetig — siehe `resolveCategoryForItem`. */
  name: string;
  productId?: string | null;
  categoryTags?: readonly string[];
};

/** Liefert das neue automatische Ergebnis ohne potenziell konkurrierenden Zweitaufruf. */
export function useResetCategoryPreferenceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: ResetCategoryPreferenceMutationInput,
    ): Promise<CategoryClassification> => {
      await resetCategoryPreference(input);
      return resolveCategoryForItem({
        householdId: input.householdId,
        productId: input.productId,
        name: input.name,
        categoryTags: input.categoryTags,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: categoryPreferencesQueryKey(variables.householdId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}
