import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  dehydrate,
  focusManager,
  hydrate,
  MutationCache,
  onlineManager,
  type Query,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { Sentry } from '@/lib/sentry';
import { getEncryptedAccountStorage } from '@/lib/storage/account-storage';

const LEGACY_PERSISTED_QUERY_CACHE_KEY = '@fam/react-query-cache';
const ACCOUNT_QUERY_CACHE_KEY = 'react-query-cache.v1';
const PERSISTED_QUERY_KEY_PREFIXES: readonly unknown[] = ['calorie-tracking', 'profile'];

function reportQueryError(error: unknown, queryKey: readonly unknown[]): void {
  if (!onlineManager.isOnline()) return;
  Sentry.captureException(error, { tags: { source: 'react-query' }, extra: { queryKey } });
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => reportQueryError(error, query.queryKey),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      reportQueryError(error, mutation.options.mutationKey ?? []),
  }),
  defaultOptions: {
    queries: {
      // Die UI liest aus SQLite; der Query-Cache darf länger gültig bleiben.
      staleTime: 30_000,
      retry: 2,
      // Im Browser gilt das Standardverhalten; Native nutzt den focusManager.
      refetchOnWindowFocus: Platform.OS === 'web',
    },
    mutations: {
      retry: 0,
    },
  },
});

/**
 * Verbindet Query mit AppState und Netzwerkstatus.
 *
 * Gibt eine Aufraeumfunktion zurueck; einmal beim App-Start aufrufen.
 */
export function startQueryEnvironmentSync(): () => void {
  if (Platform.OS === 'web') return () => {};

  const appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });

  // Query ruft die Abmeldefunktion beim Listenerwechsel auf.
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      // Erreichbarkeit ist genauer als die reine Verbindungsart; unbekannt gilt als online.
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });

    return () => subscription.remove();
  });

  return () => {
    appStateSubscription.remove();
  };
}

export async function removeLegacyPersistedQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_PERSISTED_QUERY_CACHE_KEY);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'legacy-query-cache-cleanup' },
    });
    throw error;
  }
}

export function shouldPersistQuery(query: Query): boolean {
  return (
    PERSISTED_QUERY_KEY_PREFIXES.includes(query.queryKey[0]) && query.state.status === 'success'
  );
}

/** Stellt den privaten Query-Cache eines Accounts wieder her und hält ihn aktuell. */
export async function startAccountQueryPersistence(
  client: QueryClient,
  userId: string,
): Promise<() => void> {
  const storage = await getEncryptedAccountStorage(userId);
  const persistedCache = storage.getString(ACCOUNT_QUERY_CACHE_KEY);

  if (persistedCache) {
    try {
      hydrate(client, JSON.parse(persistedCache));
    } catch (error) {
      storage.remove(ACCOUNT_QUERY_CACHE_KEY);
      Sentry.captureException(error, { tags: { source: 'account-query-cache-restore' } });
    }
  }

  return client.getQueryCache().subscribe(({ query }) => {
    if (!PERSISTED_QUERY_KEY_PREFIXES.includes(query.queryKey[0])) return;
    try {
      storage.set(
        ACCOUNT_QUERY_CACHE_KEY,
        JSON.stringify(dehydrate(client, { shouldDehydrateQuery: shouldPersistQuery })),
      );
    } catch (error) {
      Sentry.captureException(error, { tags: { source: 'account-query-cache-persist' } });
    }
  });
}
