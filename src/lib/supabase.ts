import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';
import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';
import { createServerClock } from '@/lib/sync/server-clock';

export type TypedSupabaseClient = SupabaseClient<Database>;

const REBUILD_HINT =
  'Das native Modul ExpoSecureStore fehlt im installierten Development Build. ' +
  'Native Module landen beim Build im Binary — ein Metro-Reload reicht nicht. ' +
  'Baue neu: eas build --profile development --platform ios';

/**
 * Laedt expo-secure-store erst beim ersten Zugriff. `require` statt `import`,
 * weil ein statischer Import zur Ladezeit des Moduls ausgewertet wuerde.
 */
function loadSecureStore() {
  try {
    return require('expo-secure-store') as typeof import('expo-secure-store');
  } catch {
    throw new Error(REBUILD_HINT);
  }
}

const secureStoreAdapter: KeyValueStore = {
  getItem: (key) => loadSecureStore().getItemAsync(key),
  setItem: (key, value) => loadSecureStore().setItemAsync(key, value),
  removeItem: (key) => loadSecureStore().deleteItemAsync(key),
};

let client: TypedSupabaseClient | null = null;
export const serverClock = createServerClock();

export function getSupabase(): TypedSupabaseClient {
  if (client) return client;

  client = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    global: { fetch: serverClock.fetch },
    auth: {
      // Im Browser gibt es kein SecureStore; dort nutzt supabase-js localStorage.
      storage: Platform.OS === 'web' ? undefined : createChunkedStorage(secureStoreAdapter),
      // Native wird explizit ueber AppState gesteuert. Sonst startet der Client
      // bereits beim Konstruktor einen Timer, der auch im Hintergrund weiterlaeuft.
      autoRefreshToken: Platform.OS === 'web',
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}

export function startSupabaseAutoRefresh(): () => void {
  if (Platform.OS === 'web') return () => {};

  let supabase: TypedSupabaseClient;
  try {
    supabase = getSupabase();
  } catch (error) {
    console.warn('[supabase] Auto-Refresh nicht gestartet:', (error as Error).message);
    return () => {};
  }

  // Start und Stop muessen seriell laufen: startAutoRefresh() stoppt intern
  // zunaechst einen alten Timer. Ein paralleler Cleanup koennte sonst vor
  // diesem await fertig sein und der Start danach trotzdem einen Timer anlegen.
  let transition = Promise.resolve();
  const updateAutoRefresh = (state: AppStateStatus) => {
    transition = transition
      .then(() =>
        state === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh(),
      )
      .catch((error) => {
        console.warn('[supabase] Auto-Refresh-Zustandswechsel fehlgeschlagen:', error);
      });
  };

  updateAutoRefresh(AppState.currentState);
  const subscription = AppState.addEventListener('change', updateAutoRefresh);

  return () => {
    subscription.remove();
    updateAutoRefresh('background');
  };
}
