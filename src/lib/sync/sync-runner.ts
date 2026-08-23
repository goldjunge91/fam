import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import { retryFailedOutboxEntries } from '@/lib/db/outbox-retry';
import type { Entity } from '@/lib/db/types';
import { Sentry } from '@/lib/sentry';
import { getSupabase } from '@/lib/supabase';
import { setBackgroundSyncHandler } from '@/lib/sync/background-sync';
import { type SyncRunResult, syncHousehold } from '@/lib/sync/engine';
import { startNetworkReconnectTrigger } from '@/lib/sync/network-trigger';
import { type RealtimeSubscribeState, subscribeHouseholdRealtime } from '@/lib/sync/realtime';
import { createServerClock } from '@/lib/sync/server-clock';

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

/** Ringpuffer der letzten Realtime-Latenzen fuer die Diagnoseansicht. */
const MAX_LATENCY_SAMPLES = 20;
const realtimeLatencySamples: RealtimeLatencySample[] = [];

export function getRealtimeLatencySamples(): readonly RealtimeLatencySample[] {
  return realtimeLatencySamples;
}

/** Aendert sich bei jedem Sample, weil die Array-Referenz stabil bleibt. */
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

/** Aktualisiert React Query nach Aenderungen im lokalen SQLite-Spiegel. */
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

    // Transiente Fehler werden automatisch wiederholt und sollen Sentry offline nicht fluten.
    for (const outcome of result.push.outcomes) {
      if (outcome.kind !== 'failed-permanent') continue;
      Sentry.captureMessage(
        `Sync-Push dauerhaft fehlgeschlagen (${outcome.entity ?? 'unbekannt'}): ${outcome.error}`,
        { level: 'error', tags: { sync: 'push', entity: outcome.entity ?? 'unbekannt' } },
      );
    }

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

let activeSyncEngineIntervals = 0;

export function getActiveSyncEngineIntervalCount() {
  return activeSyncEngineIntervals;
}

// Der erste Schreibvorgang synchronisiert sofort, weitere werden gebuendelt.
const OUTBOX_DEBOUNCE_MS = 800;
// Verhindert, dass ein dauernder Schreibstrom den Push endlos aufschiebt.
const OUTBOX_MAX_WAIT_MS = 4_000;

/** Synchronisiert beim Start, alle 20 Sekunden, beim Aktivieren und nach lokalen Writes. */
export function useSyncEngine(householdId: string | undefined) {
  const householdIdRef = useRef(householdId);
  householdIdRef.current = householdId;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;

    triggerHouseholdSync([householdId], false, queryClient);

    // Fallback fuer verpasste lokale oder Realtime-Ereignisse.
    activeSyncEngineIntervals += 1;
    const interval = setInterval(() => {
      if (householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    }, 20000);

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && householdIdRef.current) {
        triggerHouseholdSync([householdIdRef.current], false, queryClient);
      }
    });

    // Leading Edge fuer einzelne Writes, gedeckeltes Trailing Debounce fuer Schwuenge.
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
          // Ein durch einen laufenden Sync abgewiesener Einzel-Write wird zeitnah nachgeholt.
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

    return () => {
      activeSyncEngineIntervals -= 1;
      outboxEffectCancelled = true;
      clearInterval(interval);
      subscription.remove();
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribeOutbox();
    };
  }, [householdId, queryClient]);
}

/** Ergaenzt den Polling-Sync um Realtime, Reconnects und Hintergrund-Sync. */
export function useRealtimeSync(householdId: string | undefined) {
  const queryClient = useQueryClient();

  // Hintergrund-Tasks koennen ohne lebenden React-Baum laufen, daher ohne QueryClient.
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

    (async () => {
      const db = await getDatabase();
      const supabase = getSupabase();
      if (cancelled) return;
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
        },
      });
    })();

    const stopNetworkTrigger = startNetworkReconnectTrigger({ onReconnect });

    return () => {
      cancelled = true;
      lastRealtimeStatus = null;
      // React-Cleanups koennen den asynchronen Channel-Leave nicht abwarten.
      void unsubscribeRealtime?.();
      stopNetworkTrigger();
    };
  }, [householdId, queryClient]);
}
