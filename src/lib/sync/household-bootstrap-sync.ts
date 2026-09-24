import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { householdsQueryKey } from '@/features/household/query-keys';
import { getSupabase, serverClock } from '@/lib/backend/supabase/remote-client';
import { getDatabase } from '@/lib/db/local-client';
import { debugLog, debugWarn } from '@/lib/observability/debug-log';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { type PullOutcome, pullHousehold } from '@/lib/sync/pull';
import { beginAccountSyncRun, registerAccountSyncStopper } from '@/lib/sync/remote-sync-gate';
import { clockCeiling } from '@/lib/sync/server-clock';
import { reportError } from '@/lib/telemetry';

let isSyncingHouseholds = false;
async function invalidateHouseholdsQuery(queryClient: QueryClient, userId: string) {
  const queryKey = householdsQueryKey(userId);
  const hadInFlightQuery = queryClient.getQueryState?.(queryKey)?.fetchStatus === 'fetching';

  await queryClient.invalidateQueries({
    queryKey,
    // Der Pull kann schneller fertig sein als die erste lokale Query aktiv
    // wird. Auch in diesem Fall muss der Guard den aktualisierten Spiegel
    // sehen, bevor er eine Haushaltsentscheidung trifft.
    refetchType: 'all',
  });

  // Wenn der Pull parallel zur allerersten lokalen Query fertig wird, sieht
  // `invalidateQueries` nur deren bereits laufenden Fetch. Danach ist ein
  // zweiter Fetch nötig, damit der Guard wirklich den Pull-Zustand liest.
  if (hadInFlightQuery) {
    await queryClient.refetchQueries({ queryKey, type: 'all' });
  }
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
      serverNowMs: serverClock.serverNowMs,
    });

    if (queryClient) {
      await invalidateHouseholdsQuery(queryClient, userId);
    }

    debugLog('[HouseholdSync] pull completed', {
      entityCount: outcomes.length,
      failedEntities: outcomes.filter((outcome) => outcome.error).map((outcome) => outcome.entity),
      rowsSkippedAsLocalWins: outcomes.reduce(
        (total, outcome) => total + outcome.rowsSkippedAsLocalWins,
        0,
      ),
      rowsWritten: outcomes.reduce((total, outcome) => total + outcome.rowsWritten, 0),
    });
    return outcomes;
  } catch (err) {
    reportError(err, {
      operation: 'sync.bootstrap',
      entity: 'households',
      error_code: 'household_bootstrap_sync_failed',
    });
    debugWarn('[HouseholdBootstrapSync] Pull fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncingHouseholds = false;
    finishAccountSyncRun();
  }
}

const POLL_INTERVAL_MS = 20_000;

export type HouseholdBootstrapSyncState = {
  /** Ein erfolgreicher Pull inklusive lokalem Refetch ist abgeschlossen. */
  isInitialSyncComplete: boolean;
  /** Der Pull lief, aber mindestens eine Haushaltsabfrage ist fehlgeschlagen. */
  isInitialSyncError: boolean;
};

type InternalHouseholdBootstrapSyncState = HouseholdBootstrapSyncState & {
  userId: string | undefined;
};

const EMPTY_BOOTSTRAP_STATE: HouseholdBootstrapSyncState = {
  isInitialSyncComplete: false,
  isInitialSyncError: false,
};

export function useHouseholdsBootstrapSync(
  userId: string | undefined,
  queryClient?: QueryClient,
  retryToken = 0,
): HouseholdBootstrapSyncState {
  const [syncState, setSyncState] = useState<InternalHouseholdBootstrapSyncState>({
    userId,
    isInitialSyncComplete: false,
    isInitialSyncError: false,
  });
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  useEffect(() => {
    // Der Token startet denselben initialen Pull nach einem manuellen Retry
    // erneut, auch wenn sich der Benutzer nicht geändert hat.
    void retryToken;
    if (!userId) {
      setSyncState({ userId, ...EMPTY_BOOTSTRAP_STATE });
      return;
    }

    let stopped = false;
    let initialSyncComplete = false;
    setSyncState({ userId, ...EMPTY_BOOTSTRAP_STATE });

    const pull = async () => {
      const outcomes = await triggerHouseholdsPull(userId, queryClient);
      if (stopped) return;
      if (initialSyncComplete) return;
      if (outcomes === null) {
        setSyncState({
          userId,
          isInitialSyncComplete: false,
          isInitialSyncError: true,
        });
        return;
      }

      const hasInitialSyncError = outcomes.some((outcome) => outcome.error !== undefined);
      if (hasInitialSyncError) {
        setSyncState({
          userId,
          isInitialSyncComplete: false,
          isInitialSyncError: true,
        });
        return;
      }

      initialSyncComplete = true;
      setSyncState({
        userId,
        isInitialSyncComplete: true,
        isInitialSyncError: false,
      });
    };

    void pull();

    const interval = setInterval(() => {
      if (userIdRef.current && AppState.currentState === 'active') {
        void pull();
      }
    }, POLL_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && userIdRef.current) {
        void pull();
      }
    });

    const stopNetworkTrigger = startNetworkReconnectTrigger({
      onReconnect: async () => {
        if (userIdRef.current) {
          await pull();
        }
      },
    });

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
  }, [userId, queryClient, retryToken]);

  return syncState.userId === userId ? syncState : EMPTY_BOOTSTRAP_STATE;
}
