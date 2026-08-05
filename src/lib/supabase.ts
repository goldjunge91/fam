import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
 *    App speichert Gesundheitsdaten — das passt nicht zusammen.
 *
 * 2. **Chunking.** SecureStore erlaubt auf iOS rund 2048 Byte pro Eintrag, eine
 *    Supabase-Session ist groesser. Siehe `chunked-storage.ts`.
 *
 * 3. **Alles wird verzoegert initialisiert.** Frueher stand hier ein
 *    `createClient(...)` auf Modulebene und `import * as SecureStore` ganz oben.
 *    Fehlt das native Modul — etwa weil der Development Build aelter ist als die
 *    Installation von `expo-secure-store` —, wirft schon der Import. Damit
 *    scheitert die Auswertung von `_layout.tsx`, Expo Router meldet
 *    "missing the required default export" und danach
 *    "Cannot read property 'ErrorBoundary' of undefined". Die eigentliche
 *    Ursache steht dann zwischen drei Folgefehlern.
 *
 *    Jetzt bootet die App in jedem Fall; der Fehler taucht dort auf, wo Supabase
 *    tatsaechlich gebraucht wird, und sagt, was zu tun ist.
 *
 * `detectSessionInUrl: false` ist in React Native zwingend: die Option ist fuer
 * OAuth-Redirects im Browser gedacht.
 */

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

let client: SupabaseClient | null = null;

/**
 * Gibt den Client zurueck und legt ihn beim ersten Aufruf an.
 *
 * Wirft, wenn Umgebungsvariablen oder das native Modul fehlen — aber erst hier
 * und mit einer Meldung, die den naechsten Schritt nennt.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;

  client = createClient(env.supabaseUrl, env.supabaseKey, {
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

/**
 * Bindet den Token-Refresh an den App-Zustand. Im Hintergrund friert iOS Timer
 * ein; ohne diese Anbindung waere der Access-Token beim Zurueckkehren abgelaufen.
 *
 * Schlaegt die Initialisierung fehl, wird das protokolliert statt geworfen: ein
 * fehlendes natives Modul soll die Navigation nicht lahmlegen.
 */
export function startSupabaseAutoRefresh(): () => void {
  if (Platform.OS === 'web') return () => {};

  let supabase: SupabaseClient;
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
