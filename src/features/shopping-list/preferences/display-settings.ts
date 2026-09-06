import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getEncryptedAccountStorage } from '@/lib/storage/account-storage';

const SHOW_PRICE_IN_MARKET_VIEW_KEY = 'shopping-list.show-price-in-market-view';
export const DEFAULT_SHOW_PRICE_IN_MARKET_VIEW = false;

export const showPriceInMarketViewQueryKey = (userId?: string) =>
  ['settings', 'shopping-list', 'show-price-in-market-view', userId ?? 'anonymous'] as const;

export async function getShowPriceInMarketView(userId: string): Promise<boolean> {
  try {
    const storage = await getEncryptedAccountStorage(userId);
    return storage.getBoolean(SHOW_PRICE_IN_MARKET_VIEW_KEY) ?? DEFAULT_SHOW_PRICE_IN_MARKET_VIEW;
  } catch {
    return DEFAULT_SHOW_PRICE_IN_MARKET_VIEW;
  }
}

export async function setShowPriceInMarketView(userId: string, value: boolean): Promise<void> {
  try {
    const storage = await getEncryptedAccountStorage(userId);
    storage.set(SHOW_PRICE_IN_MARKET_VIEW_KEY, value);
  } catch {
    // Die Marktansicht bleibt auch ohne verfügbaren lokalen Speicher bedienbar.
  }
}

export function useShowPriceInMarketView(userId?: string) {
  return useQuery({
    queryKey: showPriceInMarketViewQueryKey(userId),
    queryFn: () => (userId ? getShowPriceInMarketView(userId) : DEFAULT_SHOW_PRICE_IN_MARKET_VIEW),
    enabled: Boolean(userId),
    placeholderData: DEFAULT_SHOW_PRICE_IN_MARKET_VIEW,
  });
}

export function useSetShowPriceInMarketView(userId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (value: boolean) => {
      if (userId) await setShowPriceInMarketView(userId, value);
      return value;
    },
    onSuccess: (value) => {
      queryClient.setQueryData(showPriceInMarketViewQueryKey(userId), value);
    },
  });
}
