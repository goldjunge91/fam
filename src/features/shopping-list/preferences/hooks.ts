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

/** Gemeinsamer Invalidierungs-Key für Präferenzen. */
export function categoryPreferencesQueryKey(householdId: string, storeId?: string | null) {
  return ['category-preferences', householdId, storeId ?? null] as const;
}

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
