import type { QueryClient } from '@tanstack/react-query';

import { signOut as signOutSession } from '@/features/auth/api';
import { setStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { deleteLocalDatabase, setActiveUserId } from '@/lib/db/client';
import { debugLogEvent, debugWarn } from '@/lib/debug-log';
import { cancelUserNotificationReminders } from '@/lib/notifications';
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
      debugWarn('[auth] laufende Queries nicht gestoppt:', cleanupError);
    }

    try {
      await stopAccountSyncAndWait();
    } catch (cleanupError) {
      essentialError = cleanupError;
    }

    try {
      await cancelUserNotificationReminders(userId);
    } catch (cleanupError) {
      debugWarn('[auth] geplante Account-Erinnerungen nicht entfernt:', cleanupError);
    }
    // TODO Force delete needed
    try {
      queryClient.clear();
    } catch (cleanupError) {
      debugWarn('[auth] Query-Cache nicht geleert:', cleanupError);
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
      debugWarn('[auth] Modulcaches nicht geleert:', cleanupError);
    }

    try {
      await setStoredActiveHouseholdId(null);
    } catch (cleanupError) {
      debugWarn('[auth] aktiver Haushalt nicht zurueckgesetzt:', cleanupError);
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
  // TODO force delete
  // Lokale Daten unabhängig vom Server-Ergebnis bereinigen.
  if (userId) {
    debugLogEvent('auth.sign-out.local-cleanup-started');
    await clearLocalAccountData(queryClient, userId);
    debugLogEvent('auth.sign-out.completed');
  } else {
    debugLogEvent('auth.sign-out.completed', { localCleanup: 'skipped-no-user-id' });
  }

  if (serverError) {
    debugWarn('[auth] Server-Session konnte nicht widerrufen werden:', serverError);
  }

  return { error: localSessionRemovalError };
}
