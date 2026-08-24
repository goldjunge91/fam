import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabase } from '@/lib/db/client';
import {
  type ResetCategoryPreferenceInput,
  resetCategoryPreference,
  resolveCategoryForItem,
  type SetCategoryPreferenceInput,
  setCategoryPreference,
} from './api';
import type { ResolvedPlacementClassification } from './resolve-category';
import {
  type AtomicShoppingItemSaveInput,
  type AtomicShoppingItemSaveResult,
  saveShoppingItemAtomically,
} from './save-shopping-item';

/** Gemeinsamer Invalidierungs-Key — noch ohne eigenen `useQuery` (#223 Paket 8 baut die UI darauf auf). */
export function categoryPreferencesQueryKey(householdId: string, storeId?: string | null) {
  return ['category-preferences', householdId, storeId ?? null] as const;
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
        queryKey: categoryPreferencesQueryKey(variables.householdId, variables.storeId),
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
    ): Promise<ResolvedPlacementClassification & { barcode: string | null }> => {
      await resetCategoryPreference(input);
      return resolveCategoryForItem({
        householdId: input.householdId,
        storeId: input.storeId,
        productId: input.productId,
        name: input.name,
        categoryTags: input.categoryTags,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: categoryPreferencesQueryKey(variables.householdId, variables.storeId),
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });
}

export type SaveShoppingItemMutationInput = Omit<AtomicShoppingItemSaveInput, 'db'> & {
  householdId: string;
};

/**
 * Gemeinsamer Hook fuer Add-/Edit-Formulare. Der Aufrufer liefert den bereits
 * vorbereiteten lokalen Item-Write; dieser Hook haelt Preference, Feedback und
 * Outbox in derselben exklusiven SQLite-Transaktion.
 */
export function useSaveShoppingItemMutation() {
  const queryClient = useQueryClient();

  return useMutation<AtomicShoppingItemSaveResult, Error, SaveShoppingItemMutationInput>({
    mutationFn: async ({ householdId: _householdId, ...input }) => {
      const db = await getDatabase();
      return saveShoppingItemAtomically({ db, ...input });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['shopping_list_items', variables.householdId],
      });
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
      if (variables.preference) {
        queryClient.invalidateQueries({
          queryKey: categoryPreferencesQueryKey(
            variables.preference.input.householdId,
            variables.preference.input.storeId,
          ),
        });
      }
    },
  });
}
