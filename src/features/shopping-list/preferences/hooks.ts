import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CategoryClassification } from '../classification/types';
import {
  type ResetCategoryPreferenceInput,
  resetCategoryPreference,
  resolveCategoryForItem,
  type SetCategoryPreferenceInput,
  setCategoryPreference,
} from './api';

/** Gemeinsamer Invalidierungs-Key — noch ohne eigenen `useQuery` (#223 Paket 8 baut die UI darauf auf). */
export function categoryPreferencesQueryKey(householdId: string) {
  return ['category-preferences', householdId] as const;
}

/**
 * Manuelle Korrektur im Formular (Abschnitt 9 "Schreiben"). Legt die
 * Haushaltspraeferenz an/aktualisiert sie — das Setzen von
 * `category_source = 'user'` bzw. `'household_preference'` am betroffenen
 * Listeneintrag ist Sache des Aufrufers (Paket 8), diese Mutation kennt nur
 * die Praeferenz selbst.
 */
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

/**
 * Reverse State zur manuellen Korrektur (Abschnitt 9 "Auf automatisch
 * zurücksetzen"): soft-deleted die Praeferenz und liefert direkt das neue
 * automatische Ergebnis zurueck, damit der Aufrufer es ohne separaten,
 * racy Zweitaufruf auf den aktuellen Eintrag schreiben kann.
 */
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
