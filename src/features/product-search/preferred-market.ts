import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useStores } from '@/features/shopping-list/hooks/use-stores';

const STORAGE_PREFIX = '@fam/product-search-preferred-market:';

function storageKey(householdId: string): string {
  return `${STORAGE_PREFIX}${householdId}`;
}

export type PreferredProductMarkets = string[];

export async function getPreferredProductMarkets(
  householdId: string,
): Promise<PreferredProductMarkets> {
  try {
    const stored = await AsyncStorage.getItem(storageKey(householdId));
    if (!stored) return [];
    try {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.filter((value): value is string => typeof value === 'string');
      }
    } catch {
      // Vor der Mehrfachauswahl wurde nur die Markt-ID gespeichert.
    }
    return [stored];
  } catch {
    return [];
  }
}

export async function setPreferredProductMarkets(
  householdId: string,
  storeIds: readonly string[],
): Promise<void> {
  try {
    if (storeIds.length > 0)
      await AsyncStorage.setItem(storageKey(householdId), JSON.stringify(storeIds));
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
    queryFn: () => (householdId ? getPreferredProductMarkets(householdId) : []),
    enabled: Boolean(householdId),
  });
}

export function useSetPreferredProductMarket() {
  const queryClient = useQueryClient();
  return async (householdId: string, storeIds: readonly string[]) => {
    await setPreferredProductMarkets(householdId, storeIds);
    await queryClient.invalidateQueries({
      queryKey: preferredProductMarketQueryKey(householdId),
    });
  };
}

export function usePreferredProductMarketName(householdId: string | undefined) {
  const { data: storeIds = [] } = usePreferredProductMarket(householdId);
  const { data: stores = [] } = useStores(householdId);
  return storeIds
    .map((storeId) => stores.find((store) => store.id === storeId)?.name)
    .filter((name): name is string => Boolean(name));
}
