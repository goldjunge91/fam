import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetch as expoFetch } from 'expo/fetch';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { env } from '@/lib/config/env';
import type { Database } from '@/lib/database.types';
import { debugWarn } from '@/lib/observability/debug-log';
import { LocalSupabaseSessionStorage } from '@/lib/storage/local-supabase-session-storage';
import { createServerClock } from '@/lib/sync/server-clock';

export type TypedSupabaseClient = SupabaseClient<Database>;

let client: TypedSupabaseClient | null = null;
// Ein Transport für Supabase, einschließlich binärer Receipt-Uploads.
// Native Uploads werden mit Uint8Array über storage.upload() geprüft.
export const serverClock = createServerClock(expoFetch as typeof fetch);

export function getSupabase(): TypedSupabaseClient {
  if (client) return client;

  client = createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    global: { fetch: serverClock.fetch },
    auth: {
      // Im Browser gibt es kein SecureStore; dort nutzt supabase-js localStorage.
      storage: Platform.OS === 'web' ? undefined : new LocalSupabaseSessionStorage(),
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
    debugWarn('[supabase] Auto-Refresh nicht gestartet:', error);
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
        debugWarn('[supabase] Auto-Refresh-Zustandswechsel fehlgeschlagen:', error);
      });
  };

  updateAutoRefresh(AppState.currentState);
  const subscription = AppState.addEventListener('change', updateAutoRefresh);

  return () => {
    subscription.remove();
    updateAutoRefresh('background');
  };
}
