import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import {
  correlationSeriesRootQueryKey,
  medicationLogsRootQueryKey,
  symptomLogsRootQueryKey,
} from '@/features/glp1/domain/query-keys';
import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { Entity } from '@/lib/db/types';
import { getSupabase, serverClock } from '@/lib/supabase';
import { beginAccountSyncRun, registerAccountSyncStopper } from '@/lib/sync/account-sync-gate';
import { setBackgroundSyncHandler } from '@/lib/sync/background-sync';
import { type SyncRunResult, syncHousehold } from '@/lib/sync/engine';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { type RealtimeSubscribeState, subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import { addDiagnosticStep, reportError, trackEvent } from '@/lib/telemetry';

export { serverClock };

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

export function syncRunHasErrors(result: SyncRunResult | null): boolean {
  if (result === null) return true;
  return (
    result.push.outcomes.some((outcome) => 'error' in outcome && Boolean(outcome.error)) ||
    result.pull.some((outcome) => Boolean(outcome.error))
  );
}

let lastRealtimeStatus: RealtimeSubscribeState | null = null;

export function getLastRealtimeStatus() {
  return lastRealtimeStatus;
}

let realtimeStatusChangeCount = 0;
let realtimeReconnectCount = 0;

export function getRealtimeDiagnostics() {
  return { statusChangeCount: realtimeStatusChangeCount, reconnectCount: realtimeReconnectCount };
}

export type RealtimeLatencySample = {
  timestamp: number;
  entity: Entity;
  op: 'insert' | 'update' | 'delete';
  latencyMs: number | null;
};

const MAX_LATENCY_SAMPLES = 20;
const realtimeLatencySamples: RealtimeLatencySample[] = [];

export function getRealtimeLatencySamples(): readonly RealtimeLatencySample[] {
  return realtimeLatencySamples;
}

let realtimeLatencySampleVersion = 0;

export function getRealtimeLatencySampleVersion() {
  return realtimeLatencySampleVersion;
}

function recordRealtimeLatency(
  entity: Entity,
  op: 'insert' | 'update' | 'delete',
  latencyMs: number | null,
) {
  realtimeLatencySamples.push({ timestamp: Date.now(), entity, op, latencyMs });
  if (realtimeLatencySamples.length > MAX_LATENCY_SAMPLES) {
    realtimeLatencySamples.shift();
  }
  realtimeLatencySampleVersion += 1;
}

function invalidateEntityQueries(queryClient: QueryClient, entity: Entity, householdId: string) {
  if (entity === 'medication_logs') {
    queryClient.invalidateQueries({ queryKey: medicationLogsRootQueryKey });
    queryClient.invalidateQueries({ queryKey: correlationSeriesRootQueryKey });
    return;
  }
  if (entity === 'symptom_logs') {
    queryClient.invalidateQueries({ queryKey: symptomLogsRootQueryKey });
    return;
  }

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
  const finishAccountSyncRun = beginAccountSyncRun();
  if (!finishAccountSyncRun) return null;
  isSyncing = true;
  addDiagnosticStep('sync.run.started', { operation: 'sync.run' });
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
    const syncedOutboxCount = result.push.outcomes.reduce(
      (count, outcome) => count + (outcome.kind === 'pushed' ? outcome.sourceIds.length : 0),
      0,
    );
    const pulledCount = result.pull.reduce((acc, p) => acc + (p.rowsWritten || 0), 0);
    const firstErr = result.push.outcomes.find((o) => 'error' in o && o.error);
    const firstPullErr = result.pull.find((outcome) => outcome.error);

    // Nur 'failed-permanent' meldet sich hier — die Outbox-Zeile bekommt
    // `nextAttemptAtMs = MAX_SAFE_INTEGER` und taucht deshalb in keinem
    // weiteren Lauf erneut in `outcomes` auf (siehe push.ts), also kein Risiko
    // wiederholter Meldungen fuer denselben Fehler bei jedem 20s-Poll.
    // 'failed-transient' (Netzwerk-Hickser, automatischer Retry) ist bewusst
    // ausgenommen, sonst wuerde das Sentry-Kontingent bei laengerer
    // Offline-Phase durchlaufen.
    for (const outcome of result.push.outcomes) {
      if (outcome.kind !== 'failed-permanent') continue;
      reportError(new Error(outcome.error), {
        operation: 'sync.push',
        entity: outcome.entity ?? 'unknown',
        error_code: 'sync_push_permanent',
        outbox_count: outcome.sourceIds.length,
      });
    }

    const hasErrors = Boolean(firstErr || firstPullErr);
    const lastError = firstErr && 'error' in firstErr ? firstErr.error : firstPullErr?.error;

    lastSyncResultSummary = {
      timestamp: Date.now(),
      pushedCount,
      pulledCount,
      hasErrors,
      lastError,
    };

    trackEvent(hasErrors ? 'sync.run.failed' : 'sync.run.completed', {
      operation: 'sync.run',
      outcome: hasErrors ? 'failed' : 'completed',
      pushed_count: pushedCount,
      pulled_count: pulledCount,
      ...(lastError ? { error_message: lastError } : {}),
    });
    if (syncedOutboxCount > 0) {
      addDiagnosticStep('outbox.mutation.synced', {
        operation: 'outbox.sync',
        outcome: 'completed',
        outbox_count: syncedOutboxCount,
      });
    }

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
    reportError(err, { operation: 'sync.run', error_code: 'sync_run_failed' });
    console.warn('[SyncRunner] Sync fehlgeschlagen:', err);
    return null;
  } finally {
    isSyncing = false;
    finishAccountSyncRun();
  }
}

let activeSyncEngineIntervals = 0;

export function getActiveSyncEngineIntervalCount() {
  return activeSyncEngineIntervals;
}

const OUTBOX_DEBOUNCE_MS = 800;

const OUTBOX_MAX_WAIT_MS = 4_000;

export function useSyncEngine(householdId: string | undefined) {
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;

    // 1. Initialer Sync beim App-Start / Haushalt-Laden
    triggerHouseholdSync([householdId], false, queryClient);

    // 2. Periodischer Timer (alle 20 Sekunden) — Fallback, falls Punkt 4
    //    aus irgendeinem Grund nicht feuert (z.B. verpasste Events).
    activeSyncEngineIntervals += 1;
    const interval = setInterval(() => {
      if (householdIdRef.current && AppState.currentState === 'active') {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    }, 20000);

    // 3. Sync bei AppState -> 'active'
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    });

    // 4. Sync bei lokaler Aenderung — sonst wartet ein frisch enqueueter
    // Outbox-Eintrag im schlimmsten Fall auf den naechsten 20s-Poll-Tick, was
    // sich als traege Synchronisierung zeigt, obwohl der lokale
    // Schreibvorgang laengst durch ist. Leading-Edge + gedeckeltes
    // Trailing-Debounce, nicht reines Trailing-Debounce: eine einzelne
    // Aenderung (der Normalfall, und exakt das von #70 AC1 verlangte
    // "unter einer Sekunde") loest sofort einen Push aus, statt ihn immer um
    // `OUTBOX_DEBOUNCE_MS` zu verzoegern. Erst ab dem ZWEITEN Schreibvorgang
    // im selben Schwung (z.B. Einkauf mit 30-100 Zeilen abschliessen) wird
    // gebuendelt: ein Trailing-Sync nach Ruhephase statt einem Sync pro Zeile.
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let burstStartedAt: number | null = null;
    let writesInBurst = 0;
    let outboxEffectCancelled = false;

    const flushDebouncedSync = () => {
      debounceTimer = null;
      burstStartedAt = null;
      writesInBurst = 0;
      if (householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    };

    const unsubscribeOutbox = onOutboxChanged(() => {
      const now = Date.now();
      writesInBurst += 1;

      if (writesInBurst === 1) {
        burstStartedAt = now;
        if (householdIdRef.current) {
          // Fire-and-forget: `triggerHouseholdSync` gibt `null` zurueck, wenn
          // z.B. bereits ein anderer Sync laeuft (isSyncing-Guard, etwa ein
          // gerade laufender AppState-Resume-Sync). Ohne Fallback wuerde
          // dieser einzelne Schreibvorgang dann still bis zum naechsten
          // 20s-Poll warten, statt das #70-AC1-Ziel "unter einer Sekunde" zu
          // erreichen. Nur nachholen, wenn zwischenzeitlich kein zweiter
          // Schreibvorgang bereits einen Debounce-Timer gesetzt hat.
          triggerHouseholdSync([householdIdRef.current], false, queryClient).then((result) => {
            if (
              result === null &&
              !outboxEffectCancelled &&
              writesInBurst === 1 &&
              !debounceTimer &&
              householdIdRef.current
            ) {
              debounceTimer = setTimeout(flushDebouncedSync, OUTBOX_DEBOUNCE_MS);
            }
          });
        }
        return;
      }

      if (debounceTimer) clearTimeout(debounceTimer);

      if (now - (burstStartedAt as number) >= OUTBOX_MAX_WAIT_MS) {
        flushDebouncedSync();
        return;
      }
      debounceTimer = setTimeout(flushDebouncedSync, OUTBOX_DEBOUNCE_MS);
    });

    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      activeSyncEngineIntervals -= 1;
      outboxEffectCancelled = true;
      clearInterval(interval);
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeOutbox();
    };
    const unregisterAccountStopper = registerAccountSyncStopper(stop);

    return () => {
      unregisterAccountStopper();
      stop();
    };
  }, [householdId, queryClient]);
}

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
      realtimeReconnectCount += 1;
      await triggerHouseholdSync([householdId], false, queryClient);
    };

    let cancelled = false;
    let unsubscribeRealtime: (() => Promise<void>) | null = null;
    const finishAccountSyncSetup = beginAccountSyncRun();

    void (async () => {
      try {
        if (!finishAccountSyncSetup) return;
        const db = await getDatabase();
        const supabase = getSupabase();
        if (cancelled) return; // Haushalt hat sich gewechselt, waehrend getDatabase() lief
        unsubscribeRealtime = subscribeHouseholdRealtime({
          db,
          supabase,
          householdIds: [householdId],
          serverClock,
          onReconnectResyncNeeded: onReconnect,
          onRowApplied: (event) => {
            recordRealtimeLatency(event.entity, event.op, event.latencyMs);
            invalidateEntityQueries(queryClient, event.entity, householdId);
          },
          onStatusChange: (_householdId, status) => {
            lastRealtimeStatus = status;
            realtimeStatusChangeCount += 1;
            if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              addDiagnosticStep(`realtime.${status.toLowerCase()}`, {
                operation: 'realtime.subscription',
                outcome: status === 'SUBSCRIBED' ? 'completed' : 'failed',
              });
            }
          },
        });
      } finally {
        finishAccountSyncSetup?.();
      }
    })().catch((error) => {
      // Beim Accountwechsel darf das DB-Lifecycle-Gate einen bereits
      // gestarteten Setup-Lauf abbrechen. Echte Setup-Fehler bleiben sichtbar.
      if (!cancelled) {
        reportError(error, {
          operation: 'realtime.setup',
          error_code: 'realtime_setup_failed',
        });
      }
    });

    const stopNetworkTrigger = startNetworkReconnectTrigger({ onReconnect });
    let stopped = false;
    const stop = async () => {
      if (stopped) return;
      stopped = true;
      cancelled = true;
      lastRealtimeStatus = null;
      stopNetworkTrigger();
      await unsubscribeRealtime?.();
    };
    const unregisterAccountStopper = registerAccountSyncStopper(stop);

    return () => {
      unregisterAccountStopper();
      // Das Abmelden ist async (es wartet das Leave zum Server ab). Hier nicht
      // abgewartet — eine Cleanup-Funktion kann das nicht. Das ist unbedenklich:
      // Aus der Channel-Registry ist der Channel bereits synchron raus, und ein
      // spaeterer Aufbau auf demselben Topic raeumt ohnehin selbst auf (siehe
      // `subscribeHouseholdRealtime`).
      void stop();
    };
  }, [householdId, queryClient]);
}
