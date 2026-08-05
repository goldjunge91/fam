import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { createChunkedStorage, type KeyValueStore } from '@/lib/chunked-storage';
import { env } from '@/lib/env';

/**
 * Zentraler Supabase-Client, app-weit verwendet.
 *
 * Abweichungen vom offiziellen Expo-Guide, bewusst getroffen:
 *
 * 1. **SecureStore statt AsyncStorage.** Der Guide nutzt AsyncStorage; dort
 *    liegt die Session unverschluesselt im App-Verzeichnis und ist in einem
 *    unverschluesselten Backup oder auf einem gerooteten Geraet lesbar. Diese
 *    App speichert Gesundheitsdaten — das passt nicht zusammen. SecureStore
 *    legt die Session in Keychain bzw. Keystore ab.
 *
 * 2. **Chunking.** SecureStore erlaubt auf iOS rund 2048 Byte pro Eintrag, eine
 *    Supabase-Session ist groesser. Siehe `chunked-storage.ts`.
 *
 * `detectSessionInUrl: false` ist in React Native zwingend: die Option ist fuer
 * OAuth-Redirects im Browser gedacht und wuerde hier versuchen, eine URL
 * auszuwerten, die es nicht gibt.
 */

/** SecureStore gibt es im Browser nicht — dort faellt der Client auf localStorage zurueck. */
const secureStoreAdapter: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

const storage = Platform.OS === 'web' ? undefined : createChunkedStorage(secureStoreAdapter);

export const supabase = createClient(env.supabaseUrl, env.supabaseKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Der Auto-Refresh laeuft ueber einen Timer. Im Hintergrund friert iOS Timer
 * ein; ohne diese Anbindung waere der Access-Token beim Zurueckkehren abgelaufen
 * und der erste Request nach einer laengeren Pause schluege fehl.
 *
 * Wird einmal beim App-Start aufgerufen (siehe `src/app/_layout.tsx`).
 */
export function startSupabaseAutoRefresh(): () => void {
  if (Platform.OS === 'web') return () => {};

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => subscription.remove();
}
