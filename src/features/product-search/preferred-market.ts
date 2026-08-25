import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useStores } from '@/features/shopping-list/hooks/use-stores';

const STORAGE_PREFIX = '@fam/product-search-preferred-market:';

function storageKey(householdId: string): string {
  return `${STORAGE_PREFIX}${householdId}`;
}

export async function getPreferredProductMarket(householdId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(householdId));
  } catch {
    return null;
  }
}

export async function setPreferredProductMarket(
  householdId: string,
  storeId: string | null,
): Promise<void> {
  try {
    if (storeId) await AsyncStorage.setItem(storageKey(householdId), storeId);
    else await AsyncStorage.removeItem(storageKey(householdId));
  } catch {
    // Eine lokale Komforteinstellung darf den Such- oder Haushaltsworkflow nicht blockieren.
  }
}

export function preferredProductMarketQueryKey(householdId: string | undefined) {
  return ['settings', 'product-search-preferred-market', householdId] as const;
}

export function usePreferredProductMarket(householdId: string | undefined) {
  return useQuery({
    queryKey: preferredProductMarketQueryKey(householdId),
    queryFn: () => (householdId ? getPreferredProductMarket(householdId) : null),
    enabled: Boolean(householdId),
  });
}

export function useSetPreferredProductMarket() {
  const queryClient = useQueryClient();
  return async (householdId: string, storeId: string | null) => {
    await setPreferredProductMarket(householdId, storeId);
    await queryClient.invalidateQueries({
      queryKey: preferredProductMarketQueryKey(householdId),
    });
  };
}

export function usePreferredProductMarketName(householdId: string | undefined) {
  const { data: storeId } = usePreferredProductMarket(householdId);
  const { data: stores = [] } = useStores(householdId);
  return stores.find((store) => store.id === storeId)?.name ?? null;
}
