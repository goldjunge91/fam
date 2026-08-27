import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { householdsQueryKey } from '@/features/household/query-keys';
import { getDatabase } from '@/lib/db/client';
import { getSupabase } from '@/lib/supabase';
import { beginAccountSyncRun, registerAccountSyncStopper } from '@/lib/sync/account-sync-gate';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { type PullOutcome, pullHousehold } from '@/lib/sync/pull';
import { clockCeiling } from '@/lib/sync/server-clock';
import { serverClock } from '@/lib/sync/sync-runner';
import { reportError } from '@/lib/telemetry';

let isSyncingHouseholds = false;

function invalidateHouseholdsQuery(queryClient: QueryClient, userId: string) {
  queryClient.invalidateQueries({ queryKey: householdsQueryKey(userId) });
}

export async function triggerHouseholdsPull(
  userId: string,
  queryClient?: QueryClient,
): Promise<PullOutcome[] | null> {
  if (isSyncingHouseholds) return null;
  const finishAccountSyncRun = beginAccountSyncRun();
  if (!finishAccountSyncRun) return null;
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
    reportError(err, {
      operation: 'sync.bootstrap',
      entity: 'households',
      error_code: 'household_bootstrap_sync_failed',
    });
    console.warn('[HouseholdBootstrapSync] Pull fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncingHouseholds = false;
    finishAccountSyncRun();
  }
}

const POLL_INTERVAL_MS = 20_000;

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

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearInterval(interval);
      subscription.remove();
      stopNetworkTrigger();
    };
    const unregisterAccountStopper = registerAccountSyncStopper(stop);

    return () => {
      unregisterAccountStopper();
      stop();
    };
  }, [userId, queryClient]);
}
