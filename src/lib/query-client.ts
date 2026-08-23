import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import {
  focusManager,
  MutationCache,
  onlineManager,
  type Query,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { Sentry } from '@/lib/sentry';

/** Erwartete Offline-Fehler werden nicht an Sentry gemeldet. */
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
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: Platform.OS === 'web',
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Ersetzt Browser-Fokus und -Netzwerkstatus auf React Native. */
export function startQueryEnvironmentSync(): () => void {
  if (Platform.OS === 'web') return () => {};

  const appStateSubscription = AppState.addEventListener('change', (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  });

  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      // Bei unbekanntem Status lieber einen Request wagen als falsch offline gehen.
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });

    return () => subscription.remove();
  });

  return () => {
    appStateSubscription.remove();
  };
}

/** Private Kalorien-Queries liegen nicht im SQLite-Sync und werden separat persistiert. */
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: '@fam/react-query-cache',
});

export function shouldPersistQuery(query: Query): boolean {
  return query.queryKey[0] === 'calorie-tracking';
}
