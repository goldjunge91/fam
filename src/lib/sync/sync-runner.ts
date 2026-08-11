import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getDatabase } from '@/lib/db/client';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { Entity } from '@/lib/db/types';
import { getSupabase } from '@/lib/supabase';
import { setBackgroundSyncHandler } from '@/lib/sync/background-sync';
import { type SyncRunResult, syncHousehold } from '@/lib/sync/engine';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import { createServerClock } from '@/lib/sync/server-clock';

/** Geteilt mit household-bootstrap-sync.ts, statt eine zweite Uhr-Instanz zu bauen. */
export const serverClock = createServerClock();
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

/**
 * Invalidiert die React-Query-Keys, die von `entity` gelesen werden, fuer
 * einen Haushalt — gemeinsam genutzt vom Realtime-Pfad (pro Zeile) und vom
 * Poll-/manuellen Sync-Pfad (pro Lauf). Ohne das bleibt SQLite zwar aktuell,
 * aber niemand sagt React Query, dass es neu lesen soll (#115-Befund).
 */
function invalidateEntityQueries(queryClient: QueryClient, entity: Entity, householdId: string) {
  queryClient.invalidateQueries({ queryKey: [entity, householdId] });
  if (entity === 'fridge_items') {
    queryClient.invalidateQueries({ queryKey: ['fridge_items_grouped', householdId] });
  }
}

export async function triggerHouseholdSync(
  householdIds: string[],
  retryFailed = false,
  queryClient?: QueryClient,
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

    if (queryClient) {
      const changedEntities = new Set<Entity>();
      for (const outcome of result.push.outcomes) {
        if (outcome.kind === 'pushed' && outcome.entity) changedEntities.add(outcome.entity);
      }
      for (const pull of result.pull) {
        if (pull.rowsWritten > 0) changedEntities.add(pull.entity);
      }
      for (const householdId of householdIds) {
        for (const entity of changedEntities) {
          invalidateEntityQueries(queryClient, entity, householdId);
        }
      }
    }

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
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;

    // 1. Initialer Sync beim App-Start / Haushalt-Laden
    triggerHouseholdSync([householdId], false, queryClient);

    // 2. Periodischer Timer (alle 20 Sekunden)
    const interval = setInterval(() => {
      if (householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    }, 20000);

    // 3. Sync bei AppState -> 'active'
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [householdId, queryClient]);
}

/**
 * Realtime + Netzwerk-Reconnect + Hintergrund-Sync-Handler fuer den aktiven
 * Haushalt (#48, #50). Ergaenzt useSyncEngine (Poll alle 20s) um Nahe-
 * Echtzeit-Konvergenz — wird IMMER zusammen mit useSyncEngine aufgerufen,
 * nie als Ersatz: der App-Start-Sync von useSyncEngine deckt den allerersten
 * Connect ab, dieser Hook nur Aenderungen danach.
 */
export function useRealtimeSync(householdId: string | undefined) {
  const queryClient = useQueryClient();

  // Hintergrund-Sync-Handler unabhaengig vom Realtime/Netzwerk-Teil pflegen,
  // damit die Task, egal wann sie vom OS geweckt wird, immer den aktuell
  // aktiven Haushalt kennt. Kein Haushalt (z.B. waehrend Onboarding) →
  // Handler auf null: die Task bleibt registriert und tut beim naechsten
  // Aufwachen einfach nichts (siehe background-sync.ts Kommentar).
  //
  // Bewusst ohne `queryClient`: Diese Task laeuft vom OS angestossen, ohne
  // dass der React-Baum (und damit der QueryClientProvider) sicher lebt. Die
  // naechste 'active'-Transition in `useSyncEngine` holt die Invalidierung
  // nach, sobald wieder ein Provider da ist.
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
      await triggerHouseholdSync([householdId], false, queryClient);
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
        onRowApplied: (event) => invalidateEntityQueries(queryClient, event.entity, householdId),
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
  }, [householdId, queryClient]);
}
