import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import { getSupabase } from '@/lib/supabase';
import { setBackgroundSyncHandler } from '@/lib/sync/background-sync';
import { type SyncRunResult, syncHousehold } from '@/lib/sync/engine';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import { createServerClock } from '@/lib/sync/server-clock';

const serverClock = createServerClock();
let isSyncing = false;
let lastSyncResultSummary: {
  timestamp: number;
  pushedCount: number;
  pulledCount: number;
  hasErrors: boolean;
  lastError?: string;
} | null = null;

export function getLastSyncInfo() {
  return lastSyncResultSummary;
}

export async function triggerHouseholdSync(
  householdIds: string[],
  retryFailed = false,
): Promise<SyncRunResult | null> {
  if (isSyncing || !householdIds || householdIds.length === 0) return null;
  isSyncing = true;
  try {
    const db = await getDatabase();
    if (retryFailed) {
      await retryFailedOutboxEntries(db);
    }
    const supabase = getSupabase();
    const result = await syncHousehold({
      db,
      supabase,
      serverClock,
      householdIds,
    });

    const pushedCount = result.push.outcomes.filter((o) => o.kind === 'pushed').length;
    const pulledCount = result.pull.reduce((acc, p) => acc + (p.rowsWritten || 0), 0);
    const firstErr = result.push.outcomes.find((o) => 'error' in o && o.error);

    lastSyncResultSummary = {
      timestamp: Date.now(),
      pushedCount,
      pulledCount,
      hasErrors: Boolean(firstErr),
      lastError:
        firstErr && 'error' in firstErr ? (firstErr as { error: string }).error : undefined,
    };

    return result;
  } catch (err) {
    console.warn('[SyncRunner] Sync fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncing = false;
  }
}

/**
 * Automatischer Sync-Hook. Startet den Sync beim Laden, periodisch alle 20s,
 * und beim Reaktivieren der App (AppState == 'active').
 */
export function useSyncEngine(householdId: string | undefined) {
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;

  useEffect(() => {
    if (!householdId) return;

    // 1. Initialer Sync beim App-Start / Haushalt-Laden
    triggerHouseholdSync([householdId]);

    // 2. Periodischer Timer (alle 20 Sekunden)
    const interval = setInterval(() => {
      if (householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current]);
      }
    }, 20000);

    // 3. Sync bei AppState -> 'active'
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current]);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [householdId]);
}

/**
 * Realtime + Netzwerk-Reconnect + Hintergrund-Sync-Handler fuer den aktiven
 * Haushalt (#48, #50). Ergaenzt useSyncEngine (Poll alle 20s) um Nahe-
 * Echtzeit-Konvergenz — wird IMMER zusammen mit useSyncEngine aufgerufen,
 * nie als Ersatz: der App-Start-Sync von useSyncEngine deckt den allerersten
 * Connect ab, dieser Hook nur Aenderungen danach.
 */
export function useRealtimeSync(householdId: string | undefined) {
  // Hintergrund-Sync-Handler unabhaengig vom Realtime/Netzwerk-Teil pflegen,
  // damit die Task, egal wann sie vom OS geweckt wird, immer den aktuell
  // aktiven Haushalt kennt. Kein Haushalt (z.B. waehrend Onboarding) →
  // Handler auf null: die Task bleibt registriert und tut beim naechsten
  // Aufwachen einfach nichts (siehe background-sync.ts Kommentar).
  useEffect(() => {
    setBackgroundSyncHandler(
      householdId
        ? async () => {
            await triggerHouseholdSync([householdId]);
          }
        : null,
    );
    return () => setBackgroundSyncHandler(null);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;

    const onReconnect = async () => {
      await triggerHouseholdSync([householdId]);
    };

    let cancelled = false;
    let unsubscribeRealtime: (() => Promise<void>) | null = null;

    (async () => {
      const db = await getDatabase();
      const supabase = getSupabase();
      if (cancelled) return; // Haushalt hat sich gewechselt, waehrend getDatabase() lief
      unsubscribeRealtime = subscribeHouseholdRealtime({
        db,
        supabase,
        householdIds: [householdId],
        serverClock,
        onReconnectResyncNeeded: onReconnect,
      });
    })();

    const stopNetworkTrigger = startNetworkReconnectTrigger({ onReconnect });

    return () => {
      cancelled = true;
      // Das Abmelden ist async (es wartet das Leave zum Server ab). Hier nicht
      // abgewartet — eine Cleanup-Funktion kann das nicht. Das ist unbedenklich:
      // Aus der Channel-Registry ist der Channel bereits synchron raus, und ein
      // spaeterer Aufbau auf demselben Topic raeumt ohnehin selbst auf (siehe
      // `subscribeHouseholdRealtime`).
      void unsubscribeRealtime?.();
      stopNetworkTrigger();
    };
  }, [householdId]);
}
