import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';
import type { Database } from '@/lib/database.types';
import { env } from '@/lib/env';

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

export function getSupabase(): TypedSupabaseClient {
  if (client) return client;

  client = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    auth: {
      // Im Browser gibt es kein SecureStore; dort nutzt supabase-js localStorage.
      storage: Platform.OS === 'web' ? undefined : createChunkedStorage(secureStoreAdapter),
      autoRefreshToken: true,
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

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => subscription.remove();
}
