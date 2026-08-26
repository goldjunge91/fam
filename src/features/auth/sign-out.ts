import type { QueryClient } from '@tanstack/react-query';

import { signOut } from '@/features/auth/api';
import { setStoredActiveHouseholdId } from '@/features/household/active-household-store';
import { deleteLocalDatabase, setActiveUserId } from '@/lib/db/client';
import { removeLegacyPersistedQueryCache } from '@/lib/query-client';
import {
  deleteEncryptedAccountStorage,
  forgetLocalAccountUserId,
  getRememberedLocalAccountUserId,
} from '@/lib/storage/account-storage';
import { getSupabase } from '@/lib/supabase';
import { stopAccountSyncAndWait } from '@/lib/sync/account-sync-gate';
import { resetLocalAccountModuleCaches } from './local-account-cache';

const cleanupByUserId = new Map<string, Promise<void>>();

/**
 * Entfernt alle lokal verbleibenden Daten eines Accounts. Gleichzeitige
 * SIGNED_OUT- und UI-Logout-Aufrufe teilen sich denselben Cleanup-Lauf.
 */
export function clearLocalAccountData(queryClient: QueryClient, userId: string): Promise<void> {
  // Synchronous access barrier, also for manual logout paths whose Auth event
  // has not arrived yet (or whose local Auth removal itself failed).
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

    // Ein fehlgeschlagener Stopper bedeutet, dass noch ein alter Account-Task
    // schreiben könnte. In diesem Zustand weder Dateien löschen noch einen
    // neuen Besitzer freigeben.
    if (!essentialError) {
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

/**
 * Meldet ab und raeumt alles auf, was auf dem Geraet zurueckbleibt (#58).
 *
 * Supabase entfernt die lokale Session auch dann, wenn das serverseitige
 * Revoke wegen eines Netzwerkfehlers fehlschlägt. Der lokale Cleanup läuft
 * deshalb unabhängig vom zurückgegebenen Serverfehler weiter.
 */
export async function signOutAndClearLocalData(queryClient: QueryClient): Promise<{
  error: Error | null;
}> {
  let userId: string | null = null;
  try {
    userId = await getRememberedLocalAccountUserId();
  } catch {
    // getSession kann die ID weiterhin liefern; der Logout selbst darf an
    // einem beschädigten Besitzer-Marker nicht scheitern.
  }
  try {
    const { data: sessionData } = await getSupabase().auth.getSession();
    userId = sessionData.session?.user.id ?? userId;
  } catch {
    // Der lokale Besitzer-Marker reicht für den sicheren Cleanup aus.
  }

  let serverError: Error | null = null;
  let localSessionRemovalError: Error | null = null;
  try {
    ({ error: serverError } = await signOut());
  } catch (error) {
    serverError = error as Error;
    try {
      // Ein geworfener Fehler beweist im Gegensatz zu einem zurückgegebenen
      // Auth-Fehler nicht, dass auth-js `_removeSession()` erreicht hat.
      // Der lokale Scope wiederholt genau diese Entfernung; ein dabei
      // zurückgegebener Netzwerkfehler kommt erst nach dem lokalen Remove.
      await getSupabase().auth.signOut({ scope: 'local' });
    } catch (fallbackError) {
      localSessionRemovalError = fallbackError as Error;
    }
  }

  // supabase-js loescht die Session-Chunks aus SecureStore selbst. Die übrigen
  // lokalen Account-Daten werden nur bereinigt, wenn vor dem Logout tatsächlich
  // ein Nutzer bekannt war. Der Auth-State-Listener nutzt denselben deduplizierten
  // Cleanup für externe SIGNED_OUT-Events und direkte Nutzerwechsel.
  if (userId) await clearLocalAccountData(queryClient, userId);

  if (serverError) {
    console.warn('[auth] Server-Session konnte nicht widerrufen werden:', serverError.message);
  }

  return { error: localSessionRemovalError };
}
