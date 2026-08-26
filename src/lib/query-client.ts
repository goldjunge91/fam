import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  focusManager,
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
} from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { Sentry } from '@/lib/sentry';

const LEGACY_PERSISTED_QUERY_CACHE_KEY = '@fam/react-query-cache';

/**
 * Meldet einen Query-/Mutation-Fehler an Sentry — aber nur, wenn das Geraet
 * tatsaechlich online ist. Offline pausiert Query Requests ohnehin (siehe
 * `onlineManager` unten); ein Fehler, der trotzdem hier ankommt, ist kein
 * erwarteter Offline-Zustand, sondern ein echtes Problem (RLS, Bug, Timeout,
 * kaputte Response). `initSentry()`s No-op ohne DSN macht diesen Aufruf in
 * lokaler Entwicklung folgenlos.
 */
function reportQueryError(error: unknown, queryKey: readonly unknown[]): void {
  if (!onlineManager.isOnline()) return;
  Sentry.captureException(error, { tags: { source: 'react-query' }, extra: { queryKey } });
}

/**
 * TanStack Query fuer React Native.
 *
 * Zwei Anbindungen, die der Standard-Setup nicht mitbringt und ohne die Query
 * still das Falsche tut:
 *
 * 1. **Focus.** Query horcht im Browser auf `window`-Focus-Events, um nach
 *    Rueckkehr neu zu laden. In React Native gibt es kein `window` — ohne die
 *    Anbindung an `AppState` bleiben Daten nach dem Wechsel aus dem Hintergrund
 *    veraltet, ohne dass irgendetwas darauf hindeutet.
 *
 * 2. **Online-Status.** Ohne Anbindung haelt Query die App fuer dauerhaft
 *    online, feuert Requests ins Leere und markiert Queries als fehlgeschlagen,
 *    statt sie zu pausieren und bei Reconnect fortzusetzen.
 */

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
      // Ab Epic 2 liest die UI aus SQLite, nicht aus dem Netz. Dann ist der
      // Cache ohnehin lokal und darf laenger als frisch gelten.
      staleTime: 30_000,
      retry: 2,
      // Im Browser bleibt das Standardverhalten sinnvoll; auf Native uebernimmt
      // der focusManager unten.
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

  // `setEventListener` gibt selbst die Abmeldefunktion zurueck, die Query beim
  // Austausch des Listeners aufruft.
  onlineManager.setEventListener((setOnline) => {
    const subscription = Network.addNetworkStateListener((state) => {
      // `isInternetReachable` ist genauer als `isConnected`: Ein Geraet kann im
      // WLAN haengen, das keinen Weg nach draussen hat (Hotel-Portal, Captive
      // Portal). `isConnected` waere dort true, jeder Request liefe trotzdem ins
      // Leere. Ist der Wert unbekannt (undefined), gilt die Verbindung als
      // vorhanden — lieber einen Request wagen als faelschlich offline gehen.
      setOnline(state.isInternetReachable ?? state.isConnected ?? true);
    });

    return () => subscription.remove();
  });

  return () => {
    appStateSubscription.remove();
  };
}

/**
 * Entfernt Daten, die aeltere App-Versionen unverschluesselt in AsyncStorage
 * abgelegt haben. Der Aufruf ist absichtlich idempotent und erfolgt bei jedem
 * App-Start: Schlaegt das Entfernen einmal fehl, wird es beim naechsten Start
 * erneut versucht, ohne einen weiteren Migrations-Marker zu hinterlassen.
 */
export async function removeLegacyPersistedQueryCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEGACY_PERSISTED_QUERY_CACHE_KEY);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { source: 'legacy-query-cache-cleanup' },
    });
  }
}
