import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { householdsQueryKey } from '@/features/household/query-keys';
import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { type PullOutcome, pullHousehold } from '@/lib/sync/pull';
import { clockCeiling } from '@/lib/sync/server-clock';
import { serverClock } from '@/lib/sync/sync-runner';

/**
 * Pull-Trigger fuer den lokalen `households`-Spiegel — unabhaengig von
 * jedem einzelnen Haushalt (#Kaltstart-Endlos-Ladebalken-Fix).
 *
 * `pullHousehold()`/`useSyncEngine()` sind immer schon mit einer bekannten
 * Haushalts-Id parametrisiert. Genau die fehlt aber im Moment, in dem sie
 * gebraucht wird: App-Start, bevor ueberhaupt ein aktiver Haushalt bekannt
 * ist — das Henne-Ei-Problem, das den Bug verursacht hat. Dieses Modul pullt
 * deshalb 'households' separat, sobald nur eine Nutzer-Id existiert.
 *
 * Eigene In-Flight-Sperre statt die von `triggerHouseholdSync` in
 * sync-runner.ts zu teilen: beide muessen unabhaengig voneinander laufen
 * koennen, sie beruehren disjunkte Tabellen und disjunkte `sync_state`-Zeilen.
 */

let isSyncingHouseholds = false;

function invalidateHouseholdsQuery(queryClient: QueryClient, userId: string) {
  queryClient.invalidateQueries({ queryKey: householdsQueryKey(userId) });
}

export async function triggerHouseholdsPull(
  userId: string,
  queryClient?: QueryClient,
): Promise<PullOutcome[] | null> {
  if (isSyncingHouseholds) return null;
  isSyncingHouseholds = true;
  try {
    const db = await getDatabase();
    const supabase = getSupabase();
    const outcomes = await pullHousehold({
      db,
      supabase,
      householdIds: [],
      entities: ['households'],
      clockCeilingMs: clockCeiling(serverClock, Date.now()),
    });

    if (queryClient) {
      invalidateHouseholdsQuery(queryClient, userId);
    }

    return outcomes;
  } catch (err) {
    console.warn('[HouseholdBootstrapSync] Pull fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncingHouseholds = false;
  }
}

const POLL_INTERVAL_MS = 20_000;

/**
 * Haelt den lokalen `households`-Spiegel frisch: Sofort-Pull bei Mount /
 * Anmeldung, periodischer Poll (20s, konsistent mit `useSyncEngine`),
 * Netzwerk-Reconnect und App-Vordergrund-Wechsel. Keine Realtime-Anbindung —
 * 'households' steht nicht in der `supabase_realtime`-Publication
 * (supabase/schemas/10_realtime.sql), Polling reicht fuer eine selten
 * wechselnde Liste.
 */
export function useHouseholdsBootstrapSync(userId: string | undefined, queryClient?: QueryClient) {
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    if (!userId) return;

    triggerHouseholdsPull(userId, queryClient);

    const interval = setInterval(() => {
      if (userIdRef.current && AppState.currentState === 'active') {
        triggerHouseholdsPull(userIdRef.current, queryClient);
      }
    }, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && userIdRef.current) {
        triggerHouseholdsPull(userIdRef.current, queryClient);
      }
    });

    const stopNetworkTrigger = startNetworkReconnectTrigger({
      onReconnect: async () => {
        if (userIdRef.current) {
          await triggerHouseholdsPull(userIdRef.current, queryClient);
        }
      },
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
      stopNetworkTrigger();
    };
  }, [userId, queryClient]);
}
