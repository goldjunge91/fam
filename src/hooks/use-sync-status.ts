import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { getDatabase } from '@/lib/db/client';
import { onOutboxChanged } from '@/lib/db/outbox';
import type { SqlDatabase } from '@/lib/db/types';
import { MAX_ATTEMPTS } from '@/lib/sync/backoff';
import { computeSyncStatusView, type SyncStatusView } from '@/lib/sync/sync-status';

/**
 * Wie lange "Synchronisiere..." nach einem lokalen Schreibvorgang sichtbar
 * bleibt — bewusst kurz und fix, nicht an den tatsaechlichen Push gekoppelt
 * (siehe Kommentar in `sync-status.ts`). Ein weiterer Schreibvorgang in
 * dieser Zeit verlaengert die Anzeige (derselbe Timer wird neu gestartet),
 * ein Schwung von Aenderungen zeigt also durchgehend "synchronisiert" statt
 * zu flackern.
 */
const RECENT_WRITE_DISPLAY_MS = 1_500;

/**
 * Liest Netzwerkstatus und Outbox-Zaehler und leitet daraus den Anzeigezustand
 * fuer #51 ab.
 *
 * Netzwerkstatus kommt aus TanStacks bereits gemountetem `onlineManager`
 * (gespeist von echten `expo-network`-Events ueber `startQueryEnvironmentSync`
 * in `src/app/_layout.tsx`) statt einem zweiten, unabhaengigen Listener — #50s
 * Anforderung, `expo-network` direkt zu verwenden, betrifft den
 * Reconnect-*Trigger*, nicht diese *Anzeige*; beide speisen sich letztlich aus
 * denselben Events.
 *
 * Die `pending`/`failed`-Zaehler (fuer die Beschriftung, `offline`/`failed`)
 * werden weiterhin per `refetchInterval` gepollt — fuer die reine Anzeige
 * reicht das. Nur der `syncing`-Ausloeser selbst haengt jetzt an
 * `onOutboxChanged()` (`lib/db/outbox.ts`), damit "Synchronisiere..." direkt
 * nach einem Schreibvorgang erscheint statt erst beim naechsten Poll-Tick.
 */
const outboxCountsQueryKey = ['sync-status', 'outbox-counts'] as const;

async function fetchOutboxCounts(db: SqlDatabase): Promise<{ pending: number; failed: number }> {
  const pending = await db.getFirstAsync<{ count: number }>(
    'select count(*) as count from outbox where attempts < ?',
    [MAX_ATTEMPTS],
  );
  const failed = await db.getFirstAsync<{ count: number }>(
    'select count(*) as count from outbox where attempts >= ?',
    [MAX_ATTEMPTS],
  );

  return { pending: pending?.count ?? 0, failed: failed?.count ?? 0 };
}

export function useSyncStatus(
  getDb: () => Promise<SqlDatabase> = getDatabase,
  enabled = true,
): SyncStatusView {
  const isOnline = useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );

  const queryClient = useQueryClient();
  const [recentLocalWrite, setRecentLocalWrite] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const unsubscribe = onOutboxChanged(() => {
      // Bewusst NICHT `invalidateQueries` + sofortiges `setRecentLocalWrite(true)`:
      // `invalidateQueries` markiert die Query nur als stale, der Refetch laeuft
      // asynchron im Hintergrund. Da `recentLocalWrite` synchron kippt, zeigte die
      // Anzeige fuer ein bis zwei Frames "Synchronisiere ... 0 ausstehend" (den
      // alten Zaehlerstand), bevor sich das durch den Refetch selbst korrigierte.
      // Stattdessen hier den echten Zaehlerstand zuerst lesen und beide Updates
      // (Cache + `recentLocalWrite`) im selben Tick anwenden.
      void (async () => {
        const db = await getDb();
        const counts = await fetchOutboxCounts(db);
        if (cancelled) return;
        queryClient.setQueryData(outboxCountsQueryKey, counts);
        setRecentLocalWrite(true);
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(() => setRecentLocalWrite(false), RECENT_WRITE_DISPLAY_MS);
      })().catch(() => {
        // Ein zeitgleicher Logout sperrt die DB synchron. Der nächste
        // authentifizierte Mount liest wieder einen frischen Zustand.
      });
    });
    return () => {
      cancelled = true;
      unsubscribe();
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [queryClient, getDb, enabled]);

  const { data } = useQuery({
    queryKey: outboxCountsQueryKey,
    queryFn: async () => fetchOutboxCounts(await getDb()),
    enabled,
    refetchInterval: 10_000,
    // Kein `_dirty`/`household_id`-Filter: die Outbox ist geraetelokal, nicht
    // haushaltsgebunden — der Zaehler braucht keinen "aktiver Haushalt"-Context.
    initialData: { pending: 0, failed: 0 },
  });

  if (!enabled) return { kind: 'hidden' };

  return computeSyncStatusView({
    isOnline,
    pendingCount: data.pending,
    failedCount: data.failed,
    recentLocalWrite,
  });
}
