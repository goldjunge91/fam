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
 * Letzter bekannter Realtime-Verbindungsstatus — bisher nirgends sichtbar
 * (nicht mal fuer Debugging), obwohl `subscribeHouseholdRealtime()` ihn
 * laengst per `onStatusChange` liefert. Ohne das laesst sich "kommt eine
 * Aenderung ueber Realtime oder nur ueber den 20s-Poll an" nicht von aussen
 * beobachten. `null` = noch nie verbunden (kein Haushalt aktiv, oder erster
 * Connect steht noch aus).
 */
let lastRealtimeStatus: RealtimeSubscribeState | null = null;

export function getLastRealtimeStatus() {
  return lastRealtimeStatus;
}

/**
 * Zaehlt Status-Uebergaenge und echte Reconnects (Uebergang zurueck zu
 * `SUBSCRIBED` nach einer Stoerung, siehe `subscribeHouseholdRealtime()`s
 * `onReconnectResyncNeeded`). Jeder Reconnect loest zusaetzlich zum
 * regulaeren 20s-Poll einen vollen `triggerHouseholdSync()` aus — ein
 * staendig auf- und abbauender Kanal wuerde also wie ein verdoppelter Poll
 * aussehen, ohne dass ein zweites Intervall existiert (siehe
 * `getActiveSyncEngineIntervalCount()`).
 */
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

/**
 * Die letzten Ende-zu-Ende-Latenzen einzelner ueber Realtime angewendeter
 * Zeilen (siehe `RealtimeRowEvent.latencyMs` in `realtime.ts`) — misst und
 * zeigt "wie lange bis eine einzelne Aenderung wirklich ankommt", statt nur
 * gefuehlt zu beurteilen. Ringpuffer, kein Verlauf ueber die Sitzung hinaus.
 */
const MAX_LATENCY_SAMPLES = 20;
const realtimeLatencySamples: RealtimeLatencySample[] = [];

export function getRealtimeLatencySamples(): readonly RealtimeLatencySample[] {
  return realtimeLatencySamples;
}

/**
 * `realtimeLatencySamples` wird in-place mutiert (`push`/`shift`) — die
 * Array-Referenz aus `getRealtimeLatencySamples()` aendert sich also nie,
 * womit sie als `useMemo`-Dependency untauglich ist (immer "gleich", auch
 * nach neuen Samples). Dieser Zaehler steigt bei jedem echten neuen Sample,
 * damit die Debug-Anzeige den Durchschnitt gezielt statt bei jedem 2s-Tick
 * neu berechnen kann.
 */
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

    // Nur 'failed-permanent' meldet sich hier — die Outbox-Zeile bekommt
    // `nextAttemptAtMs = MAX_SAFE_INTEGER` und taucht deshalb in keinem
    // weiteren Lauf erneut in `outcomes` auf (siehe push.ts), also kein Risiko
    // wiederholter Meldungen fuer denselben Fehler bei jedem 20s-Poll.
    // 'failed-transient' (Netzwerk-Hickser, automatischer Retry) ist bewusst
    // ausgenommen, sonst wuerde das Sentry-Kontingent bei laengerer
    // Offline-Phase durchlaufen.
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

/**
 * Anzahl gerade lebender `useSyncEngine`-Poll-Intervalle. Sollte nie > 1
 * sein — mehr bedeutet, ein alter Effect-Lauf wurde nicht sauber
 * aufgeraeumt und pollt parallel zum neuen weiter (verdoppelte
 * Netzwerklast, ohne dass ein einzelner HAR-Export das von zwei echten
 * Geraeten unterscheiden liesse).
 */
let activeSyncEngineIntervals = 0;

export function getActiveSyncEngineIntervalCount() {
  return activeSyncEngineIntervals;
}

/**
 * Ruhezeit nach dem letzten Schreibvorgang EINES Schwungs, bevor der
 * Trailing-Sync ausgeloest wird — betrifft nur Schwuenge ab dem zweiten
 * Schreibvorgang (siehe `useSyncEngine`, Punkt 4). Der erste Schreibvorgang
 * loest immer sofort aus.
 */
const OUTBOX_DEBOUNCE_MS = 800;
/**
 * Deckel gegen einen andauernden Schreibstrom: ohne das wuerde eine
 * durchgehende Folge von Aenderungen (jede erneuert den Debounce-Timer) den
 * Push unbegrenzt aufschieben.
 */
const OUTBOX_MAX_WAIT_MS = 4_000;

/**
 * Automatischer Sync-Hook. Startet den Sync beim Laden, periodisch alle 20s,
 * beim Reaktivieren der App (AppState == 'active') und — debounced — nach
 * jedem lokalen Schreibvorgang.
 */
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
      realtimeReconnectCount += 1;
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
