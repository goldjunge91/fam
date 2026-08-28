import type { QueryClient } from '@tanstack/react-query';

import { signOut as signOutSession } from '@/features/auth/api';
import { setStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { deleteLocalDatabase, setActiveUserId } from '@/lib/db/client';
import { debugLogEvent } from '@/lib/debug-log';
import { removeLegacyPersistedQueryCache } from '@/lib/query-client';
import { resetLocalAccountModuleCaches } from '@/lib/storage/account-cache-registry';
import {
  deleteEncryptedAccountStorage,
  forgetLocalAccountUserId,
  getRememberedLocalAccountUserId,
} from '@/lib/storage/account-storage';
import { getSupabase } from '@/lib/supabase';
import { stopAccountSyncAndWait } from '@/lib/sync/account-sync-gate';

const cleanupByUserId = new Map<string, Promise<void>>();

/**
 * Entfernt alle lokal verbleibenden Daten eines Accounts. Gleichzeitige
 * SIGNED_OUT- und UI-Logout-Aufrufe teilen sich denselben Cleanup-Lauf.
 */
export function clearLocalAccountData(queryClient: QueryClient, userId: string): Promise<void> {
  // Sperrt neue lokale Zugriffe sofort.
  setActiveUserId(null);
  const running = cleanupByUserId.get(userId);
  if (running) return running;

  const cleanup = (async () => {
    let essentialError: unknown;

    try {
      await queryClient.cancelQueries();
    } catch (cleanupError) {
      console.warn('[auth] laufende Queries nicht gestoppt:', (cleanupError as Error).message);
    }

    try {
      await stopAccountSyncAndWait();
    } catch (cleanupError) {
      essentialError = cleanupError;
    }

    try {
      queryClient.clear();
    } catch (cleanupError) {
      console.warn('[auth] Query-Cache nicht geleert:', (cleanupError as Error).message);
    }

    try {
      await removeLegacyPersistedQueryCache();
    } catch (cleanupError) {
      essentialError ??= cleanupError;
    }

    if (!essentialError) {
      // Daten erst löschen, wenn keine alten Sync-Schreibvorgänge mehr laufen.
      try {
        await deleteLocalDatabase();
      } catch (cleanupError) {
        essentialError = cleanupError;
      }
    }

    if (!essentialError) {
      try {
        await deleteEncryptedAccountStorage(userId);
      } catch (cleanupError) {
        essentialError = cleanupError;
      }
    }

    if (!essentialError) {
      try {
        await forgetLocalAccountUserId(userId);
      } catch (cleanupError) {
        essentialError = cleanupError;
      }
    }

    try {
      resetLocalAccountModuleCaches(userId);
    } catch (cleanupError) {
      console.warn('[auth] Modulcaches nicht geleert:', (cleanupError as Error).message);
    }

    try {
      await setStoredActiveHouseholdId(null);
    } catch (cleanupError) {
      console.warn(
        '[auth] aktiver Haushalt nicht zurueckgesetzt:',
        (cleanupError as Error).message,
      );
    }

    if (essentialError) throw essentialError;
  })().finally(() => {
    cleanupByUserId.delete(userId);
  });

  cleanupByUserId.set(userId, cleanup);
  return cleanup;
}

export async function signOutAndClearLocalData(queryClient: QueryClient): Promise<{
  error: Error | null;
}> {
  debugLogEvent('auth.sign-out.started');
  let userId: string | null = null;
  try {
    userId = await getRememberedLocalAccountUserId();
  } catch {
    // Die Session-Abfrage kann die Nutzer-ID noch liefern.
  }
  try {
    const { data: sessionData } = await getSupabase().auth.getSession();
    userId = sessionData.session?.user.id ?? userId;
  } catch {}

  let serverError: Error | null = null;
  let localSessionRemovalError: Error | null = null;
  try {
    ({ error: serverError } = await signOutSession());
    debugLogEvent('auth.sign-out.server-completed', { failed: serverError !== null });
  } catch (error) {
    serverError = error as Error;
    try {
      // Lokale Session auch bei einem fehlgeschlagenen Server-Logout entfernen.
      await getSupabase().auth.signOut({ scope: 'local' });
      debugLogEvent('auth.sign-out.local-fallback-completed');
    } catch (fallbackError) {
      localSessionRemovalError = fallbackError as Error;
    }
  }

  // Lokale Daten unabhängig vom Server-Ergebnis bereinigen.
  if (userId) {
    debugLogEvent('auth.sign-out.local-cleanup-started');
    await clearLocalAccountData(queryClient, userId);
    debugLogEvent('auth.sign-out.completed');
  } else {
    debugLogEvent('auth.sign-out.completed', { localCleanup: 'skipped-no-user-id' });
  }

  if (serverError) {
    console.warn('[auth] Server-Session konnte nicht widerrufen werden:', serverError.message);
  }

  return { error: localSessionRemovalError };
}
