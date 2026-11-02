import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { fetch as expoFetch } from 'expo/fetch';
import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';
import { AppState, type AppStateStatus, Platform } from 'react-native';

import { createFetchWithResponseTimeout } from '@/lib/backend/supabase/fetch-response-timeout';
import { env } from '@/lib/config/env';
import type { Database } from '@/lib/database.types';
import { debugWarn } from '@/lib/observability/debug-log';
import { LocalSupabaseSessionStorage } from '@/lib/storage/local-supabase-session-storage';
import { createServerClock } from '@/lib/sync/server-clock';

export type TypedSupabaseClient = SupabaseClient<Database>;

// Supabase Auth falls back to plain PKCE when native WebCrypto.subtle is absent.
function ensureNativePkceS256Crypto() {
  if (Platform.OS === 'web') return;

  const existingCrypto = globalThis.crypto as Crypto | undefined;
  if (
    typeof existingCrypto?.getRandomValues === 'function' &&
    typeof existingCrypto.subtle?.digest === 'function'
  ) {
    return;
  }

  const nativeCrypto = existingCrypto ?? ({} as Crypto);
  if (typeof nativeCrypto.getRandomValues !== 'function') {
    Object.defineProperty(nativeCrypto, 'getRandomValues', {
      configurable: true,
      value: getRandomValues,
    });
  }
  if (typeof nativeCrypto.subtle?.digest !== 'function') {
    Object.defineProperty(nativeCrypto, 'subtle', {
      configurable: true,
      value: {
        digest: (algorithm: AlgorithmIdentifier, data: BufferSource) => {
          if (typeof algorithm !== 'string' || algorithm.toUpperCase() !== 'SHA-256') {
            throw new TypeError('Native PKCE crypto only supports SHA-256 digests.');
          }
          return digest(CryptoDigestAlgorithm.SHA256, data);
        },
      },
    });
  }

  if (!existingCrypto) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: nativeCrypto,
    });
  }
}

ensureNativePkceS256Crypto();

let client: TypedSupabaseClient | null = null;
// Ein Transport für Supabase, einschließlich binärer Receipt-Uploads.
// Native Uploads werden mit Uint8Array über storage.upload() geprüft.
export const serverClock = createServerClock(
  createFetchWithResponseTimeout(expoFetch as typeof fetch, 60_000),
);

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
      flowType: 'pkce',
      detectSessionInUrl: false,
    },
  });

  return client;
}

/**
 * Keeps recovery OTP sessions separate from the app session until the password
 * has been changed. This avoids booting account storage for a recovered user.
 */
export function createPasswordRecoveryClient(): TypedSupabaseClient {
  return createClient<Database>(env.supabaseUrl, env.supabaseKey, {
    global: { fetch: serverClock.fetch },
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
      storageKey: 'fam-password-recovery',
    },
  });
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
